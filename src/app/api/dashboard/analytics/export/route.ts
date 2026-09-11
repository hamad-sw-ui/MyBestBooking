import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import { makeT } from "@/lib/ui-strings";
import { getAnalytics } from "@/lib/analytics";
import { defaultPeriod, parseAnalyticsPeriod } from "@/lib/analytics-period";

/**
 * T-241 (F12) — export CSV du tableau de bord analytique.
 *
 * Constat d'audit : les indicateurs étaient corrects mais non partageables
 * (« aucun export pour un comptable ou un partenaire »). Cet export porte la
 * même ambiguïté maîtrisée que les autres exports du back-office : c'est un
 * **export opérationnel**, pas un document comptable légal.
 *
 * Choix :
 *   • la période vient de `?from&to` et retombe sur « 30 derniers jours »
 *     quand elle est absente — un export lancé depuis la page reprend donc
 *     exactement la fenêtre affichée ;
 *   • période invalide → **400** explicite (l'utilisateur est dans une action
 *     délibérée, mieux vaut un refus qu'un fichier trompeur) ;
 *   • les montants restent séparés **par devise** (jamais additionnés) ;
 *   • neutralisation des formules Excel dans les cellules texte (même règle
 *     que `export` et `export-payouts`).
 */

function csvCell(value: unknown): string {
  let text = String(value ?? "");
  // Neutralise les formules Excel/LibreOffice provenant d'un nom d'hébergement
  // saisi par un hôte, sans modifier les montants ni les références métier.
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function amount(value: number): string {
  return value.toFixed(2);
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: await apiError("Accès hébergeur ou admin requis") }, { status: 403 });
  }

  const parsed = parseAnalyticsPeriod(
    request.nextUrl.searchParams.get("from"),
    request.nextUrl.searchParams.get("to"),
  );
  if ("error" in parsed) {
    return NextResponse.json({ error: await apiError(parsed.error) }, { status: 400 });
  }
  const period = parsed.period ?? defaultPeriod();

  const analytics = await getAnalytics(user.id, user.role === "admin", period);
  if (!analytics) {
    return NextResponse.json({ error: await apiError("Aucune donnée à exporter") }, { status: 404 });
  }

  const t = makeT(user.language);
  const rows: Array<Array<unknown>> = [];

  rows.push([t("analyticsCsv.summary")]);
  rows.push([t("analyticsCsv.metric"), t("analyticsCsv.period"), t("analyticsCsv.previousPeriod"), t("analyticsCsv.currency")]);
  const currency = analytics.comparisonCurrency;
  rows.push([
    t("analyticsCsv.revenue"),
    amount(analytics.currentRevenue),
    amount(analytics.previousRevenue),
    currency,
  ]);
  rows.push([
    t("analyticsCsv.bookings"),
    analytics.currentBookingsCount,
    analytics.previousBookingsCount,
    "",
  ]);
  rows.push([
    t("analyticsCsv.avgBasket"),
    amount(analytics.avgBookingValue),
    amount(analytics.previousAvgBookingValue),
    currency,
  ]);
  rows.push([t("analyticsCsv.occupancy"), `${analytics.occupancyRate.toFixed(2)} %`, "", ""]);
  rows.push([t("analyticsCsv.avgRating"), analytics.avgRating.toFixed(2), "", "/10"]);
  rows.push([t("analyticsCsv.reviews"), analytics.totalReviews, "", ""]);
  rows.push([
    t("analyticsCsv.period"),
    `${period.from} → ${period.to}`,
    `${period.previousFrom} → ${period.previousTo}`,
    "",
  ]);
  rows.push([t("analyticsCsv.days"), period.days, period.days, ""]);
  rows.push([]);

  rows.push([t("analyticsCsv.daily")]);
  rows.push([t("analyticsCsv.date"), t("analyticsCsv.revenue"), t("analyticsCsv.currency")]);
  for (const day of analytics.revenueByDay) {
    rows.push([day.date, amount(day.revenue), day.currency]);
  }
  rows.push([]);

  rows.push([t("analyticsCsv.topProperties")]);
  rows.push([t("analyticsCsv.property"), t("analyticsCsv.bookings"), t("analyticsCsv.revenue"), t("analyticsCsv.currency")]);
  for (const property of analytics.topProperties) {
    for (const [code, revenue] of Object.entries(property.revenueByCurrency)) {
      rows.push([property.name, property.bookings, amount(revenue), code]);
    }
  }

  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  return new NextResponse(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="MyBestBooking-analytics-${period.from}_${period.to}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
