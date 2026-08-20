import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { priceAlerts } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { and, eq } from "drizzle-orm";

/**
 * DELETE /api/price-alerts/[id] (T-026) — désactive une alerte de l'user.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const [deleted] = await db
    .delete(priceAlerts)
    .where(and(eq(priceAlerts.id, id), eq(priceAlerts.userId, user.id)))
    .returning({ id: priceAlerts.id });
  if (!deleted) return NextResponse.json({ error: "Alerte introuvable" }, { status: 404 });
  return NextResponse.json({ removed: true });
}
