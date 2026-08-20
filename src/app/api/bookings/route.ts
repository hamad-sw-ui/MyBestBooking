import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, properties, rooms, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { generateBookingReference, calculateNights } from "@/lib/utils";
import { eq, and, or, desc } from "drizzle-orm";
import { z } from "zod";

const bookingSchema = z.object({
  propertyId: z.string().uuid(),
  roomId: z.string().uuid(),
  checkIn: z.string(),
  checkOut: z.string(),
  numAdults: z.number().min(1),
  numChildren: z.number().min(0).optional(),
  guestFirstName: z.string().min(2),
  guestLastName: z.string().min(2),
  guestEmail: z.string().email(),
  guestPhone: z.string().optional(),
  guestCountry: z.string().length(2).optional(),
  tripPurpose: z.enum(["leisure", "business"]).optional(),
  specialRequests: z.string().optional(),
  estimatedArrival: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Non autorisé" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const propertyId = searchParams.get("propertyId");

    let conditions = [];

    // If user is a customer, only show their bookings
    if (user.role === "customer") {
      conditions.push(eq(bookings.userId, user.id));
    } else if (user.role === "host") {
      // If user is a host, show bookings for their properties
      const hostProperties = await db
        .select({ id: properties.id })
        .from(properties)
        .where(eq(properties.hostId, user.id));
      
      const propertyIds = hostProperties.map((p) => p.id);
      if (propertyIds.length > 0) {
        conditions.push(or(...propertyIds.map((id) => eq(bookings.propertyId, id)))!);
      } else {
        return NextResponse.json({ bookings: [] });
      }
    }
    // Admins see all bookings

    if (status) {
      conditions.push(eq(bookings.status, status));
    }

    if (propertyId) {
      conditions.push(eq(bookings.propertyId, propertyId));
    }

    const results = await db
      .select({
        booking: bookings,
        property: {
          id: properties.id,
          name: properties.name,
          city: properties.city,
          country: properties.country,
          mainImage: properties.mainImage,
        },
        room: {
          id: rooms.id,
          name: rooms.name,
          roomType: rooms.roomType,
        },
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
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(bookings.createdAt));

    return NextResponse.json({ bookings: results });
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: "Veuillez vous connecter pour réserver" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const data = bookingSchema.parse(body);

    // Get property and room
    const [property] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, data.propertyId));

    if (!property || property.status !== "active") {
      return NextResponse.json(
        { error: "Hébergement non disponible" },
        { status: 400 }
      );
    }

    const [room] = await db
      .select()
      .from(rooms)
      .where(and(eq(rooms.id, data.roomId), eq(rooms.propertyId, data.propertyId)));

    if (!room || !room.isActive) {
      return NextResponse.json(
        { error: "Chambre non disponible" },
        { status: 400 }
      );
    }

    // Calculate pricing
    const numNights = calculateNights(data.checkIn, data.checkOut);
    const subtotal = parseFloat(room.basePrice) * numNights;
    const taxes = subtotal * 0.1; // 10% taxes
    const total = subtotal + taxes;
    const commissionRate = parseFloat(property.commissionRate || "15");
    const commissionAmount = total * (commissionRate / 100);
    const netToHost = total - commissionAmount;

    const bookingReference = generateBookingReference();

    const [newBooking] = await db
      .insert(bookings)
      .values({
        bookingReference,
        userId: user.id,
        propertyId: data.propertyId,
        roomId: data.roomId,
        status: "confirmed",
        checkIn: data.checkIn,
        checkOut: data.checkOut,
        numNights,
        numAdults: data.numAdults,
        numChildren: data.numChildren || 0,
        guestFirstName: data.guestFirstName,
        guestLastName: data.guestLastName,
        guestEmail: data.guestEmail,
        guestPhone: data.guestPhone,
        guestCountry: data.guestCountry,
        tripPurpose: data.tripPurpose,
        specialRequests: data.specialRequests,
        subtotal: subtotal.toFixed(2),
        taxes: taxes.toFixed(2),
        total: total.toFixed(2),
        currency: room.currency || "EUR",
        paymentStatus: "paid",
        paymentMethod: "card",
        commissionRate: commissionRate.toFixed(2),
        commissionAmount: commissionAmount.toFixed(2),
        netToHost: netToHost.toFixed(2),
      })
      .returning();

    // Update user's BestRewards count
    await db
      .update(users)
      .set({
        bestrewardsBookingsCount: (user.bestrewardsBookingsCount || 0) + 1,
        bestrewardsLevel: 
          (user.bestrewardsBookingsCount || 0) + 1 >= 15 ? 3 :
          (user.bestrewardsBookingsCount || 0) + 1 >= 5 ? 2 : 1,
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({ booking: newBooking }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Error creating booking:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
