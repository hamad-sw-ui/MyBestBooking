import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { promotions } from "@/db/schema";
import { desc } from "drizzle-orm";
import {
  PromotionsManager,
  type PromoRow,
} from "@/components/bulk/promotions-manager";

/**
 * /dashboard/promotions (refactoré T-034) — Server Component minimaliste
 * qui délègue au <PromotionsManager> client (filtres + bulk + delete).
 */
export default async function PromotionsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }
  const rows = await db
    .select()
    .from(promotions)
    .orderBy(desc(promotions.createdAt));
  const mapped: PromoRow[] = rows.map((p) => ({
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
  return <PromotionsManager promotions={mapped} />;
}
