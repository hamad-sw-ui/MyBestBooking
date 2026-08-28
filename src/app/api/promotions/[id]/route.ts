import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { promotions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/http";
import { eq } from "drizzle-orm";

const updateSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  isActive: z.boolean().optional(),
  maxUses: z.number().int().positive().optional(),
  maxDiscount: z.number().positive().optional(),
  validUntil: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Accès admin requis" }, { status: 403 });
    }
    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    const patch = updateSchema.parse(await request.json());

    // T-126 (P1) : si on décale la date de fin, elle ne doit pas passer
    // avant la date de début (sinon la promo devient inutilisable).
    if (patch.validUntil) {
      const [existing] = await db
        .select({ validFrom: promotions.validFrom })
        .from(promotions)
        .where(eq(promotions.id, id));
      if (existing && new Date(patch.validUntil).getTime() <= existing.validFrom.getTime()) {
        return NextResponse.json(
          { error: "La date de fin doit être postérieure à la date de début" },
          { status: 400 },
        );
      }
    }

    const [updated] = await db
      .update(promotions)
      .set({
        name: patch.name,
        isActive: patch.isActive,
        maxUses: patch.maxUses,
        maxDiscount: patch.maxDiscount != null ? String(patch.maxDiscount) : undefined,
        validUntil: patch.validUntil ? new Date(patch.validUntil) : undefined,
      })
      .where(eq(promotions.id, id))
      .returning();
    if (!updated) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
    return NextResponse.json({ promotion: updated });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Corps de requête invalide ou manquant (JSON attendu)" }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("promotions PATCH error:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Accès admin requis" }, { status: 403 });
  }
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
  const result = await db.delete(promotions).where(eq(promotions.id, id)).returning({ id: promotions.id });
  if (!result.length) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
