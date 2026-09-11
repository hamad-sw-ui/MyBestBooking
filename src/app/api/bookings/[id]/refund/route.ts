import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { bookings, properties } from "@/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { isUuid, zodErrorResponse } from "@/lib/http";
import { apiError } from "@/lib/api-error";
import { assertNotMaintenance, MaintenanceError, maintenanceResponse } from "@/lib/maintenance";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { sendRefundFinalizedNotificationIfNeeded } from "@/lib/refund-finalized-notification";

/**
 * POST /api/bookings/[id]/refund — T-273 (audit n°8, F3)
 *
 * Finalise, pour l'hôte du bien ou un admin, un remboursement **déjà
 * effectué hors plateforme** (paiement sur place reversé manuellement au
 * client). Constat de l'audit : `refundStatus` ne devenait `refunded` que
 * par le webhook Stripe — un remboursement manuel laissait l'état comptable
 * « à traiter par l'hébergeur » à vie (T-266 n'avait livré que le label et
 * la ligne d'e-mail d'annulation ; l'acte de finalisation était reporté en
 * décision produit — tranchée par cette route).
 *
 * Règles d'or (débat technique T-273/T-275) :
 *  - **jamais de contact PSP** : la cible est strictement `paid` sans
 *    `paymentIntentId` — la voie en ligne reste exclusivement Stripe
 *    (pas de double refund) ;
 *  - gardes d'état **dans le SQL conditionnel** + `FOR UPDATE` : deux
 *    finalisations concurrentes, l'une passe, l'autre 409 (idempotence
 *    explicite) ;
 *  - RBAC hôte du bien / admin (jamais le voyageur, jamais un tiers) ;
 *  - motif **obligatoire** tracé dans l'audit log (pas de colonne métier —
 *    l'acte est un constat comptable, irréversible sans ajustement admin
 *    tracé, cf. KNOWN_LIMITATIONS.md) ;
 *  - `refundAmount = total` : la finalisation ne recalcule rien (l'état
 *    `pending` — annulation avec frais — est exclu par la garde).
 */
const schema = z
  .object({
    /** Motif de l'acte (hôte/admin) — tracé dans l'audit log. */
    reason: z.string().trim().min(3, "Le motif est requis (3 caractères minimum)").max(500, "Le motif est trop long"),
  })
  .strict();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
    await assertNotMaintenance(user);

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: await apiError("Identifiant invalide") }, { status: 400 });
    const data = schema.parse(await request.json());

    const [existing] = await db
      .select({ booking: bookings, property: properties })
      .from(bookings)
      .leftJoin(properties, eq(bookings.propertyId, properties.id))
      .where(eq(bookings.id, id));
    if (!existing) return NextResponse.json({ error: await apiError("Réservation introuvable") }, { status: 404 });

    const isHost = existing.property?.hostId === user.id;
    if (!isHost && user.role !== "admin") {
      return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 403 });
    }

    // Garde de périmètre HORS transaction (réponse rapide) : la voie en
    // ligne (paymentIntentId posé) est exclusivement remboursée par le
    // webhook Stripe — jamais par cette route.
    if (existing.booking.paymentIntentId !== null) {
      return NextResponse.json(
        { error: await apiError("Réservation payée en ligne : le remboursement est géré par la plateforme de paiement") },
        { status: 409 },
      );
    }

    const updated = await db.transaction(async (tx) => {
      const [locked] = await tx
        .select()
        .from(bookings)
        .where(eq(bookings.id, id))
        .for("update");
      if (!locked) throw new Error("BOOKING_NOT_FOUND");

      // Les gardes d'état sont dans le SQL conditionnel : un 2e appel
      // concurrent (ou un état intermédiaire) affecte 0 ligne → 409 explicite.
      const now = new Date();
      const [refunded] = await tx
        .update(bookings)
        .set({
          refundStatus: "refunded",
          refundedAt: now,
          refundAmount: locked.total,
          updatedAt: now,
        })
        .where(
          and(
            eq(bookings.id, id),
            eq(bookings.paymentStatus, "paid"),
            eq(bookings.refundStatus, "none"),
            isNull(bookings.paymentIntentId),
          ),
        )
        .returning();

      if (!refunded) {
        if (locked.paymentStatus !== "paid") throw new Error("REFUND_NOT_PAID:Le paiement de cette réservation n'est pas constaté");
        if (locked.refundStatus === "refunded") throw new Error("REFUND_ALREADY_FINALIZED:Le remboursement a déjà été finalisé");
        throw new Error("REFUND_IN_PROGRESS:Un remboursement est déjà en cours pour cette réservation");
      }
      return refunded;
    });

    // L'acte est posé : la trace d'audit (motif inclus) et l'e-mail de
    // confirmation sont best-effort (un échec ne remet pas en cause l'état).
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: AUDIT_ACTIONS.bookingRefundManual,
      entityType: "booking",
      entityId: id,
      metadata: {
        host: isHost,
        reason: data.reason,
        refundAmount: String(updated.refundAmount),
        currency: updated.currency,
      },
    });
    await sendRefundFinalizedNotificationIfNeeded(id).catch((error) => {
      console.error("[bookings/[id]/refund] mail failed:", error);
    });

    return NextResponse.json({ booking: updated });
  } catch (error) {
    if (error instanceof MaintenanceError) return maintenanceResponse(error.retryAfterSeconds);
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) return zodErrorResponse(error);
    if (error instanceof Error && error.message === "BOOKING_NOT_FOUND") {
      return NextResponse.json({ error: await apiError("Réservation introuvable") }, { status: 404 });
    }
    if (error instanceof Error && error.message.startsWith("REFUND_")) {
      const message = error.message.replace(/^REFUND_[A-Z_]+:/, "");
      return NextResponse.json({ error: await apiError(message) }, { status: 409 });
    }
    console.error("bookings/[id]/refund error:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}
