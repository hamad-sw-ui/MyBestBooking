"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
// T-154d (audit n°26, P2-8) : feedback global via ToastProvider.
import { useToast } from "@/components/ui/toast";
import { formatPrice } from "@/lib/utils";
import { cancellationPolicyLabel } from "@/lib/cancellation-label";
import { useT, useUiLocale } from "@/components/ui-locale-provider";
import type { UiStringKey } from "@/lib/ui-strings";

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

function ratePlanTypeLabel(type: string, t: (key: UiStringKey) => string): string {
  switch (type) {
    case "flexible": return t("settings.policyFlexible");
    case "non_refundable": return t("settings.policyNonRefundable");
    case "early_bird": return t("rate.earlyBird");
    case "long_stay": return t("rate.longStay");
    default: return type;
  }
}

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
export function RatePlansSection({ roomId, basePrice, initialRatePlans, currency = "EUR" }: { roomId: string; basePrice: string; initialRatePlans: RatePlan[]; /** T-154e/P3-9 : devise de la chambre pour l'aperçu (plus de montant nu). */ currency?: string | null }) {
  const t = useT();
  const locale = useUiLocale();
  const { addToast } = useToast();
  const [plans, setPlans] = useState(initialRatePlans);
  const [form, setForm] = useState<RatePlanForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = Number(basePrice);
  /** Devise résolue (jamais null) pour tous les formats. */
  const ccy = currency ?? "EUR";
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
      if (!response.ok) throw new Error(body.error ?? t("rate.failToggle"));
      setPlans((current) => current.map((plan) => plan.id === id ? body.ratePlan : plan));
      addToast("success", isActive ? t("rate.toastOn") : t("rate.toastOff"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("settings.error")); addToast("error", reason instanceof Error ? reason.message : t("settings.error")); }
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
      if (!response.ok) throw new Error(body.error ?? t("rate.failSave"));
      setPlans((current) => editingId
        ? current.map((plan) => plan.id === editingId ? body.ratePlan : plan)
        : [...current, body.ratePlan]);
      resetForm();
      addToast("success", editingId ? t("rate.toastEdited") : t("rate.toastCreated"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("settings.error")); addToast("error", reason instanceof Error ? reason.message : t("settings.error")); }
    finally { setBusy(false); }
  }

  return (
    <section className="mt-8 border border-gray-200 rounded-xl p-5 bg-white">
<h2 className="text-lg font-semibold text-gray-900">{t("rate.title")}</h2>
      <p className="text-sm text-gray-600 mt-1">{t("rate.body")}</p>
      {plans.length > 0 && <ul className="mt-4 divide-y divide-gray-100">{plans.map((plan) => <li key={plan.id} className="py-3 text-sm flex flex-wrap items-center justify-between gap-2"><span><strong>{plan.name}</strong> · {ratePlanTypeLabel(plan.type, t)} · -{plan.discountPercentage ?? "0"}% · {cancellationPolicyLabel(plan.cancellationPolicy, t)}{plan.includesBreakfast ? t("rate.breakfastIncl") : ""} {(plan.cancellationFreeDays ?? 0) > 0 ? t("rate.freeCancelDays").replace("{n}", String(plan.cancellationFreeDays)) : ""} {!plan.isActive && t("rate.archived")}</span><span className="flex gap-1"><Button size="sm" variant="ghost" disabled={busy} onClick={() => { setEditingId(plan.id); setForm(formFor(plan)); setError(null); }}>{t("rate.edit")}</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => setActive(plan.id, !plan.isActive)}>{plan.isActive ? t("rate.archive") : t("rate.reactivate")}</Button></span></li>)}</ul>}
      <div className="mt-5 border-t pt-4">
        <h3 className="font-medium text-gray-900">{editingId ? t("rate.editPlan") : t("rate.addPlan")}</h3>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">{t("rate.name")}<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full border rounded px-3 py-2" placeholder={t("rate.breakfast")} /></label>
          <label className="text-sm">{t("rate.type")}<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="mt-1 w-full border rounded px-3 py-2">{!["flexible", "non_refundable", "early_bird", "long_stay"].includes(form.type) && <option value={form.type}>{t("rate.historic").replace("{type}", form.type)}</option>}<option value="flexible">{t("settings.policyFlexible")}</option><option value="non_refundable">{t("settings.policyNonRefundable")}</option><option value="early_bird">{t("rate.earlyBird")}</option><option value="long_stay">{t("rate.longStay")}</option></select></label>
          <label className="text-sm">{t("rate.discount")}<input type="number" min="0" max="100" step="0.01" value={form.discountPercentage} onChange={(event) => setForm({ ...form, discountPercentage: event.target.value })} className="mt-1 w-full border rounded px-3 py-2" /></label>
          <label className="text-sm">{t("rate.cancelPolicy")}<select value={form.cancellationPolicy} onChange={(event) => setForm({ ...form, cancellationPolicy: event.target.value })} className="mt-1 w-full border rounded px-3 py-2"><option value="free">{t("settings.policyFree")}</option><option value="flexible">{t("settings.policyFlexible")}</option><option value="moderate">{t("settings.policyModerate")}</option><option value="strict">{t("settings.policyStrict")}</option><option value="non_refundable">{t("settings.policyNonRefundable")}</option></select></label>
          <label className="text-sm">{t("rate.freeCancelDaysLabel")}<input type="number" min="0" max="365" value={form.cancellationFreeDays} onChange={(event) => setForm({ ...form, cancellationFreeDays: event.target.value })} className="mt-1 w-full border rounded px-3 py-2" /></label>
          <label className="inline-flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={form.includesBreakfast} onChange={(event) => setForm({ ...form, includesBreakfast: event.target.checked })} /> {t("rate.breakfast")}</label>
        </div>
        <p className="mt-3 rounded bg-blue-50 p-3 text-sm text-blue-900">{Number.isFinite(base) ? t("rate.preview").replace("{from}", formatPrice(base, ccy, locale)).replace("{to}", formatPrice(preview, ccy, locale)) : t("rate.previewUnavailable")}</p>
        <div className="mt-4 flex flex-wrap items-center gap-3"><Button size="sm" onClick={save} disabled={busy || !form.name.trim()}>{busy ? t("settings.saving") : editingId ? t("rate.saveChanges") : t("rate.addCta")}</Button>{editingId && <Button size="sm" variant="ghost" onClick={resetForm} disabled={busy}>{t("action.cancel")}</Button>}{error && <span role="alert" className="text-sm text-red-600">{error}</span>}</div>
      </div>
    </section>
  );
}
