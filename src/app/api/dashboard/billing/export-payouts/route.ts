import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { payouts } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import { makeT } from "@/lib/ui-strings";

function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

/**
 * P9 — Export du ledger de VERSEMENTS (`payouts`) pour la carte « États de
 * versements ». Additif : l'export bookings (`/api/dashboard/billing/export`)
 * reste inchangé. Colonnes : période, devise, brut, commission, net, nb
 * réservations, statut, versé le, clé d'idempotence.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: await apiError("Accès hébergeur ou admin requis") }, { status: 403 });
  }

  const rows = await db
    .select()
    .from(payouts)
    .where(user.role === "admin" ? sql`1 = 1` : eq(payouts.hostId, user.id))
    .orderBy(desc(payouts.createdAt))
    .limit(500);

  const t = makeT(user.language);
  const lines = [
    [
      t("billingCsv.periodStart"),
      t("billingCsv.periodEnd"),
      t("billingCsv.currency"),
      t("billingCsv.gross"),
      t("billingCsv.commission"),
      t("billingCsv.net"),
      t("billingCsv.bookingsCount"),
      t("billingCsv.status"),
      t("billingCsv.paidAt"),
      t("billingCsv.idempotencyKey"),
    ],
    ...rows.map((p) => [
      p.periodStart,
      p.periodEnd,
      p.currency,
      p.grossAmount,
      p.commissionAmount,
      p.netAmount,
      String(p.bookingsCount),
      p.status,
      p.paidAt ? p.paidAt.toISOString() : "",
      p.idempotencyKey,
    ]),
  ];
  const csv = lines.map((line) => line.map(csvCell).join(",")).join("\n");
  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="MyBestBooking-versements.csv"',
      "Cache-Control": "private, no-store",
    },
  });
}
