import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { bookings, properties } from "@/db/schema";
import { eq, and, desc, sql, ne } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPrice, formatDate } from "@/lib/utils";
import { sumByCurrency, formatCurrencyBreakdown, formatCurrencyConverted, sumByCurrencyConverted, hasMixedCurrencies } from "@/lib/currency-summary";
import { normalizeDisplayCurrency } from "@/lib/i18n";
import { 
  CreditCard, Download, FileText, Calendar,
  TrendingUp, Wallet, ArrowRight, CheckCircle
} from "lucide-react";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import { listProjectedPayouts, listPersistedPayouts, getDefaultPayoutAccount } from "@/lib/payout-service";
import { PayoutRequestButton } from "@/components/payout-request-button";
import { PayoutAccountForm } from "@/components/payout-account-form";
import { isSupportedCurrency } from "@/lib/i18n";

async function getBillingData(userId: string, isAdmin: boolean, locale: string) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  // Get properties
  const propertiesQuery = isAdmin
    ? db.select().from(properties)
    : db.select().from(properties).where(eq(properties.hostId, userId));
  const allProperties = await propertiesQuery;
  const propertyIds = allProperties.map(p => p.id);

  if (propertyIds.length === 0 && !isAdmin) {
    return null;
  }

  // Get all paid bookings
  const paidBookingsQuery = isAdmin
    ? db.select().from(bookings).where(and(eq(bookings.paymentStatus, "paid"), ne(bookings.status, "cancelled")))
    : db.select().from(bookings).where(
        and(
          sql`${bookings.propertyId} IN (${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})`,
          eq(bookings.paymentStatus, "paid"),
          ne(bookings.status, "cancelled"),
        )
      );
  const paidBookings = await paidBookingsQuery;

  // This month — T-152 (audit n°24, C) : totaux PAR DEVISE. On n'affiche
  // jamais une somme de devises mélangées ; les lignes de transactions
  // utilisent déjà `booking.currency`.
  const thisMonthBookings = paidBookings.filter(b => new Date(b.createdAt) >= startOfMonth);
  const sumNetByCurrency = (rows: typeof paidBookings) =>
    sumByCurrency(rows.map(b => ({ currency: b.currency, amount: parseFloat(b.netToHost) })));
  const thisMonthNetByCurrency = sumNetByCurrency(thisMonthBookings);

  // Last month
  const lastMonthBookings = paidBookings.filter(
    b => new Date(b.createdAt) >= startOfLastMonth && new Date(b.createdAt) <= endOfLastMonth
  );
  const lastMonthNetByCurrency = sumNetByCurrency(lastMonthBookings);

  // Total
  const totalNetByCurrency = sumNetByCurrency(paidBookings);

  // Recent transactions (bookings)
  const recentTransactions = await db
    .select({
      booking: bookings,
      property: {
        name: properties.name,
      },
    })
    .from(bookings)
    .leftJoin(properties, eq(bookings.propertyId, properties.id))
    .where(
      isAdmin
        ? and(eq(bookings.paymentStatus, "paid"), ne(bookings.status, "cancelled"))
        : and(
            sql`${bookings.propertyId} IN (${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})`,
            eq(bookings.paymentStatus, "paid"),
            ne(bookings.status, "cancelled"),
          )
    )
    .orderBy(desc(bookings.createdAt))
    .limit(10);

  // T-195 (G4) — « Factures » : on branche le ledger persistant des versements
  // (payouts) plutôt qu'un tableau vide codé en dur. Ces documents sont des
  // états de versements opérationnels, pas des factures fiscales (le moteur
  // comptable reste hors périmètre, cf. ADR-009).
  const persistedPayouts = await listPersistedPayouts(userId, isAdmin);
  const invoices: Array<{
    id: string;
    period: string;
    bookingsCount: number;
    revenue: number;
    commission: number;
    net: number;
    currency: string;
    status: "pending" | "paid";
    paidAt: Date | null;
  }> = persistedPayouts.map((p) => ({
    id: p.id,
    period: `${formatDate(p.periodStart, { month: "long", year: "numeric" }, locale)} – ${formatDate(p.periodEnd, { month: "long", year: "numeric" }, locale)}`,
    bookingsCount: p.bookingsCount,
    revenue: Number(p.grossAmount),
    commission: Number(p.commissionAmount),
    net: Number(p.netAmount),
    currency: p.currency,
    status: p.status === "paid" ? "paid" : p.status === "failed" ? "pending" : "pending",
    paidAt: p.paidAt,
  }));

  return {
    thisMonth: {
      netByCurrency: thisMonthNetByCurrency,
      bookings: thisMonthBookings.length,
    },
    lastMonth: {
      netByCurrency: lastMonthNetByCurrency,
      bookings: lastMonthBookings.length,
    },
    total: {
      netByCurrency: totalNetByCurrency,
      bookings: paidBookings.length,
    },
    recentTransactions,
    invoices,
  };
}

export default async function BillingPage() {
  const locale = await getServerLocale();
  const t = makeT(locale);
  const user = await getCurrentUser();
  if (!user) return null;

  const isAdmin = user.role === "admin";
  const billing = await getBillingData(user.id, isAdmin, locale);
  // T-195 — devise d'affichage (préférence compte, normalisée) pour les totaux
  // convertis. Affichage uniquement ; aucun montant transactionnel converti.
  const displayCurrency = normalizeDisplayCurrency(user.currency, "EUR");
  // T-195 — versements projetés (6 derniers mois) pour l'espace pro.
  const projectedPayouts = await listProjectedPayouts(user.id, isAdmin);
  // T-195 (G7) — un moyen de versement est-il configuré ? Si oui, on masque la
  // note « Connect account requis » (elle reste vraie sans compte).
  const hasPayoutAccount = Boolean(await getDefaultPayoutAccount(user.id));

  if (!billing) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-8" style={{ fontFamily: "'Poppins', sans-serif" }}>
{t("dash.billing")}
        </h1>
        <Card>
          <EmptyState
            icon={<CreditCard className="w-8 h-8" />}
            title={t("billing.noDataTitle")}
            description={t("billing.noDataDesc")}
            className="py-16"
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
{t("dash.billing")}
        </h1>
        <p className="text-gray-600 mt-1">
{t("billing.manage")}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-[#1B3A6B] to-[#0f2444] text-white">
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <Wallet className="w-8 h-8 text-white/80" />
<Badge className="bg-white/20 text-white">{t("billing.thisMonth")}</Badge>
            </div>
<p className="text-white/70 text-sm">{t("billing.netRevenue")}</p>
            <p className="text-3xl font-bold mt-1">{formatCurrencyConverted(billing.thisMonth.netByCurrency, displayCurrency, locale)}</p>
            {hasMixedCurrencies(billing.thisMonth.netByCurrency) && (
              <p className="text-white/60 text-xs mt-1">{t("billing.convertedNote").replace("{currency}", displayCurrency)}</p>
            )}
            <p className="text-white/60 text-sm mt-2">
{(billing.thisMonth.bookings !== 1 ? t("billing.bookingsCountMany") : t("billing.bookingsCount")).replace("{n}", String(billing.thisMonth.bookings))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-green-500" />
<span className="text-sm text-gray-500">{t("billing.lastMonth")}</span>
            </div>
<p className="text-gray-500 text-sm">{t("billing.netRevenue")}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{formatCurrencyConverted(billing.lastMonth.netByCurrency, displayCurrency, locale)}</p>
            {hasMixedCurrencies(billing.lastMonth.netByCurrency) && (
              <p className="text-gray-400 text-xs mt-1">{t("billing.convertedNote").replace("{currency}", displayCurrency)}</p>
            )}
            <p className="text-gray-500 text-sm mt-2">
{(billing.lastMonth.bookings !== 1 ? t("billing.bookingsCountMany") : t("billing.bookingsCount")).replace("{n}", String(billing.lastMonth.bookings))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <Calendar className="w-8 h-8 text-[#F5A623]" />
              <span className="text-sm text-gray-500">{t("bookings.total")}</span>
            </div>
<p className="text-gray-500 text-sm">{t("billing.cumulated")}</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{formatCurrencyConverted(billing.total.netByCurrency, displayCurrency, locale)}</p>
            {hasMixedCurrencies(billing.total.netByCurrency) && (
              <p className="text-gray-400 text-xs mt-1">{t("billing.convertedNote").replace("{currency}", displayCurrency)}</p>
            )}
            <p className="text-gray-500 text-sm mt-2">
{(billing.total.bookings !== 1 ? t("billing.bookingsTotalMany") : t("billing.bookingsTotal")).replace("{n}", String(billing.total.bookings))}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoices */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
<CardTitle>{t("billing.invoices")}</CardTitle>
              <div className="flex items-center gap-2">
                <a href="/api/dashboard/billing/export" className="inline-flex items-center px-3 py-1 rounded-lg border border-[#1B3A6B] text-xs text-[#1B3A6B] hover:bg-blue-50">
<Download className="w-3 h-3 mr-1" /> {t("billing.exportCsv")}
                </a>
                {billing.invoices.length === 0 && (
<span className="inline-flex items-center px-3 py-1 rounded-lg border border-gray-200 text-xs text-gray-500">{t("billing.invoicesUnavailable")}</span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {billing.invoices.length === 0 ? (
<p className="text-center text-gray-500 py-8">{t("billing.invoicesSoon")}</p>
            ) : (
              <div className="space-y-4">
                {billing.invoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-gray-500" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{invoice.period}</p>
                        <p className="text-sm text-gray-500">
{(invoice.bookingsCount !== 1 ? t("billing.bookingsCountMany") : t("billing.bookingsCount")).replace("{n}", String(invoice.bookingsCount))}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{formatPrice(invoice.net, invoice.currency, locale)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {invoice.status === "paid" ? (
                          <Badge variant="success">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            {t("host.paid")}
                          </Badge>
                        ) : (
<Badge variant="warning">{t("status.pending")}</Badge>
                        )}
                        <a
                          href="/api/dashboard/billing/export"
                          aria-label={t("billing.csvAria").replace("{period}", invoice.period)}
                          className="inline-flex items-center text-[#1B3A6B] hover:underline"
                        >
                          <Download className="w-4 h-4" aria-hidden="true" />
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
<CardTitle>{t("billing.recent")}</CardTitle>
          </CardHeader>
          <CardContent>
            {billing.recentTransactions.length === 0 ? (
<p className="text-center text-gray-500 py-8">{t("billing.noTx")}</p>
            ) : (
              <div className="space-y-4">
                {billing.recentTransactions.map(({ booking, property }) => (
                  <div
                    key={booking.id}
                    className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{booking.bookingReference}</p>
                      <p className="text-sm text-gray-500">{property?.name}</p>
                      <p className="text-xs text-gray-400">
                        {formatDate(booking.createdAt, { day: "numeric", month: "short", year: "numeric" }, locale)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">+{formatPrice(booking.netToHost, booking.currency, locale)}</p>
                      <p className="text-xs text-gray-400">
{t("billing.commission").replace("{amount}", formatPrice(booking.commissionAmount, booking.currency, locale))}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Versements (T-195) — net reversable par période/devise + demande */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t("payouts.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500 mb-4">{t("payouts.subtitle")}</p>
          {projectedPayouts.length === 0 ? (
            <p className="text-center text-gray-500 py-8">{t("payouts.noData")}</p>
          ) : (
            <div className="space-y-3">
              {/* Note mock / Stripe Connect — affichée seulement sans compte configuré */}
              {!hasPayoutAccount && (
                <div className="space-y-3">
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    {t("payouts.needConnect")}
                  </p>
                  {/* G1 : configurer un moyen de versement (référence chiffrée AES-GCM). */}
                  <div className="border border-gray-200 rounded-lg p-4">
                    <p className="font-medium text-gray-900 text-sm mb-1">{t("payouts.accountTitle")}</p>
                    <p className="text-xs text-gray-500 mb-3">{t("payouts.setupHint")}</p>
                    <PayoutAccountForm defaultCurrency={isSupportedCurrency(user.currency) ? user.currency : "EUR"} />
                  </div>
                </div>
              )}
              {projectedPayouts.map((p) => (
                <div
                  key={`${p.periodStart}-${p.currency}`}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {formatDate(p.periodStart, { month: "long", year: "numeric" }, locale)}
                      {" – "}
                      {formatDate(p.periodEnd, { month: "long", year: "numeric" }, locale)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {t("payouts.bookings").replace("{n}", String(p.bookingsCount))} · {p.currency} · {t("payouts.gross")} {formatPrice(p.gross, p.currency, locale)} · {t("payouts.commission")} {formatPrice(p.commission, p.currency, locale)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#1B3A6B]">{formatPrice(p.net, p.currency, locale)}</p>
                    <PayoutRequestButton periodStart={p.periodStart} periodEnd={p.periodEnd} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Commission Info */}
      <Card className="mt-6 bg-blue-50 border-blue-200">
        <CardContent className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-5 h-5 text-blue-600" />
          </div>
          <div>
<h3 className="font-semibold text-blue-900">{t("billing.aboutCommission")}</h3>
            <p className="text-sm text-blue-700 mt-1">
              {t("billing.commissionBody")}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
