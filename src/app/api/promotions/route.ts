import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { promotions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { desc, eq } from "drizzle-orm";

const createSchema = z.object({
  code: z.string().min(3).max(50).regex(/^[A-Z0-9_-]+$/, "Code alphanumérique majuscule"),
  name: z.string().min(3).max(100),
  type: z.enum(["percentage", "fixed_amount"]),
  value: z.number().positive(),
  minBookingAmount: z.number().min(0).optional(),
  maxDiscount: z.number().positive().optional(),
  validFrom: z.string(),
  validUntil: z.string(),
  maxUses: z.number().int().positive().optional(),
});

/**
 * GET /api/promotions — public (liste des promos actives non expirées).
 * POST /api/promotions — admin. Créer un code promo.
 * (T-015)
 */

export async function GET() {
  const now = new Date();
  const list = await db
    .select()
    .from(promotions)
    .orderBy(desc(promotions.createdAt));
  const active = list.filter(
    (p) =>
      p.isActive &&
      new Date(p.validFrom) <= now &&
      new Date(p.validUntil) >= now &&
      (!p.maxUses || (p.currentUses ?? 0) < p.maxUses),
  );
  return NextResponse.json({ promotions: active });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Accès admin requis" }, { status: 403 });
    }

    const data = createSchema.parse(await request.json());

    // Unicité du code
    const [exists] = await db
      .select({ id: promotions.id })
      .from(promotions)
      .where(eq(promotions.code, data.code));
    if (exists) {
      return NextResponse.json({ error: "Ce code existe déjà" }, { status: 409 });
    }

    const [created] = await db
      .insert(promotions)
      .values({
        code: data.code,
        name: data.name,
        type: data.type,
        value: String(data.value),
        minBookingAmount: data.minBookingAmount != null ? String(data.minBookingAmount) : "0",
        maxDiscount: data.maxDiscount != null ? String(data.maxDiscount) : null,
        validFrom: new Date(data.validFrom),
        validUntil: new Date(data.validUntil),
        maxUses: data.maxUses ?? null,
        isActive: true,
      })
      .returning();

    return NextResponse.json({ promotion: created }, { status: 201 });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Corps de requête invalide ou manquant (JSON attendu)" }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("promotions POST error:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
