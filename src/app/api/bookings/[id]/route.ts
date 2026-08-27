import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, properties, rooms, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/http";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getSetting } from "@/lib/settings";
import { calculateLoyaltyAward } from "@/lib/loyalty";
import { transitionError, type BookingActor, type BookingStatus } from "@/lib/booking-lifecycle";
import {
  assertNotMaintenance,
  MaintenanceError,
  maintenanceResponse,
} from "@/lib/maintenance";
import { BookingCancellationError, cancelBooking, notifyBookingCancellation } from "@/lib/booking-cancellation";

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
    if (!isUuid(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
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
    if (!isUuid(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
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

    // Annulation : une seule commande métier pour route individuelle et bulk.
    // Elle conserve les états refund, libère les avantages et émet l’outbox.
    if (data.status === "cancelled") {
      try {
        const outcome = await cancelBooking(id, data.cancellationReason?.trim() || "Annulation demandée");
        await notifyBookingCancellation(outcome);
        return NextResponse.json({ booking: outcome.booking });
      } catch (cancellationError) {
        if (cancellationError instanceof BookingCancellationError) {
          return NextResponse.json({ error: cancellationError.message }, { status: 409 });
        }
        throw cancellationError;
      }
    }

    const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };

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



    return NextResponse.json({ booking: updatedBooking });
  } catch (error) {
    if (error instanceof MaintenanceError) return maintenanceResponse(error.retryAfterSeconds);
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Corps de requête invalide ou manquant (JSON attendu)" }, { status: 400 });
    }
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
