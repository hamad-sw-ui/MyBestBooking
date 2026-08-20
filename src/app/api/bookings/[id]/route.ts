import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, properties, rooms, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { computeCancellationFeeWithGrid, daysUntil, type CancellationPolicy } from "@/lib/cancellation";
import { getSetting } from "@/lib/settings";
import {
  assertNotMaintenance,
  MaintenanceError,
  maintenanceResponse,
} from "@/lib/maintenance";

const updateBookingSchema = z.object({
  status: z.enum(["pending", "confirmed", "cancelled", "completed", "no_show"]).optional(),
  cancellationReason: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 401 }
      );
    }

    const { id } = await params;

    const [result] = await db
      .select({
        booking: bookings,
        property: properties,
        room: rooms,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(bookings)
      .leftJoin(properties, eq(bookings.propertyId, properties.id))
      .leftJoin(rooms, eq(bookings.roomId, rooms.id))
      .leftJoin(users, eq(bookings.userId, users.id))
      .where(eq(bookings.id, id));

    if (!result) {
      return NextResponse.json(
        { error: "Réservation non trouvée" },
        { status: 404 }
      );
    }

    // Check authorization
    const isOwner = result.booking.userId === user.id;
    const isHost = result.property?.hostId === user.id;
    const isAdmin = user.role === "admin";

    if (!isOwner && !isHost && !isAdmin) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 403 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching booking:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 401 }
      );
    }
    // T-022 : mode maintenance — bloquer les mutations pour les non-admins.
    await assertNotMaintenance(user);

    const { id } = await params;
    const body = await request.json();
    const data = updateBookingSchema.parse(body);

    // Get booking with property info
    const [existingBooking] = await db
      .select({
        booking: bookings,
        property: properties,
      })
      .from(bookings)
      .leftJoin(properties, eq(bookings.propertyId, properties.id))
      .where(eq(bookings.id, id));

    if (!existingBooking) {
      return NextResponse.json(
        { error: "Réservation non trouvée" },
        { status: 404 }
      );
    }

    // Check authorization
    const isOwner = existingBooking.booking.userId === user.id;
    const isHost = existingBooking.property?.hostId === user.id;
    const isAdmin = user.role === "admin";

    if (!isOwner && !isHost && !isAdmin) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 403 }
      );
    }

    // Handle cancellation
    const updateData: Record<string, unknown> = { ...data, updatedAt: new Date() };
    if (data.status === "cancelled") {
      updateData.cancelledAt = new Date();
      // T-016 : calcule le cancellationFee selon la policy de la property
      // et le nombre de jours avant check-in.
      // T-021 : la grille est désormais éditable via app_settings.
      const policy = (existingBooking.property?.cancellationPolicy ?? "flexible") as CancellationPolicy;
      const total = parseFloat(existingBooking.booking.total);
      const days = daysUntil(existingBooking.booking.checkIn);
      const grid = await getSetting("cancellation");
      const fee = computeCancellationFeeWithGrid(policy, total, days, grid);
      updateData.cancellationFee = fee.toFixed(2);
    }

    const [updatedBooking] = await db
      .update(bookings)
      .set(updateData)
      .where(eq(bookings.id, id))
      .returning();

    return NextResponse.json({ booking: updatedBooking });
  } catch (error) {
    if (error instanceof MaintenanceError) {
      return maintenanceResponse(error.retryAfterSeconds);
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error updating booking:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
