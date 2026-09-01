import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { priceAlerts, properties, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { frenchZodMessage } from "@/lib/http";
import { and, eq, desc } from "drizzle-orm";
import { isStayPast } from "@/lib/price-alert-rules";
import { apiError } from "@/lib/api-error";

const schema = z.object({
  propertyId: z.string().uuid(),
  maxPrice: z.number().positive(),
  currency: z.string().length(3).optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  numAdults: z.number().int().min(1).optional(),
  numChildren: z.number().int().min(0).optional(),
}).refine((data) => !data.checkIn || !data.checkOut || data.checkOut > data.checkIn, { message: "La date de départ doit être postérieure à l'arrivée", path: ["checkOut"] }).refine((data) => {
  const hasContext = [data.checkIn, data.checkOut, data.numAdults, data.numChildren].some((value) => value !== undefined);
  return !hasContext || (data.checkIn !== undefined && data.checkOut !== undefined && data.numAdults !== undefined && data.numChildren !== undefined);
}, { message: "Pour suivre un séjour, indiquez arrivée, départ, adultes et enfants", path: ["checkIn"] });

/**
 * GET /api/price-alerts (T-026) — liste des alertes de l'user courant.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
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
    if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
    const data = schema.parse(await request.json());
    // T-127 (P1) : on vérifie que la propriété existe avant d'insérer
    // (propertyId est une clé étrangère NOT NULL) ; sinon la base lèverait une
    // violation FK non mappée → 500. On renvoie un 404 clair.
    const [targetProperty] = await db
      .select({ id: properties.id })
      .from(properties)
      .where(eq(properties.id, data.propertyId))
      .limit(1);
    if (!targetProperty) {
      return NextResponse.json({ error: await apiError("Hébergement introuvable") }, { status: 404 });
    }
    // T-161 (audit n°30) : une alerte « séjour » ne peut pas porter une
    // arrivée passée (elle ne pourrait jamais se réaliser → fake
    // notifications ou quote inutile à chaque cron).
    const today = new Date().toISOString().slice(0, 10);
    if (data.checkIn && isStayPast(data.checkIn, today)) {
      return NextResponse.json(
        { error: await apiError("La date d'arrivée de l'alerte ne peut pas être dans le passé") },
        { status: 400 },
      );
    }
    const [existing] = await db.select().from(priceAlerts).where(and(eq(priceAlerts.userId, user.id), eq(priceAlerts.propertyId, data.propertyId))).limit(1);
    const date = (value: string | Date | null | undefined) => value ? (typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10)) : null;
    const contextChanged = Boolean(existing) && (
      String(existing!.maxPrice) !== String(data.maxPrice)
      || (existing!.currency ?? "EUR") !== (data.currency ?? "EUR")
      || date(existing!.checkIn) !== (data.checkIn ?? null)
      || date(existing!.checkOut) !== (data.checkOut ?? null)
      || existing!.numAdults !== (data.numAdults ?? null)
      || existing!.numChildren !== (data.numChildren ?? null)
    );
    const [alert] = await db
      .insert(priceAlerts)
      .values({
        userId: user.id,
        propertyId: data.propertyId,
        maxPrice: String(data.maxPrice),
        currency: data.currency ?? "EUR",
        checkIn: data.checkIn ?? null,
        checkOut: data.checkOut ?? null,
        numAdults: data.numAdults ?? null,
        numChildren: data.numChildren ?? null,
      })
      .onConflictDoUpdate({
        target: [priceAlerts.userId, priceAlerts.propertyId],
        set: {
          maxPrice: String(data.maxPrice),
          currency: data.currency ?? "EUR",
          checkIn: data.checkIn ?? null,
          checkOut: data.checkOut ?? null,
          numAdults: data.numAdults ?? null,
          numChildren: data.numChildren ?? null,
          active: true,
          ...(contextChanged ? { lastNotifiedAt: null, lastNotifiedPrice: null } : {}),
        },
      })
      .returning();
    // Créer volontairement une alerte constitue un opt-in explicite pour ces
    // notifications. L'utilisateur peut ensuite la désactiver dans son compte.
    await db.update(users).set({ priceAlertEnabled: true, updatedAt: new Date() }).where(eq(users.id, user.id));
    return NextResponse.json({ alert }, { status: 201 });
  } catch (e) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (e instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (e instanceof z.ZodError) {
      // T-137 (A1) : libellé français au lieu du message Zod anglais par défaut.
      return NextResponse.json({ error: await apiError(frenchZodMessage(e)) }, { status: 400 });
    }
    console.error("[price-alerts] POST", e);
    return NextResponse.json({ error: await apiError("Erreur") }, { status: 500 });
  }
}
