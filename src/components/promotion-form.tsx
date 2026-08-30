"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
// T-154d (audit n°26, P2-8) : feedback global via ToastProvider.
import { useToast } from "@/components/ui/toast";

/**
 * Formulaire création d'un code promo (T-016).
 * POST /api/promotions
 */
export function PromotionForm() {
  const router = useRouter();
  const { addToast } = useToast();
  // Lazy initializer pour éviter Date.now() à chaque render (rule react-hooks/purity).
  const [form, setForm] = useState(() => ({
    code: "",
    name: "",
    type: "percentage",
    value: "10",
    minBookingAmount: "0",
    maxDiscount: "",
    validFrom: new Date().toISOString().slice(0, 10),
    validUntil: new Date(Date.now() + 90 * 86400_000).toISOString().slice(0, 10),
    maxUses: "",
  }));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // T-126 (P1) : garde miroir côté client (le serveur reste la source de
    // vérité via les .refine() Zod) pour éviter un aller-retour inutile.
    const valueNum = parseFloat(form.value);
    if (form.type === "percentage" && (!Number.isFinite(valueNum) || valueNum <= 0 || valueNum > 100)) {
      setError("Une remise en pourcentage doit être comprise entre 0 et 100.");
      return;
    }
    if (form.validFrom && form.validUntil && new Date(form.validUntil) <= new Date(form.validFrom)) {
      setError("La date de fin doit être postérieure à la date de début.");
      return;
    }

    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        code: form.code.toUpperCase().trim(),
        name: form.name.trim(),
        type: form.type,
        value: valueNum,
        validFrom: form.validFrom,
        validUntil: form.validUntil,
      };
      if (form.minBookingAmount) body.minBookingAmount = parseFloat(form.minBookingAmount);
      if (form.maxDiscount) body.maxDiscount = parseFloat(form.maxDiscount);
      if (form.maxUses) body.maxUses = parseInt(form.maxUses, 10);
      const res = await fetch("/api/promotions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      addToast("success", `Code ${form.code.toUpperCase()} créé`);
      router.push("/dashboard/promotions");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      addToast("error", e instanceof Error ? e.message : "Impossible de créer la promotion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="promo-code" className="block text-sm font-medium text-gray-700 mb-1">
            Code
          </label>
          <input
            id="promo-code"
            required
            value={form.code}
            onChange={(e) => set("code", e.target.value.toUpperCase())}
            pattern="[A-Z0-9_-]{3,50}"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
            placeholder="SUMMER2026"
          />
        </div>
        <div>
          <label htmlFor="promo-name" className="block text-sm font-medium text-gray-700 mb-1">
            Nom interne
          </label>
          <input
            id="promo-name"
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
            placeholder="Été 2026"
          />
        </div>
        <div>
          <label htmlFor="promo-type" className="block text-sm font-medium text-gray-700 mb-1">
            Type
          </label>
          <select
            id="promo-type"
            value={form.type}
            onChange={(e) => set("type", e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
          >
            <option value="percentage">Pourcentage (%)</option>
            <option value="fixed_amount">Montant fixe (€)</option>
          </select>
        </div>
        <div>
          <label htmlFor="promo-value" className="block text-sm font-medium text-gray-700 mb-1">
            Valeur
          </label>
          <input
            id="promo-value"
            required
            type="number"
            min="0"
            step="0.01"
            value={form.value}
            onChange={(e) => set("value", e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
          />
        </div>
        <div>
          <label htmlFor="promo-min" className="block text-sm font-medium text-gray-700 mb-1">
            Montant minimum (€)
          </label>
          <input
            id="promo-min"
            type="number"
            min="0"
            step="0.01"
            value={form.minBookingAmount}
            onChange={(e) => set("minBookingAmount", e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
          />
        </div>
        <div>
          <label htmlFor="promo-maxd" className="block text-sm font-medium text-gray-700 mb-1">
            Remise max (optionnel, €)
          </label>
          <input
            id="promo-maxd"
            type="number"
            min="0"
            step="0.01"
            value={form.maxDiscount}
            onChange={(e) => set("maxDiscount", e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
          />
        </div>
        <div>
          <label htmlFor="promo-from" className="block text-sm font-medium text-gray-700 mb-1">
            Valide du
          </label>
          <input
            id="promo-from"
            required
            type="date"
            value={form.validFrom}
            onChange={(e) => set("validFrom", e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
          />
        </div>
        <div>
          <label htmlFor="promo-until" className="block text-sm font-medium text-gray-700 mb-1">
            Valide jusqu&apos;au
          </label>
          <input
            id="promo-until"
            required
            type="date"
            value={form.validUntil}
            onChange={(e) => set("validUntil", e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
          />
        </div>
        <div>
          <label htmlFor="promo-maxuses" className="block text-sm font-medium text-gray-700 mb-1">
            Nombre max d&apos;utilisations (optionnel)
          </label>
          <input
            id="promo-maxuses"
            type="number"
            min="1"
            step="1"
            value={form.maxUses}
            onChange={(e) => set("maxUses", e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="px-6 py-3 bg-[#FF5A5F] text-white font-semibold rounded-lg hover:bg-[#e54a4f] disabled:opacity-50"
      >
        {loading ? "Création…" : "Créer le code"}
      </button>
    </form>
  );
}
