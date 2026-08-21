import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { rooms, properties, ratePlans } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { and, eq } from "drizzle-orm";

const createSchema = z.object({
  name: z.string().min(3).max(100),
  type: z.string().min(3).max(30),
  discountPercentage: z.number().min(0).max(100).optional(),
  includesBreakfast: z.boolean().optional(),
  cancellationPolicy: z.enum(["free", "flexible", "moderate", "strict", "non_refundable"]),
  cancellationFreeDays: z.number().int().min(0).max(365).optional(),
});

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
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("rate-plans POST error:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
