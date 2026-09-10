import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, properties, rooms, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUuid, frenchZodMessage } from "@/lib/http";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSetting } from "@/lib/settings";
import { calculateLoyaltyAward } from "@/lib/loyalty";
import { transitionError, type BookingActor, type BookingStatus } from "@/lib/booking-lifecycle";
import { apiError } from "@/lib/api-error";
import {
  assertNotMaintenance,
  MaintenanceError,
  maintenanceResponse,
} from "@/lib/maintenance";
import { BookingCancellationError, cancelBooking, notifyBookingCancellation } from "@/lib/booking-cancellation";
import { sendBookingConfirmationIfNeeded } from "@/lib/booking-confirmation";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";

const updateBookingSchema = z.object({
  status: z.enum(["pending", "confirmed", "cancelled", "completed", "no_show"]).optional(),
  cancellationReason: z.string().max(1000).optional(),
  // T-203 : l'hôte/admin constate que le paiement a été effectué sur place
  // (paiement manuel). Passe la réservation à `paymentStatus:"paid"` +
  // `paymentMethodOffline:true`. Distinct de la transition de statut.
  markPaidOffline: z.boolean().optional(),
});

function actorFor(role: string, isOwner: boolean): BookingActor {
  if (role === "admin") return "admin";
  if (role === "host") return "host";
  return isOwner ? "customer" : "system";
}

/**
 * T-216 — trace une transition de statut de réservation.
 * Best-effort (`recordAudit` ne throw jamais) et uniquement si le statut a
 * réellement changé : aucune écriture parasite sur une requête sans effet.
 */
async function auditStatusChange(input: {
  actor: { id: string; email: string | null };
  bookingId: string;
  from: string;
  to: string;
  actorRole: BookingActor;
}): Promise<void> {
  if (input.from === input.to) return;
  await recordAudit({
    actorId: input.actor.id,
    actorEmail: input.actor.email,
    action: AUDIT_ACTIONS.bookingStatusUpdate,
    entityType: "booking",
    entityId: input.bookingId,
    metadata: {
      previousStatus: input.from,
      newStatus: input.to,
      actor: input.actorRole,
    },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: await apiError("Identifiant invalide") }, { status: 400 });
    const [result] = await db
      .select({
        booking: bookings,
        property: properties,
        room: rooms,
        user: { id: users.id, firstName: users.firstName, lastName: users.lastName, email: users.email },
      })
      .from(bookings)
      .leftJoin(properties, eq(bookings.propertyId, properties.id))
      .leftJoin(rooms, eq(bookings.roomId, rooms.id))
      .leftJoin(users, eq(bookings.userId, users.id))
      .where(eq(bookings.id, id));
    if (!result) return NextResponse.json({ error: await apiError("Réservation non trouvée") }, { status: 404 });

    const isOwner = result.booking.userId === user.id;
    const isHost = result.property?.hostId === user.id;
    if (!isOwner && !isHost && user.role !== "admin") {
      return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 403 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching booking:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
    await assertNotMaintenance(user);

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: await apiError("Identifiant invalide") }, { status: 400 });
    const data = updateBookingSchema.parse(await request.json());
    const [existing] = await db
      .select({ booking: bookings, property: properties })
      .from(bookings)
      .leftJoin(properties, eq(bookings.propertyId, properties.id))
      .where(eq(bookings.id, id));
    if (!existing) return NextResponse.json({ error: await apiError("Réservation non trouvée") }, { status: 404 });

    const isOwner = existing.booking.userId === user.id;
    const isHost = existing.property?.hostId === user.id;
    if (!isOwner && !isHost && user.role !== "admin") {
      return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 403 });
    }

    const transition = transitionError({
      current: existing.booking.status as BookingStatus,
      next: data.status as BookingStatus | undefined,
      actor: actorFor(user.role, isOwner),
      checkOut: existing.booking.checkOut,
    });
    if (transition) return NextResponse.json({ error: await apiError(transition) }, { status: 400 });

    // Annulation : une seule commande métier pour route individuelle et bulk.
    // Elle conserve les états refund, libère les avantages et émet l’outbox.
    if (data.status === "cancelled") {
      try {
        // T-156 : l'acteur est connu (voyageur / hôte du bien / admin) : un
        // hôte annule SANS frais (remboursement intégral) et la raison est
        // forcée serveur. Les effets (refund PSP, avantages, outbox) sont
        // identiques — seule la politique de frais et le motif changent.
        const actor = actorFor(user.role, isOwner);
        const outcome = await cancelBooking(id, data.cancellationReason?.trim() || "Annulation demandée", actor);
        await notifyBookingCancellation(outcome, actor);
        // T-216 : l'annulation sort du flux principal (commande métier unique
        // `cancelBooking`) : on la trace ici pour ne pas perdre la transition.
        await auditStatusChange({
          actor: { id: user.id, email: user.email },
          bookingId: id,
          from: existing.booking.status,
          to: outcome.booking.status,
          actorRole: actor,
        });
        return NextResponse.json({ booking: outcome.booking });
      } catch (cancellationError) {
        if (cancellationError instanceof BookingCancellationError) {
          return NextResponse.json({ error: await apiError(cancellationError.message) }, { status: 409 });
        }
        throw cancellationError;
      }
    }

    // T-203 : paiement sur place constaté par l'hôte du bien ou un admin
    // (le client ne peut pas ; il ne peut qu'annuler). Passe `paymentStatus =
    // "paid"` + `paymentMethodOffline:true` et libère l'expiration. Idempotent.
    if (data.markPaidOffline) {
      if (!isHost && user.role !== "admin") {
        return NextResponse.json(
          { error: await apiError("Seul l'hôte du bien ou un administrateur peut constater un paiement sur place") },
          { status: 403 },
        );
      }
      if (existing.booking.status === "cancelled" || existing.booking.status === "no_show") {
        return NextResponse.json(
          { error: await apiError("Impossible de constater un paiement sur une réservation annulée ou no-show") },
          { status: 409 },
        );
      }
      if (existing.booking.paymentStatus === "paid") {
        // Idempotent : déjà constaté — rien à faire.
        return NextResponse.json({ booking: existing.booking });
      }
      try {
        const [paid] = await db
          .update(bookings)
          .set({
            paymentStatus: "paid",
            paymentMethodOffline: true,
            paymentMethod: "offline",
            paymentExpiresAt: null,
            requestExpiresAt: null,
            updatedAt: new Date(),
          })
          .where(eq(bookings.id, id))
          .returning();
        // Trace l'acte (hôte ou admin) pour l'audit.
        await recordAudit({
          actorId: user.id,
          action: AUDIT_ACTIONS.bookingPayOffline,
          entityType: "booking",
          entityId: id,
          metadata: { host: isHost, manual: true },
        });
        return NextResponse.json({ booking: paid });
      } catch (markError) {
        console.error("[bookings/[id]] markPaidOffline:", markError);
        return NextResponse.json({ error: await apiError("Impossible de constater le paiement sur place") }, { status: 500 });
      }
    }

    // T-207 : le paiement en ligne est désactivé. Même une réservation legacy
    // portant un ancien intent peut être reprise comme demande manuelle par
    // l'hôte ; la clôture `completed` reste protégée par `paymentStatus=paid`.
    if (data.status === "completed" && existing.booking.paymentStatus !== "paid") {
      return NextResponse.json(
        { error: await apiError("Le séjour ne peut être terminé qu'après paiement") },
        { status: 409 },
      );
    }

    const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };
    // T-209 : le TTL ne concerne que l'état `pending`. Toute sortie du pending
    // (confirmation, annulation via cancelBooking, séjour terminé/no-show) le vide.
    if (data.status && data.status !== "pending") {
      updateData.requestExpiresAt = null;
    }
    // T-202/T-207 : qui confirme la réservation à la main (hôte ou admin).
    // Si la demande portait un ancien intent, on le neutralise afin qu'aucun
    // écran ou cron de paiement ne puisse la reprendre.
    if (data.status === "confirmed") {
      updateData.confirmedBy = user.id;
      updateData.paymentExpiresAt = null;
      if (existing.booking.paymentStatus !== "paid") {
        updateData.paymentIntentId = null;
        updateData.paymentMethod = null;
      }
    }

    const updatedBooking = await db.transaction(async (tx) => {
      const [lockedBooking] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, id))
        .for("update");
      if (!lockedBooking) throw new Error("BOOKING_NOT_FOUND");

      // Une deuxième vérification dans le lock évite que deux mutations
      // concurrentes attribuent deux fois un cashback ou ressuscitent un état.
      const lockedTransition = transitionError({
        current: lockedBooking.status as BookingStatus,
        next: data.status as BookingStatus | undefined,
        actor: actorFor(user.role, lockedBooking.userId === user.id),
        checkOut: lockedBooking.checkOut,
      });
      if (lockedTransition) throw new Error(`BOOKING_TRANSITION:${lockedTransition}`);
      if (data.status === "confirmed") {
        updateData.paymentExpiresAt = null;
        if (lockedBooking.paymentStatus !== "paid") {
          updateData.paymentIntentId = null;
          updateData.paymentMethod = null;
        }
      }
      if (data.status === "completed" && lockedBooking.paymentStatus !== "paid") {
        throw new Error("BOOKING_PAYMENT_REQUIRED:Le séjour ne peut être terminé qu'après paiement");
      }

      if (data.status === "completed" && !lockedBooking.loyaltyAwardedAt) {
        const [bookingUser] = await tx
          .select()
          .from(users)
          .where(eq(users.id, lockedBooking.userId))
          .for("update");
        if (!bookingUser) throw new Error("BOOKING_USER_NOT_FOUND");
        const br = await getSetting("bestrewards");
        const loyalty = calculateLoyaltyAward(
          {
            bookingsCount: bookingUser.bestrewardsBookingsCount,
            level: bookingUser.bestrewardsLevel,
            walletBalance: bookingUser.walletBalance,
          },
          Number(lockedBooking.total),
          br.thresholds,
          // T-154b (audit n°26, P1-3) : le caller « Terminer le séjour »
          // passait la devise de la réservation au cron (T-153 C) mais pas
          // ici — un séjour facturé en devise non EUR créditait un cashback
          // 1:1 (ex. 500 $US → 25,00 € au lieu de 23,15 €).
          lockedBooking.currency ?? "EUR",
        );
        await tx
          .update(users)
          .set({
            bestrewardsBookingsCount: loyalty.bookingsCount,
            bestrewardsLevel: loyalty.level,
            walletBalance: loyalty.walletBalance,
            updatedAt: new Date(),
          })
          .where(eq(users.id, bookingUser.id));
        updateData.loyaltyAwardedAt = new Date();
        updateData.cashbackAmount = loyalty.cashback.toFixed(2);
      }

      const [updated] = await tx
        .update(bookings)
        .set(updateData)
        .where(eq(bookings.id, id))
        .returning();
      return updated;
    });

    // T-203 : une confirmation manuelle (statut → "confirmed") doit envoyer
    // l'e-mail de confirmation au voyageur ET à l'hôte, comme le fait déjà le
    // flux de paiement en ligne. Appel hors transaction, idempotent
    // (eventKey + confirmationEmailSentAt) ; best-effort (ne casse jamais la
    // transition déjà committée).
    if (data.status === "confirmed") {
      await sendBookingConfirmationIfNeeded(updatedBooking.id).catch((error) => {
        console.error("[bookings/[id]] confirmation mail failed:", error);
      });
    }

    // T-216 : trace la transition réellement appliquée.
    if (data.status) {
      await auditStatusChange({
        actor: { id: user.id, email: user.email },
        bookingId: id,
        from: existing.booking.status,
        to: updatedBooking.status,
        actorRole: actorFor(user.role, isOwner),
      });
    }

    return NextResponse.json({ booking: updatedBooking });
  } catch (error) {
    if (error instanceof MaintenanceError) return maintenanceResponse(error.retryAfterSeconds);
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) return NextResponse.json({ error: await apiError(frenchZodMessage(error)) }, { status: 400 });
    if (error instanceof Error && error.message.startsWith("BOOKING_TRANSITION:")) {
      return NextResponse.json({ error: await apiError(error.message.replace("BOOKING_TRANSITION:", "")) }, { status: 409 });
    }
    if (error instanceof Error && error.message.startsWith("BOOKING_PAYMENT_REQUIRED:")) {
      return NextResponse.json({ error: await apiError(error.message.replace("BOOKING_PAYMENT_REQUIRED:", "")) }, { status: 409 });
    }
    if (error instanceof Error && error.message === "BOOKING_NOT_FOUND") {
      return NextResponse.json({ error: await apiError("Réservation non trouvée") }, { status: 404 });
    }
    console.error("Error updating booking:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}
