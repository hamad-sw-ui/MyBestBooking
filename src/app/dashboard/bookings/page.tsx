import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { bookings, properties, rooms, users } from "@/db/schema";
import { count, eq, desc, or } from "drizzle-orm";
import {
  BookingsManager,
  type BookingRow,
} from "@/components/bulk/bookings-manager";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import { ShowMore } from "@/components/ui/show-more";
import { parsePageWindow } from "@/lib/page-window";

/**
 * T-245 (audit n°5, A2) : fenêtre de chargement. `BookingsManager` garde ses
 * filtres (statut, recherche, dates, règlement), ses statistiques et sa
 * sélection ; ils portent sur les lignes affichées, élargissables via le
 * bandeau `ShowMore`.
 */
async function getBookings(userId: string, isAdmin: boolean, limit: number) {
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
      .orderBy(desc(bookings.createdAt))
      .limit(limit);
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
    .orderBy(desc(bookings.createdAt))
    .limit(limit);
}

async function countBookings(userId: string, isAdmin: boolean) {
  if (isAdmin) {
    const [row] = await db.select({ total: count() }).from(bookings);
    return row?.total ?? 0;
  }
  const [row] = await db
    .select({ total: count() })
    .from(bookings)
    .leftJoin(properties, eq(bookings.propertyId, properties.id))
    .where(eq(properties.hostId, userId));
  return row?.total ?? 0;
}

export default async function BookingsPage({
  searchParams,
}: {
  // T-221/T-222 : les cartes du tableau de bord relient directement aux vues
  // filtrées (`?status=pending`, `?payment=due`).
  searchParams: Promise<{ status?: string; payment?: string; limit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const isAdmin = user.role === "admin";
  const t = makeT(await getServerLocale());
  const params = await searchParams;
  const initialStatus =
    params.status && ["pending", "confirmed", "cancelled", "completed", "no_show"].includes(params.status)
      ? params.status
      : "all";
  const initialPaymentFilter = params.payment === "due" ? "due" : "all";
  const window = parsePageWindow(params.limit);
  const [rows, total] = await Promise.all([
    getBookings(user.id, isAdmin, window.queryLimit),
    countBookings(user.id, isAdmin),
  ]);
  const visible = rows.slice(0, window.size);

  const serialized: BookingRow[] = visible.map((r) => ({
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
      // T-221 : échéance de la demande (affichée pour les réservations en attente).
      requestExpiresAt: r.booking.requestExpiresAt
        ? r.booking.requestExpiresAt instanceof Date
          ? r.booking.requestExpiresAt.toISOString()
          : String(r.booking.requestExpiresAt)
        : null,
      // T-222 : règlement déjà constaté sur place.
      paymentMethodOffline: r.booking.paymentMethodOffline === true,
    },
    property: r.property,
    room: r.room,
    user: r.user,
  }));

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h1
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          {t("dash.bookings")}
        </h1>
        <p className="text-gray-600 mt-1">
          {isAdmin ? t("dash.bookingsAdminSub") : t("dash.bookingsHostSub")}
        </p>
        {!isAdmin && (
          <a href="/api/dashboard/billing/export" download="MyBestBooking-reservations.csv">
            <Button variant="outline" className="w-full sm:w-auto">
              <Download className="w-4 h-4 mr-2" aria-hidden="true" />
              {t("billing.exportCsvBookings")}
            </Button>
          </a>
        )}
      </div>
      <BookingsManager
        displayTimezone={user.timezone ?? null}
        bookings={serialized}
        isAdmin={isAdmin}
        initialStatus={initialStatus}
        initialPaymentFilter={initialPaymentFilter}
      />
      <ShowMore
        shown={visible.length}
        total={total}
        hasMore={rows.length > visible.length}
        basePath="/dashboard/bookings"
        params={{ status: params.status, payment: params.payment }}
        labels={{
          shown: t("list.window.shown"),
          showMore: t("list.window.showMore"),
          showAll: t("list.window.showAll"),
          limitReached: t("list.window.limitReached"),
          filterScope: t("list.window.filterScope"),
        }}
      />
    </div>
  );
}
