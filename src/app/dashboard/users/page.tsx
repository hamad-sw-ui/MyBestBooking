import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { users, properties } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { UsersManager, type UserRow } from "@/components/bulk/users-manager";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import { getSetting } from "@/lib/settings";

/**
 * /dashboard/users (admin) — T-033 Session 12
 * Page shell (Server Component) : charge les utilisateurs et délègue
 * l'affichage + filtres + actions groupées au composant client
 * <UsersManager>.
 *
 * T-215 : expose aussi le taux de commission global et, par hôte, le nombre
 * d'hébergements qui héritent (`commission_rate IS NULL`) ou portent un taux
 * explicite — l'admin voit ainsi l'impact réel d'une modification de taux.
 */

async function getUsers() {
  return db.select().from(users).orderBy(desc(users.createdAt));
}

/**
 * Répartition des hébergements d'un hôte : ceux qui héritent du taux hôte
 * (colonne NULL) et ceux qui portent un taux explicite (prioritaires).
 */
async function getPropertyRateBreakdown(): Promise<
  Map<string, { inherit: number; explicit: number }>
> {
  const rows = await db
    .select({
      hostId: properties.hostId,
      inherit: sql<number>`count(*) FILTER (WHERE ${properties.commissionRate} IS NULL)::int`,
      explicit: sql<number>`count(*) FILTER (WHERE ${properties.commissionRate} IS NOT NULL)::int`,
    })
    .from(properties)
    .groupBy(properties.hostId);

  const map = new Map<string, { inherit: number; explicit: number }>();
  for (const row of rows) {
    if (row.hostId) map.set(row.hostId, { inherit: row.inherit, explicit: row.explicit });
  }
  return map;
}

async function getGlobalCommissionRate(): Promise<number> {
  try {
    const billing = await getSetting("billing");
    return Number(billing.defaultCommissionRate);
  } catch {
    return 15;
  }
}

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }
  const t = makeT(await getServerLocale());
  const [rows, rateBreakdown, globalRate] = await Promise.all([
    getUsers(),
    getPropertyRateBreakdown(),
    getGlobalCommissionRate(),
  ]);

  // Sérialiser pour le composant client (dates → ISO string)
  const serialized: UserRow[] = rows.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    country: u.country,
    emailVerified: u.emailVerified,
    bestrewardsLevel: u.bestrewardsLevel,
    bestrewardsBookingsCount: u.bestrewardsBookingsCount,
    createdAt:
      u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt),
    lastLoginAt: u.lastLoginAt
      ? u.lastLoginAt instanceof Date
        ? u.lastLoginAt.toISOString()
        : String(u.lastLoginAt)
      : null,
    deletedAt: u.deletedAt
      ? u.deletedAt instanceof Date
        ? u.deletedAt.toISOString()
        : String(u.deletedAt)
      : null,
    // T-202 : champs d'approbation hôte (présents seulement pour role=host)
    approvalStatus: u.role === "host" ? u.approvalStatus : null,
    commissionRate:
      u.role === "host" && u.commissionRate !== null
        ? String(u.commissionRate)
        : null,
    // T-215 : impact d'une modification du taux hôte (0 pour les non-hôtes).
    inheritCount: u.role === "host" ? rateBreakdown.get(u.id)?.inherit ?? 0 : 0,
    explicitCount: u.role === "host" ? rateBreakdown.get(u.id)?.explicit ?? 0 : 0,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          {t("dash.users")}
        </h1>
        <p className="text-gray-600 mt-1">
          {t("dash.usersSub")}
        </p>
      </div>
      <UsersManager
        users={serialized}
        currentUserId={user.id}
        globalCommissionRate={globalRate}
      />
    </div>
  );
}
