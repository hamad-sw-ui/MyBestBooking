import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { bookings, properties } from "@/db/schema";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPrice, formatDate } from "@/lib/utils";
import { 
  CreditCard, Download, FileText, Calendar,
  TrendingUp, Wallet, ArrowRight, CheckCircle
} from "lucide-react";

async function getBillingData(userId: string, isAdmin: boolean) {
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
    ? db.select().from(bookings).where(eq(bookings.paymentStatus, "paid"))
    : db.select().from(bookings).where(
        and(
          sql`${bookings.propertyId} IN (${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})`,
          eq(bookings.paymentStatus, "paid")
        )
      );
  const paidBookings = await paidBookingsQuery;

  // This month
  const thisMonthBookings = paidBookings.filter(b => new Date(b.createdAt) >= startOfMonth);
  const thisMonthRevenue = thisMonthBookings.reduce((sum, b) => sum + parseFloat(b.total), 0);
  const thisMonthCommission = thisMonthBookings.reduce((sum, b) => sum + parseFloat(b.commissionAmount), 0);
  const thisMonthNet = thisMonthBookings.reduce((sum, b) => sum + parseFloat(b.netToHost), 0);

  // Last month
  const lastMonthBookings = paidBookings.filter(
    b => new Date(b.createdAt) >= startOfLastMonth && new Date(b.createdAt) <= endOfLastMonth
  );
  const lastMonthRevenue = lastMonthBookings.reduce((sum, b) => sum + parseFloat(b.total), 0);
  const lastMonthNet = lastMonthBookings.reduce((sum, b) => sum + parseFloat(b.netToHost), 0);

  // Total
  const totalRevenue = paidBookings.reduce((sum, b) => sum + parseFloat(b.total), 0);
  const totalCommission = paidBookings.reduce((sum, b) => sum + parseFloat(b.commissionAmount), 0);
  const totalNet = paidBookings.reduce((sum, b) => sum + parseFloat(b.netToHost), 0);

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
        ? eq(bookings.paymentStatus, "paid")
        : and(
            sql`${bookings.propertyId} IN (${sql.join(propertyIds.map(id => sql`${id}`), sql`, `)})`,
            eq(bookings.paymentStatus, "paid")
          )
    )
    .orderBy(desc(bookings.createdAt))
    .limit(10);

  // Generate invoices (mock data based on months)
  const invoices = [];
  for (let i = 0; i < 6; i++) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const monthBookings = paidBookings.filter(b => {
      const bDate = new Date(b.createdAt);
      return bDate.getMonth() === month.getMonth() && bDate.getFullYear() === month.getFullYear();
    });
    
    if (monthBookings.length > 0) {
      const revenue = monthBookings.reduce((sum, b) => sum + parseFloat(b.total), 0);
      const commission = monthBookings.reduce((sum, b) => sum + parseFloat(b.commissionAmount), 0);
      const net = monthBookings.reduce((sum, b) => sum + parseFloat(b.netToHost), 0);
      
      invoices.push({
        id: `MBB-INV-${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`,
        period: monthName,
        bookingsCount: monthBookings.length,
        revenue,
        commission,
        net,
        status: i === 0 ? 'pending' : 'paid',
        paidAt: i === 0 ? null : new Date(month.getFullYear(), month.getMonth() + 1, 5),
      });
    }
  }

  return {
    thisMonth: {
      revenue: thisMonthRevenue,
      commission: thisMonthCommission,
      net: thisMonthNet,
      bookings: thisMonthBookings.length,
    },
    lastMonth: {
      revenue: lastMonthRevenue,
      net: lastMonthNet,
      bookings: lastMonthBookings.length,
    },
    total: {
      revenue: totalRevenue,
      commission: totalCommission,
      net: totalNet,
      bookings: paidBookings.length,
    },
    recentTransactions,
    invoices,
  };
}

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const isAdmin = user.role === "admin";
  const billing = await getBillingData(user.id, isAdmin);

  if (!billing) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-8" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Facturation
        </h1>
        <Card>
          <EmptyState
            icon={<CreditCard className="w-8 h-8" />}
            title="Aucune donnée de facturation"
            description="Les informations de facturation apparaîtront après vos premières réservations"
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
          Facturation
        </h1>
        <p className="text-gray-600 mt-1">
          Gérez vos revenus et factures
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-[#1B3A6B] to-[#0f2444] text-white">
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <Wallet className="w-8 h-8 text-white/80" />
              <Badge className="bg-white/20 text-white">Ce mois</Badge>
            </div>
            <p className="text-white/70 text-sm">Revenus nets</p>
            <p className="text-3xl font-bold mt-1">{formatPrice(billing.thisMonth.net)}</p>
            <p className="text-white/60 text-sm mt-2">
              {billing.thisMonth.bookings} réservation{billing.thisMonth.bookings !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-green-500" />
              <span className="text-sm text-gray-500">Mois dernier</span>
            </div>
            <p className="text-gray-500 text-sm">Revenus nets</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{formatPrice(billing.lastMonth.net)}</p>
            <p className="text-gray-500 text-sm mt-2">
              {billing.lastMonth.bookings} réservation{billing.lastMonth.bookings !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <Calendar className="w-8 h-8 text-[#F5A623]" />
              <span className="text-sm text-gray-500">Total</span>
            </div>
            <p className="text-gray-500 text-sm">Revenus cumulés</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{formatPrice(billing.total.net)}</p>
            <p className="text-gray-500 text-sm mt-2">
              {billing.total.bookings} réservation{billing.total.bookings !== 1 ? "s" : ""} au total
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Invoices */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Factures</CardTitle>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Tout télécharger
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {billing.invoices.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Aucune facture</p>
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
                          {invoice.bookingsCount} réservation{invoice.bookingsCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{formatPrice(invoice.net)}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {invoice.status === "paid" ? (
                          <Badge variant="success">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Payé
                          </Badge>
                        ) : (
                          <Badge variant="warning">En attente</Badge>
                        )}
                        <button className="text-[#1B3A6B] hover:underline">
                          <Download className="w-4 h-4" />
                        </button>
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
            <CardTitle>Transactions récentes</CardTitle>
          </CardHeader>
          <CardContent>
            {billing.recentTransactions.length === 0 ? (
              <p className="text-center text-gray-500 py-8">Aucune transaction</p>
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
                        {formatDate(booking.createdAt, { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-600">+{formatPrice(booking.netToHost, booking.currency)}</p>
                      <p className="text-xs text-gray-400">
                        Commission: {formatPrice(booking.commissionAmount, booking.currency)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Commission Info */}
      <Card className="mt-6 bg-blue-50 border-blue-200">
        <CardContent className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h3 className="font-semibold text-blue-900">À propos des commissions</h3>
            <p className="text-sm text-blue-700 mt-1">
              mybestbooking prélève une commission de 15% sur chaque réservation pour couvrir les frais de plateforme,
              le support client 24/7, et la garantie prix. Les versements sont effectués automatiquement 
              48h après le check-out du client.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
