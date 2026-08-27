import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { rooms, properties, ratePlans } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/http";
import { and, eq } from "drizzle-orm";

const createSchema = z.object({
  name: z.string().min(3).max(100),
  type: z.string().min(3).max(30),
  discountPercentage: z.number().min(0).max(100).optional(),
  includesBreakfast: z.boolean().optional(),
  cancellationPolicy: z.enum(["free", "flexible", "moderate", "strict", "non_refundable"]),
  cancellationFreeDays: z.number().int().min(0).max(365).optional(),
});
const updateSchema = createSchema.partial().extend({ id: z.string().uuid(), isActive: z.boolean().optional() });

/**
 * GET /api/rooms/[id]/rate-plans
 * POST /api/rooms/[id]/rate-plans
 * (T-018) — host propriétaire ou admin.
 */

async function ownership(userId: string, roomId: string) {
  const [row] = await db
    .select({ room: rooms, property: properties })
    .from(rooms)
    .leftJoin(properties, eq(rooms.propertyId, properties.id))
    .where(eq(rooms.id, roomId))
    .limit(1);
  return row;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  const row = await ownership(user.id, id);
  if (!row) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  if (row.property?.hostId !== user.id && user.role !== "admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const list = await db
    .select()
    .from(ratePlans)
    .where(eq(ratePlans.roomId, id));
  return NextResponse.json({ ratePlans: list });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    const row = await ownership(user.id, id);
    if (!row) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    if (row.property?.hostId !== user.id && user.role !== "admin") {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
    const data = createSchema.parse(await request.json());

    const [created] = await db
      .insert(ratePlans)
      .values({
        roomId: id,
        name: data.name,
        type: data.type,
        discountPercentage: data.discountPercentage != null ? String(data.discountPercentage) : "0",
        includesBreakfast: data.includesBreakfast ?? false,
        cancellationPolicy: data.cancellationPolicy,
        cancellationFreeDays: data.cancellationFreeDays ?? 0,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ ratePlan: created }, { status: 201 });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Corps de requête invalide ou manquant (JSON attendu)" }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("rate-plans POST error:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const { id: roomId } = await params;
    if (!isUuid(roomId)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    const row = await ownership(user.id, roomId);
    if (!row) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    if (row.property?.hostId !== user.id && user.role !== "admin") return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    const data = updateSchema.parse(await request.json());
    const [existing] = await db.select().from(ratePlans).where(and(eq(ratePlans.id, data.id), eq(ratePlans.roomId, roomId)));
    if (!existing) return NextResponse.json({ error: "Plan tarifaire introuvable" }, { status: 404 });
    const update: Record<string, unknown> = { ...data };
    delete update.id;
    if (data.discountPercentage !== undefined) update.discountPercentage = String(data.discountPercentage);
    const [ratePlan] = await db.update(ratePlans).set(update).where(eq(ratePlans.id, data.id)).returning();
    return NextResponse.json({ ratePlan });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Corps de requête invalide ou manquant (JSON attendu)" }, { status: 400 });
    }
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    console.error("rate-plans PATCH error:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
