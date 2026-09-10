"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import { useT } from "@/components/ui-locale-provider";
import { Button } from "@/components/ui/button";

/**
 * T-217/P5 — édition d'un code promo (mode édition de `promotion-form`).
 *
 * L'API `PATCH /api/promotions/[id]` acceptait déjà `name`, `isActive`,
 * `maxUses`, `maxDiscount` et `validUntil`, mais aucun écran ne l'appelait :
 * prolonger une campagne ou corriger un plafond obligeait à supprimer puis
 * recréer la promotion — en perdant `currentUses`.
 *
 * Le contrat d'édition est volontairement **limité aux champs modifiables par
 * l'API** : le code, le type et la valeur d'une promotion vendue ne changent
 * pas (ils sont affichés en lecture seule). Le formulaire de création
 * (`PromotionForm`) reste inchangé : aucune régression du parcours de création
 * ni des gardes T-126.
 */
export interface EditablePromotion {
  id: string;
  code: string;
  name: string;
  type: string;
  value: string;
  minBookingAmount: string | null;
  maxDiscount: string | null;
  validFrom: string;
  validUntil: string;
  maxUses: number | null;
  currentUses: number | null;
  isActive: boolean | null;
}

export function PromotionEditForm({ promotion }: { promotion: EditablePromotion }) {
  const t = useT();
  const router = useRouter();
  const { addToast } = useToast();

  const [name, setName] = useState(promotion.name);
  const [isActive, setIsActive] = useState(Boolean(promotion.isActive));
  const [maxUses, setMaxUses] = useState(promotion.maxUses != null ? String(promotion.maxUses) : "");
  const [maxDiscount, setMaxDiscount] = useState(promotion.maxDiscount ?? "");
  const [validUntil, setValidUntil] = useState(promotion.validUntil.slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    // Garde miroir T-126 (le serveur reste la source de vérité) : la date de
    // fin doit rester postérieure à la date de début.
    if (new Date(validUntil) <= new Date(promotion.validFrom)) {
      setError(t("promo.endAfterStart"));
      return;
    }

    const body: Record<string, unknown> = {
      name: name.trim(),
      isActive,
      validUntil,
      // Un champ vidé = retour à « illimité » (null), désormais accepté par l'API.
      maxUses: maxUses.trim() === "" ? null : parseInt(maxUses, 10),
      maxDiscount: maxDiscount.trim() === "" ? null : parseFloat(maxDiscount),
    };

    setLoading(true);
    try {
      const res = await fetch(`/api/promotions/${promotion.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t("promo.saveFail"));
      addToast("success", t("promo.saved").replace("{code}", promotion.code));
      router.push("/dashboard/promotions");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("promo.saveFail"));
      addToast("error", e instanceof Error ? e.message : t("promo.saveFail"));
    } finally {
      setLoading(false);
    }
  }

  const typeLabel =
    promotion.type === "percentage"
      ? t("promo.pctType")
      : promotion.type === "fixed_amount"
        ? t("promo.fixedType")
        : t("bulk.freeNight");

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Champs figés (non supportés par le PATCH) — lisibles, non éditables. */}
      <div className="rounded-lg bg-gray-50 border border-gray-200 p-4">
        <p className="text-sm font-medium text-gray-700">{t("promo.frozenTitle")}</p>
        <dl className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
          <div>
            <dt className="text-gray-500">{t("promo.codeLabel")}</dt>
            <dd className="font-mono font-medium text-gray-900">{promotion.code}</dd>
          </div>
          <div>
            <dt className="text-gray-500">{t("promo.typeLabel")}</dt>
            <dd className="text-gray-900">{typeLabel}</dd>
          </div>
          <div>
            <dt className="text-gray-500">{t("promo.value")}</dt>
            <dd className="text-gray-900">
              {promotion.type === "percentage" ? `${promotion.value} %` : `${promotion.value} EUR`}
            </dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-gray-500">
          {t("promo.usesKept").replace("{n}", String(promotion.currentUses ?? 0))}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="promo-edit-name" className="block text-sm font-medium text-gray-700 mb-1">
            {t("promo.internalName")}
          </label>
          <input
            id="promo-edit-name"
            required
            minLength={3}
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
            placeholder={t("promo.namePlaceholder")}
          />
        </div>
        <div>
          <label htmlFor="promo-edit-until" className="block text-sm font-medium text-gray-700 mb-1">
            {t("promo.validUntil")}
          </label>
          <input
            id="promo-edit-until"
            required
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
          />
          <p className="mt-1 text-xs text-gray-500">
            {t("promo.validFrom")} : {promotion.validFrom.slice(0, 10)}
          </p>
        </div>
        <div>
          <label htmlFor="promo-edit-maxuses" className="block text-sm font-medium text-gray-700 mb-1">
            {t("promo.maxUses")}
          </label>
          <input
            id="promo-edit-maxuses"
            type="number"
            min="1"
            step="1"
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
            placeholder={t("promo.unlimited")}
          />
        </div>
        <div>
          <label htmlFor="promo-edit-maxd" className="block text-sm font-medium text-gray-700 mb-1">
            {t("promo.maxDiscount")}
          </label>
          <input
            id="promo-edit-maxd"
            type="number"
            min="0"
            step="0.01"
            value={maxDiscount}
            onChange={(e) => setMaxDiscount(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
            placeholder={t("promo.unlimited")}
          />
        </div>
      </div>

      <label className="flex items-center gap-3 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-[#1B3A6B] focus:ring-[#1B3A6B]"
        />
        {t("promo.activeLabel")}
      </label>

      <p className="text-xs text-gray-500">{t("promo.eurNote")}</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading ? t("promo.saving") : t("promo.saveCta")}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/dashboard/promotions")} disabled={loading}>
          {t("action.cancel")}
        </Button>
      </div>
    </form>
  );
}
