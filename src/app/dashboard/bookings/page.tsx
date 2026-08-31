import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { bookings, properties, rooms, users } from "@/db/schema";
import { eq, desc, or } from "drizzle-orm";
import {
  BookingsManager,
  type BookingRow,
} from "@/components/bulk/bookings-manager";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";

async function getBookings(userId: string, isAdmin: boolean) {
  if (isAdmin) {
    return db
      .select({
        booking: bookings,
        property: {
          id: properties.id,
          name: properties.name,
          city: properties.city,
          mainImage: properties.mainImage,
        },
        room: {
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
      .orderBy(desc(bookings.createdAt));
  }
  const hostProperties = await db
    .select({ id: properties.id })
    .from(properties)
    .where(eq(properties.hostId, userId));
  if (hostProperties.length === 0) return [];
  const propertyIds = hostProperties.map((p) => p.id);
  return db
    .select({
      booking: bookings,
      property: {
        id: properties.id,
        name: properties.name,
        city: properties.city,
        mainImage: properties.mainImage,
      },
      room: {
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
    .where(or(...propertyIds.map((id) => eq(bookings.propertyId, id))))
    .orderBy(desc(bookings.createdAt));
}

export default async function BookingsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const isAdmin = user.role === "admin";
  const t = makeT(await getServerLocale());
  const rows = await getBookings(user.id, isAdmin);

  const serialized: BookingRow[] = rows.map((r) => ({
    booking: {
      id: r.booking.id,
      bookingReference: r.booking.bookingReference,
      status: r.booking.status,
      paymentStatus: r.booking.paymentStatus,
      checkIn: String(r.booking.checkIn),
      checkOut: String(r.booking.checkOut),
      numAdults: r.booking.numAdults,
      numChildren: r.booking.numChildren,
      guestFirstName: r.booking.guestFirstName,
      guestLastName: r.booking.guestLastName,
      guestEmail: r.booking.guestEmail,
      total: String(r.booking.total),
      currency: r.booking.currency,
      createdAt:
        r.booking.createdAt instanceof Date
          ? r.booking.createdAt.toISOString()
          : String(r.booking.createdAt),
    },
    property: r.property,
    room: r.room,
    user: r.user,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          {t("dash.bookings")}
        </h1>
        <p className="text-gray-600 mt-1">
          {isAdmin ? t("dash.bookingsAdminSub") : t("dash.bookingsHostSub")}
        </p>
      </div>
      <BookingsManager bookings={serialized} isAdmin={isAdmin} />
    </div>
  );
}
