import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { priceAlerts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/http";
import { and, eq } from "drizzle-orm";
import { apiError } from "@/lib/api-error";

/**
 * DELETE /api/price-alerts/[id] (T-026) — désactive une alerte de l'user.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: await apiError("Identifiant invalide") }, { status: 400 });
  const [deleted] = await db
    .delete(priceAlerts)
    .where(and(eq(priceAlerts.id, id), eq(priceAlerts.userId, user.id)))
    .returning({ id: priceAlerts.id });
  if (!deleted) return NextResponse.json({ error: await apiError("Alerte introuvable") }, { status: 404 });
  return NextResponse.json({ removed: true });
}
