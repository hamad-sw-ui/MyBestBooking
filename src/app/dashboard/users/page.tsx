import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { users, properties } from "@/db/schema";
import { count, desc, sql } from "drizzle-orm";
import { UsersManager, type UserRow } from "@/components/bulk/users-manager";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import { getSetting } from "@/lib/settings";
import { ShowMore } from "@/components/ui/show-more";
import { parsePageWindow } from "@/lib/page-window";

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

/**
 * T-245 (audit n°5, A2) : le tableau chargeait **tous** les comptes.
 * `UsersManager` conserve ses filtres client (recherche, rôle, statut) et sa
 * sélection : ils portent sur la fenêtre chargée, élargissable depuis le
 * bandeau `ShowMore`.
 */
async function getUsers(limit: number) {
  return db.select().from(users).orderBy(desc(users.createdAt)).limit(limit);
}

async function countUsers() {
  const [row] = await db.select({ total: count() }).from(users);
  return row?.total ?? 0;
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

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }
  const t = makeT(await getServerLocale());
  const window = parsePageWindow((await searchParams).limit);
  const [rows, rateBreakdown, globalRate, total] = await Promise.all([
    getUsers(window.queryLimit),
    getPropertyRateBreakdown(),
    getGlobalCommissionRate(),
    countUsers(),
  ]);
  const visible = rows.slice(0, window.size);

  // Sérialiser pour le composant client (dates → ISO string)
  const serialized: UserRow[] = visible.map((u) => ({
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
    // T-230 (A10) : état de suspension distinct de la suppression.
    suspendedAt: u.suspendedAt
      ? u.suspendedAt instanceof Date
        ? u.suspendedAt.toISOString()
        : String(u.suspendedAt)
      : null,
    // T-231 (A11) : expose la 2FA pour proposer le reset support.
    twoFactorEnabled: u.twoFactorEnabled,
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
      <ShowMore
        shown={visible.length}
        total={total}
        hasMore={rows.length > visible.length}
        basePath="/dashboard/users"
        params={{}}
        labels={{
          shown: t("list.window.shown"),
          showMore: t("list.window.showMore"),
          showAll: t("list.window.showAll"),
          limitReached: t("list.window.limitReached"),
          filterScope: t("list.window.filterScope"),
        }}
      />
    </div>
  );
}
