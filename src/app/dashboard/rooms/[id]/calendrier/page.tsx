import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { rooms, properties, ratePlans, roomAvailability } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/http";
import { AvailabilityCalendar } from "@/components/availability-calendar";
import { RatePlansSection } from "@/components/rate-plans-section";
import { RoomEditSection } from "@/components/room-edit-section";
import { formatPrice } from "@/lib/utils";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RoomCalendarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  const t = makeT(await getServerLocale());
  if (!user) redirect("/connexion");
  if (user.role !== "host" && user.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  // T-124 (E2) : identifiant mal formé → 404 propre (pas d'erreur Postgres 22P02).
  if (!isUuid(id)) notFound();
  const [row] = await db
    .select({ room: rooms, property: properties })
    .from(rooms)
    .leftJoin(properties, eq(rooms.propertyId, properties.id))
    .where(eq(rooms.id, id))
    .limit(1);
  if (!row) notFound();
  if (row.property?.hostId !== user.id && user.role !== "admin") redirect("/dashboard/rooms");

  const today = new Date();
  const from = today.toISOString().slice(0, 10);
  const to = new Date(today.getTime() + 30 * 86400_000).toISOString().slice(0, 10);

  const days = await db
    .select()
    .from(roomAvailability)
    .where(
      and(
        eq(roomAvailability.roomId, id),
        gte(roomAvailability.date, from),
        lte(roomAvailability.date, to),
      ),
    );

  const plans = await db.select().from(ratePlans).where(eq(ratePlans.roomId, id));

  return (
    <div className="max-w-5xl">
      <Link
        href="/dashboard/rooms"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-[#1B3A6B] mb-4"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        {t("cal.backRooms")}
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {t("cal.titlePrefix").replace("{name}", row.room.name)}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("cal.meta")
            .replace("{property}", row.property?.name ?? "")
            .replace("{units}", String(row.room.quantity ?? 1))
            .replace("{price}", formatPrice(row.room.basePrice, row.room.currency ?? "EUR"))}
        </p>
      </div>

      <AvailabilityCalendar
        roomId={id}
        quantity={row.room.quantity ?? 1}
        // T-154e (audit n°26, P3-9) : prix de base affiché formaté (devise),
        // plus de « 148.33 » nu.
        basePrice={formatPrice(Number(row.room.basePrice), row.room.currency ?? "EUR")}
        initialFrom={from}
        initialTo={to}
        initialDays={days.map((d) => ({
          date: typeof d.date === "string" ? d.date : new Date(d.date).toISOString().slice(0, 10),
          availableCount: d.availableCount,
          price: d.price,
          stopSell: d.stopSell,
          minStay: d.minStay,
        }))}
      />
      <RoomEditSection room={{
        id,
        name: row.room.name,
        basePrice: row.room.basePrice,
        quantity: row.room.quantity ?? 1,
        maxOccupancy: row.room.maxOccupancy,
        maxAdults: row.room.maxAdults,
        maxChildren: row.room.maxChildren,
        isActive: row.room.isActive,
      }} />
      <RatePlansSection
        roomId={id}
        basePrice={row.room.basePrice}
        currency={row.room.currency ?? "EUR"}
        initialRatePlans={plans.map((plan) => ({
          id: plan.id,
          name: plan.name,
          type: plan.type,
          discountPercentage: plan.discountPercentage,
          includesBreakfast: plan.includesBreakfast,
          cancellationPolicy: plan.cancellationPolicy,
          cancellationFreeDays: plan.cancellationFreeDays,
          isActive: plan.isActive,
        }))}
      />
    </div>
  );
}
