"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface RatePlan {
  id: string;
  name: string;
  type: string;
  discountPercentage: string | null;
  includesBreakfast: boolean | null;
  cancellationPolicy: string;
  cancellationFreeDays: number | null;
}

export function RatePlansSection({ roomId, initialRatePlans }: { roomId: string; initialRatePlans: RatePlan[] }) {
  const [plans, setPlans] = useState(initialRatePlans);
  const [form, setForm] = useState({ name: "", type: "flexible", discountPercentage: "0", includesBreakfast: false, cancellationPolicy: "flexible", cancellationFreeDays: "0" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/rooms/${roomId}/rate-plans`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          discountPercentage: Number(form.discountPercentage),
          includesBreakfast: form.includesBreakfast,
          cancellationPolicy: form.cancellationPolicy,
          cancellationFreeDays: Number(form.cancellationFreeDays),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Impossible de créer le tarif");
      setPlans((current) => [...current, body.ratePlan]);
      setForm({ name: "", type: "flexible", discountPercentage: "0", includesBreakfast: false, cancellationPolicy: "flexible", cancellationFreeDays: "0" });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Erreur"); }
    finally { setBusy(false); }
  }

  return (
    <section className="mt-8 border border-gray-200 rounded-xl p-5 bg-white">
      <h2 className="text-lg font-semibold text-gray-900">Plans tarifaires</h2>
      <p className="text-sm text-gray-600 mt-1">Les plans actifs seront proposés au voyageur et figés dans chaque réservation.</p>
      {plans.length > 0 && <ul className="mt-4 divide-y divide-gray-100">{plans.map((plan) => <li key={plan.id} className="py-3 text-sm"><strong>{plan.name}</strong> · -{plan.discountPercentage ?? "0"}% · {plan.cancellationPolicy}{plan.includesBreakfast ? " · petit-déjeuner inclus" : ""}</li>)}</ul>}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-sm">Nom<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full border rounded px-3 py-2" placeholder="Flexible petit-déjeuner" /></label>
        <label className="text-sm">Réduction (%)<input type="number" min="0" max="100" value={form.discountPercentage} onChange={(event) => setForm({ ...form, discountPercentage: event.target.value })} className="mt-1 w-full border rounded px-3 py-2" /></label>
        <label className="text-sm">Politique<select value={form.cancellationPolicy} onChange={(event) => setForm({ ...form, cancellationPolicy: event.target.value })} className="mt-1 w-full border rounded px-3 py-2"><option value="free">Gratuite</option><option value="flexible">Flexible</option><option value="moderate">Modérée</option><option value="strict">Stricte</option><option value="non_refundable">Non remboursable</option></select></label>
        <label className="text-sm">Jours annulation gratuite<input type="number" min="0" value={form.cancellationFreeDays} onChange={(event) => setForm({ ...form, cancellationFreeDays: event.target.value })} className="mt-1 w-full border rounded px-3 py-2" /></label>
        <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.includesBreakfast} onChange={(event) => setForm({ ...form, includesBreakfast: event.target.checked })} /> Petit-déjeuner inclus</label>
      </div>
      <div className="mt-4 flex items-center gap-3"><Button size="sm" onClick={add} disabled={busy || !form.name.trim()}>{busy ? "Création…" : "Ajouter le plan"}</Button>{error && <span className="text-sm text-red-600">{error}</span>}</div>
    </section>
  );
}
