import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { priceAlerts, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc } from "drizzle-orm";

const schema = z.object({
  propertyId: z.string().uuid(),
  maxPrice: z.number().positive(),
  currency: z.string().length(3).optional(),
});

/**
 * GET /api/price-alerts (T-026) — liste des alertes de l'user courant.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const alerts = await db
    .select()
    .from(priceAlerts)
    .where(eq(priceAlerts.userId, user.id))
    .orderBy(desc(priceAlerts.createdAt));
  return NextResponse.json({ alerts });
}

/**
 * POST /api/price-alerts (T-026) — créer/mettre à jour une alerte.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const data = schema.parse(await request.json());
    const [alert] = await db
      .insert(priceAlerts)
      .values({
        userId: user.id,
        propertyId: data.propertyId,
        maxPrice: String(data.maxPrice),
        currency: data.currency ?? "EUR",
      })
      .onConflictDoUpdate({
        target: [priceAlerts.userId, priceAlerts.propertyId],
        set: {
          maxPrice: String(data.maxPrice),
          currency: data.currency ?? "EUR",
          active: true,
        },
      })
      .returning();
    // Créer volontairement une alerte constitue un opt-in explicite pour ces
    // notifications. L'utilisateur peut ensuite la désactiver dans son compte.
    await db.update(users).set({ priceAlertEnabled: true, updatedAt: new Date() }).where(eq(users.id, user.id));
    return NextResponse.json({ alert }, { status: 201 });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0].message }, { status: 400 });
    }
    console.error("[price-alerts] POST", e);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
