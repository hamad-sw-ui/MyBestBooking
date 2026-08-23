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
  isActive: boolean | null;
}

type RatePlanForm = {
  name: string;
  type: string;
  discountPercentage: string;
  includesBreakfast: boolean;
  cancellationPolicy: string;
  cancellationFreeDays: string;
};

const EMPTY_FORM: RatePlanForm = {
  name: "",
  type: "flexible",
  discountPercentage: "0",
  includesBreakfast: false,
  cancellationPolicy: "flexible",
  cancellationFreeDays: "0",
};

function formFor(plan: RatePlan): RatePlanForm {
  return {
    name: plan.name,
    type: plan.type || "flexible",
    discountPercentage: plan.discountPercentage ?? "0",
    includesBreakfast: Boolean(plan.includesBreakfast),
    cancellationPolicy: plan.cancellationPolicy,
    cancellationFreeDays: String(plan.cancellationFreeDays ?? 0),
  };
}

/** Plans éditables sans modifier les snapshots des réservations historiques. */
export function RatePlansSection({ roomId, basePrice, initialRatePlans }: { roomId: string; basePrice: string; initialRatePlans: RatePlan[] }) {
  const [plans, setPlans] = useState(initialRatePlans);
  const [form, setForm] = useState<RatePlanForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = Number(basePrice);
  const discount = Number(form.discountPercentage) || 0;
  const preview = Math.max(0, base * (1 - discount / 100));

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function setActive(id: string, isActive: boolean) {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/rooms/${roomId}/rate-plans`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, isActive }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Impossible de modifier le plan");
      setPlans((current) => current.map((plan) => plan.id === id ? body.ratePlan : plan));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Erreur"); }
    finally { setBusy(false); }
  }

  async function save() {
    setBusy(true); setError(null);
    const payload = {
      name: form.name.trim(),
      type: form.type,
      discountPercentage: Number(form.discountPercentage),
      includesBreakfast: form.includesBreakfast,
      cancellationPolicy: form.cancellationPolicy,
      cancellationFreeDays: Number(form.cancellationFreeDays),
    };
    try {
      const response = await fetch(`/api/rooms/${roomId}/rate-plans`, {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Impossible d'enregistrer le tarif");
      setPlans((current) => editingId
        ? current.map((plan) => plan.id === editingId ? body.ratePlan : plan)
        : [...current, body.ratePlan]);
      resetForm();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Erreur"); }
    finally { setBusy(false); }
  }

  return (
    <section className="mt-8 border border-gray-200 rounded-xl p-5 bg-white">
      <h2 className="text-lg font-semibold text-gray-900">Plans tarifaires</h2>
      <p className="text-sm text-gray-600 mt-1">Les plans actifs sont proposés au voyageur. Chaque réservation conserve un snapshot : modifier ce formulaire ne réécrit jamais l&apos;historique vendu.</p>
      {plans.length > 0 && <ul className="mt-4 divide-y divide-gray-100">{plans.map((plan) => <li key={plan.id} className="py-3 text-sm flex flex-wrap items-center justify-between gap-2"><span><strong>{plan.name}</strong> · {plan.type} · -{plan.discountPercentage ?? "0"}% · {plan.cancellationPolicy}{plan.includesBreakfast ? " · petit-déjeuner inclus" : ""} {(plan.cancellationFreeDays ?? 0) > 0 ? ` · annulation gratuite ${plan.cancellationFreeDays} j` : ""} {!plan.isActive && "· archivé"}</span><span className="flex gap-1"><Button size="sm" variant="ghost" disabled={busy} onClick={() => { setEditingId(plan.id); setForm(formFor(plan)); setError(null); }}>Modifier</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => setActive(plan.id, !plan.isActive)}>{plan.isActive ? "Archiver" : "Réactiver"}</Button></span></li>)}</ul>}
      <div className="mt-5 border-t pt-4">
        <h3 className="font-medium text-gray-900">{editingId ? "Modifier le plan" : "Ajouter un plan"}</h3>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">Nom<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full border rounded px-3 py-2" placeholder="Flexible petit-déjeuner" /></label>
          <label className="text-sm">Type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="mt-1 w-full border rounded px-3 py-2">{!["flexible", "non_refundable", "early_bird", "long_stay"].includes(form.type) && <option value={form.type}>{form.type} (historique)</option>}<option value="flexible">Flexible</option><option value="non_refundable">Non remboursable</option><option value="early_bird">Réservation anticipée</option><option value="long_stay">Long séjour</option></select></label>
          <label className="text-sm">Réduction (%)<input type="number" min="0" max="100" step="0.01" value={form.discountPercentage} onChange={(event) => setForm({ ...form, discountPercentage: event.target.value })} className="mt-1 w-full border rounded px-3 py-2" /></label>
          <label className="text-sm">Politique d&apos;annulation<select value={form.cancellationPolicy} onChange={(event) => setForm({ ...form, cancellationPolicy: event.target.value })} className="mt-1 w-full border rounded px-3 py-2"><option value="free">Gratuite</option><option value="flexible">Flexible</option><option value="moderate">Modérée</option><option value="strict">Stricte</option><option value="non_refundable">Non remboursable</option></select></label>
          <label className="text-sm">Jours d&apos;annulation gratuite<input type="number" min="0" max="365" value={form.cancellationFreeDays} onChange={(event) => setForm({ ...form, cancellationFreeDays: event.target.value })} className="mt-1 w-full border rounded px-3 py-2" /></label>
          <label className="inline-flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={form.includesBreakfast} onChange={(event) => setForm({ ...form, includesBreakfast: event.target.checked })} /> Petit-déjeuner inclus</label>
        </div>
        <p className="mt-3 rounded bg-blue-50 p-3 text-sm text-blue-900">Aperçu sur le prix de base actuel : {Number.isFinite(base) ? `${base.toFixed(2)} → ${preview.toFixed(2)} par nuit avant taxes, promos et wallet.` : "prix de base indisponible."}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3"><Button size="sm" onClick={save} disabled={busy || !form.name.trim()}>{busy ? "Enregistrement…" : editingId ? "Enregistrer les modifications" : "Ajouter le plan"}</Button>{editingId && <Button size="sm" variant="ghost" onClick={resetForm} disabled={busy}>Annuler</Button>}{error && <span role="alert" className="text-sm text-red-600">{error}</span>}</div>
      </div>
    </section>
  );
}
