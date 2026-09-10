import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq, desc, sql, and, ilike, type SQL } from "drizzle-orm";
import { apiError } from "@/lib/api-error";

/**
 * GET /api/admin/hosts — admin uniquement (T-202).
 *
 * Liste les comptes hôtes avec leur statut d'approbation et, pour ceux en
 * attente, le nombre d'hébergements déjà créés (pour que l'admin sache ce qui
 * serait publié une fois approuvé).
 *
 * Query params :
 *  - `status=pending|approved|rejected` (filtre, optionnel)
 *  - `q` (filtre recherche email/nom, optionnel)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: await apiError("Accès admin requis") }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const q = searchParams.get("q");

    const conditions = [eq(users.role, "host")] as SQL[];
    if (status && ["pending", "approved", "rejected"].includes(status)) {
      conditions.push(eq(users.approvalStatus, status));
    }
    if (q) {
      const pattern = `%${q.toLowerCase()}%`;
      conditions.push(ilike(users.email, pattern));
    }

    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        approvalStatus: users.approvalStatus,
        commissionRate: users.commissionRate,
        createdAt: users.createdAt,
        // nb d'hébergements (pour savoir ce qui serait impacté par l'approbation)
        // T-215 : la colonne doit être **qualifiée** (`"users"."id"`). Avec
        // `${users.id}` seul, Drizzle insère `"id"` sans préfixe (requête
        // mono-table) et la sous-requête résolvait alors `"id"` sur
        // `properties.id` → `host_id = id` toujours faux → compteur à 0.
        propertyCount: sql<number>`(
          SELECT count(*)::int FROM properties WHERE properties.host_id = "users"."id"
        )`,
      })
      .from(users)
      .where(and(...conditions))
      .orderBy(desc(users.createdAt));

    return NextResponse.json({ hosts: rows });
  } catch (error) {
    console.error("[admin/hosts] GET error:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}
