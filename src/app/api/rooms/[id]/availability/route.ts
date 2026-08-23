import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { rooms, properties, roomAvailability } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { stayNightsWithinLimit } from "@/lib/booking-rules";

/**
 * GET /api/rooms/[id]/availability?from=&to=
 * PUT /api/rooms/[id]/availability { days: [{date, availableCount, price?, stopSell?, minStay?}, ...] }
 * (T-018) — host propriétaire ou admin.
 */

const dayEntry = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  availableCount: z.number().int().min(0).max(999),
  price: z.number().positive().optional().nullable(),
  stopSell: z.boolean().optional(),
  minStay: z.number().int().min(1).max(30).optional(),
});

const batchSchema = z.object({
  days: z.array(dayEntry).min(1).max(90),
});

async function checkOwnership(userId: string, roomId: string) {
  const [row] = await db
    .select({ room: rooms, property: properties })
    .from(rooms)
    .leftJoin(properties, eq(rooms.propertyId, properties.id))
    .where(eq(rooms.id, roomId))
    .limit(1);
  return row;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const row = await checkOwnership(user.id, id);
  if (!row) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (row.property?.hostId !== user.id && user.role !== "admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const from = request.nextUrl.searchParams.get("from")
    ?? new Date().toISOString().slice(0, 10);
  const to = request.nextUrl.searchParams.get("to")
    ?? new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || !stayNightsWithinLimit(from, new Date(`${to}T00:00:00Z`).getTime() === new Date(`${from}T00:00:00Z`).getTime() ? to : new Date(new Date(`${to}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10))) {
    return NextResponse.json({ error: "La fenêtre availability doit couvrir au maximum 365 jours" }, { status: 400 });
  }

  const list = await db
    .select()
    .from(roomAvailability)
    .where(
      and(
        eq(roomAvailability.roomId, id),
        gte(roomAvailability.date, from),
        lte(roomAvailability.date, to),
      ),
    );

  return NextResponse.json({
    roomId: id,
    from,
    to,
    quantity: row.room.quantity ?? 1,
    basePrice: row.room.basePrice,
    days: list,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const { id } = await params;
    const row = await checkOwnership(user.id, id);
    if (!row) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    if (row.property?.hostId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { days } = batchSchema.parse(await request.json());
    const roomCapacity = row.room.quantity ?? 1;
    if (days.some((day) => day.availableCount > roomCapacity)) {
      return NextResponse.json(
        { error: `Le stock journalier ne peut pas dépasser la capacité de ${roomCapacity}` },
        { status: 400 },
      );
    }

    // UPSERT batch via Drizzle onConflictDoUpdate (postgres)
    for (const d of days) {
      await db
        .insert(roomAvailability)
        .values({
          roomId: id,
          date: d.date,
          availableCount: d.availableCount,
          price: d.price != null ? String(d.price) : null,
          stopSell: d.stopSell ?? false,
          minStay: d.minStay ?? 1,
        })
        .onConflictDoUpdate({
          target: [roomAvailability.roomId, roomAvailability.date],
          set: {
            availableCount: d.availableCount,
            price: d.price != null ? String(d.price) : null,
            stopSell: d.stopSell ?? false,
            minStay: d.minStay ?? 1,
          },
        });
    }

    return NextResponse.json({ ok: true, count: days.length });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("availability PUT error:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
