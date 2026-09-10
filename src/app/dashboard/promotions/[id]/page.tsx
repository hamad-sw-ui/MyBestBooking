import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/db";
import { promotions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/http";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PromotionEditForm } from "@/components/promotion-edit-form";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";

/**
 * T-217/P5 — `/dashboard/promotions/[id]` : édition d'un code promo existant.
 *
 * `PATCH /api/promotions/[id]` (name/isActive/maxUses/maxDiscount/validUntil,
 * garde date T-126) existait sans aucun écran : la seule voie était de
 * supprimer/recréer, ce qui remettait `currentUses` à zéro. Cette page
 * (admin-only, comme la liste et la création) branche le formulaire d'édition
 * sur l'API existante. Aucun changement de droits ni de contrat API — hormis
 * l'acceptation additive de `null` pour les deux plafonds (« illimité »).
 */
export const dynamic = "force-dynamic";

export default async function EditPromotionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }

  const { id } = await params;
  // Identifiant mal formé → 404, jamais d'erreur SQL remontée à l'écran.
  if (!isUuid(id)) notFound();
  const [promo] = await db.select().from(promotions).where(eq(promotions.id, id)).limit(1);
  if (!promo) notFound();

  const t = makeT(await getServerLocale());

  return (
    <div className="max-w-3xl">
      <Link
        href="/dashboard/promotions"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-[#1B3A6B] mb-4"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        {t("promo.backToList")}
      </Link>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          {t("promo.editTitle").replace("{code}", promo.code)}
        </h1>
        <p className="text-gray-600 mt-1">{t("promo.editIntro")}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{promo.code}</CardTitle>
        </CardHeader>
        <CardContent>
          <PromotionEditForm
            promotion={{
              id: promo.id,
              code: promo.code,
              name: promo.name,
              type: promo.type,
              value: String(promo.value),
              minBookingAmount: promo.minBookingAmount ? String(promo.minBookingAmount) : null,
              maxDiscount: promo.maxDiscount ? String(promo.maxDiscount) : null,
              validFrom: promo.validFrom.toISOString(),
              validUntil: promo.validUntil.toISOString(),
              maxUses: promo.maxUses,
              currentUses: promo.currentUses,
              isActive: promo.isActive,
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
