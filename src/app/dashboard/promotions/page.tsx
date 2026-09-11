import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { promotions } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import {
  PromotionsManager,
  type PromoRow,
} from "@/components/bulk/promotions-manager";
import { ShowMore } from "@/components/ui/show-more";
import { parsePageWindow } from "@/lib/page-window";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";

/**
 * /dashboard/promotions (refactoré T-034) — Server Component minimaliste
 * qui délègue au <PromotionsManager> client (filtres + bulk + delete).
 */
export default async function PromotionsPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }
  // T-245 (audit n°5, A2) : le tableau chargeait **toutes** les promotions.
  const window = parsePageWindow((await searchParams).limit);
  const t = makeT(await getServerLocale());
  const [rows, [counted]] = await Promise.all([
    db
      .select()
      .from(promotions)
      .orderBy(desc(promotions.createdAt))
      .limit(window.queryLimit),
    db.select({ total: sql<number>`count(*)::int` }).from(promotions),
  ]);
  const total = counted?.total ?? rows.length;
  const visible = rows.slice(0, window.size);
  const mapped: PromoRow[] = visible.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    type: p.type,
    value: String(p.value),
    minBookingAmount: p.minBookingAmount ? String(p.minBookingAmount) : null,
    maxDiscount: p.maxDiscount ? String(p.maxDiscount) : null,
    validFrom: p.validFrom.toISOString(),
    validUntil: p.validUntil.toISOString(),
    maxUses: p.maxUses,
    currentUses: p.currentUses,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
  }));
  return (
    <>
      <PromotionsManager promotions={mapped} />
      <ShowMore
        shown={visible.length}
        total={total}
        hasMore={rows.length > visible.length}
        basePath="/dashboard/promotions"
        params={{}}
        labels={{
          shown: t("list.window.shown"),
          showMore: t("list.window.showMore"),
          showAll: t("list.window.showAll"),
          limitReached: t("list.window.limitReached"),
          filterScope: t("list.window.filterScope"),
        }}
      />
    </>
  );
}
