import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { count, eq, desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  PropertiesManager,
  type PropertyRow,
} from "@/components/bulk/properties-manager";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import { ShowMore } from "@/components/ui/show-more";
import { parsePageWindow } from "@/lib/page-window";

/**
 * T-245 (audit n°5, A2) : fenêtre de chargement + total. Le filtre et le tri
 * client de `PropertiesManager` restent inchangés (ils portent sur la fenêtre,
 * comme l'indique le bandeau `ShowMore`).
 */
async function getProperties(userId: string, isAdmin: boolean, limit: number) {
  if (isAdmin) {
    return db.select().from(properties).orderBy(desc(properties.createdAt)).limit(limit);
  }
  return db
    .select()
    .from(properties)
    .where(eq(properties.hostId, userId))
    .orderBy(desc(properties.createdAt))
    .limit(limit);
}

async function countProperties(userId: string, isAdmin: boolean) {
  const [row] = isAdmin
    ? await db.select({ total: count() }).from(properties)
    : await db.select({ total: count() }).from(properties).where(eq(properties.hostId, userId));
  return row?.total ?? 0;
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const isAdmin = user.role === "admin";
  const t = makeT(await getServerLocale());
  const window = parsePageWindow((await searchParams).limit);
  const [rows, total] = await Promise.all([
    getProperties(user.id, isAdmin, window.queryLimit),
    countProperties(user.id, isAdmin),
  ]);
  const visible = rows.slice(0, window.size);

  const serialized: PropertyRow[] = visible.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    type: p.type,
    status: p.status,
    city: p.city,
    country: p.country,
    starRating: p.starRating,
    averageRating: p.averageRating ? String(p.averageRating) : null,
    totalReviews: p.totalReviews,
    mainImage: p.mainImage,
    hostId: p.hostId,
    createdAt:
      p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            {t("dash.properties")}
          </h1>
          <p className="text-gray-600 mt-1">
            {isAdmin ? t("dash.propertiesAdminSub") : t("dash.propertiesHostSub")}
          </p>
        </div>
        {!isAdmin && (
          <Link href="/dashboard/properties/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              {t("dash.addProperty")}
            </Button>
          </Link>
        )}
      </div>
      <PropertiesManager properties={serialized} isAdmin={isAdmin} />
      <ShowMore
        shown={visible.length}
        total={total}
        hasMore={rows.length > visible.length}
        basePath="/dashboard/properties"
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
