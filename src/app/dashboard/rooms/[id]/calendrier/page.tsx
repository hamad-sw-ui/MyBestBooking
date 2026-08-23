import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { rooms, properties, ratePlans, roomAvailability } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { AvailabilityCalendar } from "@/components/availability-calendar";
import { RatePlansSection } from "@/components/rate-plans-section";
import { RoomEditSection } from "@/components/room-edit-section";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RoomCalendarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  if (user.role !== "host" && user.role !== "admin") redirect("/dashboard");

  const { id } = await params;
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
        Retour aux chambres
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Calendrier — {row.room.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {row.property?.name} — capacité : {row.room.quantity} unité
          {(row.room.quantity ?? 1) > 1 ? "s" : ""} — prix de base : {row.room.basePrice}
        </p>
      </div>

      <AvailabilityCalendar
        roomId={id}
        quantity={row.room.quantity ?? 1}
        basePrice={row.room.basePrice}
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
