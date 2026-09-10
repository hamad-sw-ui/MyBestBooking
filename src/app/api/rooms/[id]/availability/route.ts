import { NextRequest, NextResponse } from "next/server";
import { civilToday } from "@/lib/dates";
import { z } from "zod";
import { db } from "@/db";
import { rooms, properties, roomAvailability } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUuid, frenchZodMessage } from "@/lib/http";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { apiError } from "@/lib/api-error";
import { loadBookedCounts } from "@/lib/room-stock";

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

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_CALENDAR_DAYS = 366;

function todayIso(): string {
  return civilToday();
}

function inclusiveCalendarDays(from: string, to: string): number {
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || to < from) return 0;
  const start = new Date(`${from}T00:00:00.000Z`).getTime();
  const end = new Date(`${to}T00:00:00.000Z`).getTime();
  return Math.floor((end - start) / 86_400_000) + 1;
}

function validateCalendarRange(from: string, to: string): string | null {
  const days = inclusiveCalendarDays(from, to);
  if (days === 0) return "La fenêtre availability doit être au format YYYY-MM-DD, avec une date de fin égale ou postérieure au début";
  if (from < todayIso()) return "Le calendrier ne peut pas être modifié sur des dates passées";
  if (days > MAX_CALENDAR_DAYS) return "La fenêtre availability doit couvrir au maximum 366 jours";
  return null;
}

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
  if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: await apiError("Identifiant invalide") }, { status: 400 });
  const row = await checkOwnership(user.id, id);
  if (!row) return NextResponse.json({ error: await apiError("Introuvable") }, { status: 404 });
  if (row.property?.hostId !== user.id && user.role !== "admin") {
    return NextResponse.json({ error: await apiError("Accès refusé") }, { status: 403 });
  }

  const from = request.nextUrl.searchParams.get("from")
    ?? civilToday();
  const to = request.nextUrl.searchParams.get("to")
    ?? new Date(Date.now() + 30 * 86400_000).toISOString().slice(0, 10);

  const rangeError = validateCalendarRange(from, to);
  if (rangeError) {
    return NextResponse.json({ error: await apiError(rangeError) }, { status: 400 });
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

  // T-244 (audit n°4) : le calendrier affichait le stock DÉCLARÉ sans retirer
  // les séjours en cours, alors que le tunnel de réservation applique les deux.
  // `bookedCounts` est **additif** : `days` (stock saisi) reste inchangé, le
  // client en dérive le reste vendable (cf. `remainingStock`).
  const bookedCounts = await loadBookedCounts(id, from, to);

  return NextResponse.json({
    roomId: id,
    from,
    to,
    quantity: row.room.quantity ?? 1,
    basePrice: row.room.basePrice,
    days: list,
    bookedCounts,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: await apiError("Identifiant invalide") }, { status: 400 });
    const row = await checkOwnership(user.id, id);
    if (!row) return NextResponse.json({ error: await apiError("Introuvable") }, { status: 404 });
    if (row.property?.hostId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: await apiError("Accès refusé") }, { status: 403 });
    }

    const { days } = batchSchema.parse(await request.json());
    const invalidDay = days.find((day) => !DATE_RE.test(day.date) || day.date < todayIso());
    if (invalidDay) {
      return NextResponse.json(
        { error: await apiError("Le calendrier ne peut pas être modifié sur des dates passées") },
        { status: 400 },
      );
    }
    const roomCapacity = row.room.quantity ?? 1;
    if (days.some((day) => day.availableCount > roomCapacity)) {
      return NextResponse.json(
        { error: await apiError(`Le stock journalier ne peut pas dépasser la capacité de ${roomCapacity}`) },
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
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: await apiError(frenchZodMessage(error)) }, { status: 400 });
    }
    console.error("availability PUT error:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}
