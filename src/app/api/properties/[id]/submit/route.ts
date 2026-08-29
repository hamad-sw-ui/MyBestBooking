import { NextResponse } from "next/server";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/http";
import { eq } from "drizzle-orm";

/**
 * POST /api/properties/[id]/submit (T-137, A2)
 *
 * Permet à l'hôte de **re-soumettre** son hébergement à la modération après
 * un rejet (`draft`) ou une suspension (`suspended`), et de (re)mettre une
 * propriété encore en brouillon en attente de validation : le statut passe
 * à `pending`.
 *
 * Avant cette route, la modération était une impasse fonctionnelle : quand
 * l'admin rejetait une annonce, elle repassait en `draft`, mais l'hôte ne
 * pouvait pas la remettre en attente (le PATCH/PUT du statut est réservé à
 * l'admin → 403, et l'éditeur n'envoyait aucun statut). L'annonce restait
 * donc bloquée indéfiniment, invisible du public.
 *
 * Garde-fous conservés (aucune régression sur la frontière d'admin) :
 *  - seul le propriétaire (ou un admin) peut appeler cette route ;
 *  - l'hôte ne peut cibler QUE `draft` et `suspended` → il ne peut jamais
 *    s'auto-approuver (`active`) ni retirer une annonce `active`/`pending` ;
 *  - `active` reste atteint exclusivement via la validation admin
 *    (`/validate` → approve) ; un `pending` déjà en attente est idempotent.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    }

    const [prop] = await db.select().from(properties).where(eq(properties.id, id));
    if (!prop) {
      return NextResponse.json({ error: "Hébergement non trouvé" }, { status: 404 });
    }

    const isOwner = prop.hostId === user.id;
    if (!isOwner && user.role !== "admin") {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
    }

    // Déjà en attente : rien à faire (idempotent), on renvoie l'état courant.
    if (prop.status === "pending") {
      return NextResponse.json({ property: prop });
    }
    // Déjà active : aucun enjeu de re-soumission, on ne touche pas au statut.
    if (prop.status === "active") {
      return NextResponse.json(
        { error: "Cet hébergement est déjà actif" },
        { status: 409 },
      );
    }
    // Seuls les états « rejeté/brouillon » et « suspendu » peuvent être
    // re-soumis par l'hôte. `archived` est un retrait volontaire hors flux.
    if (prop.status !== "draft" && prop.status !== "suspended") {
      return NextResponse.json(
        { error: "Cette annonce ne peut pas être re-soumise dans son état actuel" },
        { status: 409 },
      );
    }

    const [updated] = await db
      .update(properties)
      .set({ status: "pending", updatedAt: new Date() })
      .where(eq(properties.id, id))
      .returning();

    return NextResponse.json({ property: updated });
  } catch (error) {
    console.error("property submit error:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
