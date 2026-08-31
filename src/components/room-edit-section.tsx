"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/ui-locale-provider";

export function RoomEditSection({ room }: { room: { id: string; name: string; basePrice: string; quantity: number; maxOccupancy: number; maxAdults: number; maxChildren: number | null; isActive: boolean | null } }) {
  const t = useT();
  const [form, setForm] = useState({ name: room.name, basePrice: room.basePrice, quantity: String(room.quantity), maxOccupancy: String(room.maxOccupancy), maxAdults: String(room.maxAdults), maxChildren: String(room.maxChildren ?? 0), isActive: room.isActive ?? true });
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setStatus(null);
    try {
      const response = await fetch(`/api/rooms/${room.id}`, {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: form.name, basePrice: Number(form.basePrice), quantity: Number(form.quantity), maxOccupancy: Number(form.maxOccupancy), maxAdults: Number(form.maxAdults), maxChildren: Number(form.maxChildren), isActive: form.isActive }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? t("room.saveFail"));
      setStatus(t("room.saved"));
    } catch (error) { setStatus(error instanceof Error ? error.message : t("settings.error")); }
    finally { setBusy(false); }
  }

  return (
    <section className="mt-8 border border-gray-200 rounded-xl p-5 bg-white">
<h2 className="text-lg font-semibold text-gray-900">{t("room.details")}</h2>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
<label className="text-sm md:col-span-2">{t("rate.name")}<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full border rounded px-3 py-2" /></label>
<label className="text-sm">{t("room.basePrice")}<input type="number" min="0" step="0.01" value={form.basePrice} onChange={(event) => setForm({ ...form, basePrice: event.target.value })} className="mt-1 w-full border rounded px-3 py-2" /></label>
<label className="text-sm">{t("room.unitsShort")}<input type="number" min="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} className="mt-1 w-full border rounded px-3 py-2" /></label>
<label className="text-sm">{t("room.capacity")}<input type="number" min="1" value={form.maxOccupancy} onChange={(event) => setForm({ ...form, maxOccupancy: event.target.value })} className="mt-1 w-full border rounded px-3 py-2" /></label>
<label className="text-sm">{t("room.maxAdults")}<input type="number" min="1" value={form.maxAdults} onChange={(event) => setForm({ ...form, maxAdults: event.target.value })} className="mt-1 w-full border rounded px-3 py-2" /></label>
<label className="text-sm">{t("room.maxChildren")}<input type="number" min="0" value={form.maxChildren} onChange={(event) => setForm({ ...form, maxChildren: event.target.value })} className="mt-1 w-full border rounded px-3 py-2" /></label>
<label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> {t("room.forSale")}</label>
      </div>
      <div className="mt-4 flex gap-3 items-center"><Button size="sm" onClick={save} disabled={busy}>{busy ? t("settings.saving") : t("room.save")}</Button>{status && <span className="text-sm text-gray-600">{status}</span>}</div>
    </section>
  );
}
