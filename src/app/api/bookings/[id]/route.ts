import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, properties, rooms, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { computeCancellationFeeWithGrid, daysUntil, type CancellationPolicy } from "@/lib/cancellation";
import { getSetting } from "@/lib/settings";
import { calculateLoyaltyAward } from "@/lib/loyalty";
import { transitionError, type BookingActor, type BookingStatus } from "@/lib/booking-lifecycle";
import { getPaymentProvider } from "@/lib/payment";
import {
  assertNotMaintenance,
  MaintenanceError,
  maintenanceResponse,
} from "@/lib/maintenance";
import { getMailer, templates } from "@/lib/mail";
import { releaseBookingBenefits } from "@/lib/booking-benefits";

const updateBookingSchema = z.object({
  status: z.enum(["pending", "confirmed", "cancelled", "completed", "no_show"]).optional(),
  cancellationReason: z.string().max(1000).optional(),
});

function actorFor(role: string, isOwner: boolean): BookingActor {
  if (role === "admin") return "admin";
  if (role === "host") return "host";
  return isOwner ? "customer" : "system";
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const { id } = await params;
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
    if (!result) return NextResponse.json({ error: "Réservation non trouvée" }, { status: 404 });

    const isOwner = result.booking.userId === user.id;
    const isHost = result.property?.hostId === user.id;
    if (!isOwner && !isHost && user.role !== "admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching booking:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    await assertNotMaintenance(user);

    const { id } = await params;
    const data = updateBookingSchema.parse(await request.json());
    const [existing] = await db
      .select({ booking: bookings, property: properties })
      .from(bookings)
      .leftJoin(properties, eq(bookings.propertyId, properties.id))
      .where(eq(bookings.id, id));
    if (!existing) return NextResponse.json({ error: "Réservation non trouvée" }, { status: 404 });

    const isOwner = existing.booking.userId === user.id;
    const isHost = existing.property?.hostId === user.id;
    if (!isOwner && !isHost && user.role !== "admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    const transition = transitionError({
      current: existing.booking.status as BookingStatus,
      next: data.status as BookingStatus | undefined,
      actor: actorFor(user.role, isOwner),
      checkOut: existing.booking.checkOut,
    });
    if (transition) return NextResponse.json({ error: transition }, { status: 400 });

    const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };
    let cancellationFee = 0;
    let refundAmount = 0;
    let refundStatus: "none" | "pending" | "refunded" = "none";

    if (data.status === "cancelled") {
      const ratePlanSnapshot = existing.booking.ratePlanSnapshot as { cancellationPolicy?: string; cancellationFreeDays?: number | null } | null;
      const ratePlanPolicy = ratePlanSnapshot?.cancellationPolicy;
      const policy = (ratePlanPolicy ?? existing.property?.cancellationPolicy ?? "flexible") as CancellationPolicy;
      const daysBeforeCheckIn = daysUntil(existing.booking.checkIn);
      const grid = await getSetting("cancellation");
      cancellationFee = (ratePlanSnapshot?.cancellationFreeDays ?? 0) > 0 && daysBeforeCheckIn >= (ratePlanSnapshot?.cancellationFreeDays ?? 0)
        ? 0
        : computeCancellationFeeWithGrid(policy, Number(existing.booking.total), daysBeforeCheckIn, grid);
      refundAmount = Math.max(0, Number(existing.booking.total) - cancellationFee);

      // Ne jamais marquer une annulation payée comme soldée sans avoir tenté
      // le remboursement. Le mock est testable ; Stripe retourne une erreur
      // exploitable sans modifier le booking si le PSP refuse.
      if (existing.booking.paymentStatus === "paid" && refundAmount > 0) {
        if (!existing.booking.paymentIntentId) {
          return NextResponse.json({ error: "Remboursement impossible : paiement introuvable" }, { status: 409 });
        }
        const refund = await (await getPaymentProvider()).refund(
          existing.booking.paymentIntentId,
          Math.round(refundAmount * 100),
          `booking-cancellation-refund:${existing.booking.id}`,
        );
        if (refund.status === "failed") {
          return NextResponse.json({ error: "Le remboursement a été refusé ; la réservation reste active" }, { status: 502 });
        }
        refundStatus = refund.status === "succeeded" ? "refunded" : "pending";
        updateData.refundProviderId = refund.id;
      } else if (existing.booking.paymentStatus === "pending" && existing.booking.paymentIntentId) {
        const cancellation = await (await getPaymentProvider()).cancel(existing.booking.paymentIntentId);
        if (cancellation === "failed") {
          return NextResponse.json({ error: "Le paiement en attente ne peut pas être annulé ; la réservation reste active" }, { status: 502 });
        }
      }

      updateData.cancelledAt = new Date();
      updateData.cancellationFee = cancellationFee.toFixed(2);
      updateData.refundAmount = refundAmount.toFixed(2);
      updateData.refundStatus = refundStatus;
      if (refundStatus === "refunded") updateData.refundedAt = new Date();
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

    // Une annulation avant capture relâche promo/wallet une seule fois. Une
    // capture tardive reste protégée par l’inbox qui la rembourse ensuite.
    if (data.status === "cancelled" && updatedBooking.paymentStatus !== "paid") {
      await releaseBookingBenefits(updatedBooking.id);
    }

    if (data.status === "cancelled" && existing.booking.guestEmail) {
      try {
        const mail = await templates.bookingCancellation({
          firstName: existing.booking.guestFirstName ?? "",
          bookingReference: existing.booking.bookingReference,
          propertyName: existing.property?.name ?? "",
          cancellationFee: cancellationFee.toFixed(2),
          currency: existing.booking.currency ?? "EUR",
        });
        await (await getMailer()).send({ to: existing.booking.guestEmail, ...mail });
      } catch (mailErr) {
        console.error("[bookings PUT] cancellation mail failed:", mailErr);
      }
    }

    return NextResponse.json({ booking: updatedBooking });
  } catch (error) {
    if (error instanceof MaintenanceError) return maintenanceResponse(error.retryAfterSeconds);
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    if (error instanceof Error && error.message.startsWith("BOOKING_TRANSITION:")) {
      return NextResponse.json({ error: error.message.replace("BOOKING_TRANSITION:", "") }, { status: 409 });
    }
    if (error instanceof Error && error.message === "BOOKING_NOT_FOUND") {
      return NextResponse.json({ error: "Réservation non trouvée" }, { status: 404 });
    }
    console.error("Error updating booking:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
