"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useT, useUiLocale } from "@/components/ui-locale-provider";
import type { UiStringKey } from "@/lib/ui-strings";
import { AMENITIES } from "@/lib/amenities";
import { SUPPORTED_CURRENCIES } from "@/lib/i18n";

const ROOM_TYPES = ["single", "double", "twin", "suite", "studio", "family", "dormitory"] as const;
const BED_TYPES = ["single", "double", "queen", "king", "sofa_bed", "bunk"] as const;

export interface RoomEditValue {
  id: string;
  name: string;
  description: string | null;
  roomType: string;
  bedConfiguration: { type: string; count: number }[] | null;
  sizeSqm: number | null;
  basePrice: string;
  currency: string | null;
  quantity: number;
  maxOccupancy: number;
  maxAdults: number;
  maxChildren: number | null;
  amenities: string[] | null;
  isActive: boolean | null;
}

/**
 * T-226 (audit n°2, A6) — l'édition d'une chambre ne couvrait que 7 champs :
 * description, type, lits, surface, devise et équipements étaient acceptés par
 * `PUT /api/rooms/[id]` mais figés après création (seule la création les
 * exposait). Les nouveaux champs utilisent exactement le même contrat d'API
 * (aucune évolution serveur) et les mêmes règles de validation.
 */
export function RoomEditSection({ room }: { room: RoomEditValue }) {
  const t = useT();
  const locale = useUiLocale();
  const [form, setForm] = useState({
    name: room.name,
    description: room.description ?? "",
    roomType: room.roomType || "double",
    sizeSqm: room.sizeSqm != null ? String(room.sizeSqm) : "",
    basePrice: room.basePrice,
    currency: room.currency ?? "EUR",
    quantity: String(room.quantity),
    maxOccupancy: String(room.maxOccupancy),
    maxAdults: String(room.maxAdults),
    maxChildren: String(room.maxChildren ?? 0),
    amenities: room.amenities ?? [],
    beds: room.bedConfiguration ?? [],
    isActive: room.isActive ?? true,
  });
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function toggleAmenity(id: string) {
    setForm((f) => ({
      ...f,
      amenities: f.amenities.includes(id)
        ? f.amenities.filter((a) => a !== id)
        : [...f.amenities, id],
    }));
  }

  function updateBed(index: number, patch: { type?: string; count?: number }) {
    setForm((f) => ({
      ...f,
      beds: f.beds.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    }));
  }

  async function save() {
    setBusy(true); setStatus(null);
    try {
      const response = await fetch(`/api/rooms/${room.id}`, {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description.trim() || undefined,
          roomType: form.roomType,
          sizeSqm: form.sizeSqm === "" ? undefined : Number(form.sizeSqm),
          basePrice: Number(form.basePrice),
          currency: form.currency,
          quantity: Number(form.quantity),
          maxOccupancy: Number(form.maxOccupancy),
          maxAdults: Number(form.maxAdults),
          maxChildren: Number(form.maxChildren),
          amenities: form.amenities,
          // Les lits ne sont envoyés que s'ils sont renseignés : un tableau vide
          // est valide côté API mais effacerait une configuration existante
          // sans intention explicite de l'hôte.
          ...(form.beds.length ? { bedConfiguration: form.beds } : {}),
          isActive: form.isActive,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? t("room.saveFail"));
      setStatus(t("room.saved"));
    } catch (error) { setStatus(error instanceof Error ? error.message : t("settings.error")); }
    finally { setBusy(false); }
  }

  const bedTypes: { value: string; label: string }[] = BED_TYPES.map((value) => ({
    value,
    label: t(`room.bed.${value}` as UiStringKey),
  }));

  return (
    <section className="mt-8 border border-gray-200 rounded-xl p-5 bg-white">
      <h2 className="text-lg font-semibold text-gray-900">{t("room.details")}</h2>
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-sm md:col-span-2">{t("rate.name")}<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full border rounded px-3 py-2" /></label>
        <label className="text-sm">{t("room.basePrice")}<input type="number" min="0" step="0.01" value={form.basePrice} onChange={(event) => setForm({ ...form, basePrice: event.target.value })} className="mt-1 w-full border rounded px-3 py-2" /></label>
        <label className="text-sm md:col-span-2">{t("room.type")}
          <select value={form.roomType} onChange={(event) => setForm({ ...form, roomType: event.target.value })} className="mt-1 w-full border rounded px-3 py-2">
            {ROOM_TYPES.map((value) => <option key={value} value={value}>{t(`room.type.${value}` as UiStringKey)}</option>)}
          </select>
        </label>
        <label className="text-sm">{t("room.size")}<input type="number" min="0" step="1" value={form.sizeSqm} onChange={(event) => setForm({ ...form, sizeSqm: event.target.value })} className="mt-1 w-full border rounded px-3 py-2" /></label>
        <label className="text-sm md:col-span-3">{t("room.description")}
          <textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1 w-full border rounded px-3 py-2" />
        </label>
        <label className="text-sm">{t("room.currency")}
          <select value={form.currency} onChange={(event) => setForm({ ...form, currency: event.target.value })} className="mt-1 w-full border rounded px-3 py-2">
            {SUPPORTED_CURRENCIES.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="text-sm">{t("room.unitsShort")}<input type="number" min="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} className="mt-1 w-full border rounded px-3 py-2" /></label>
        <label className="text-sm">{t("room.capacity")}<input type="number" min="1" value={form.maxOccupancy} onChange={(event) => setForm({ ...form, maxOccupancy: event.target.value })} className="mt-1 w-full border rounded px-3 py-2" /></label>
        <label className="text-sm">{t("room.maxAdults")}<input type="number" min="1" value={form.maxAdults} onChange={(event) => setForm({ ...form, maxAdults: event.target.value })} className="mt-1 w-full border rounded px-3 py-2" /></label>
        <label className="text-sm">{t("room.maxChildren")}<input type="number" min="0" value={form.maxChildren} onChange={(event) => setForm({ ...form, maxChildren: event.target.value })} className="mt-1 w-full border rounded px-3 py-2" /></label>
        <div className="text-sm flex items-end">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> {t("room.forSale")}
          </label>
        </div>
      </div>

      {/* Literie : liste type + nombre (jsonb `bed_configuration`). */}
      <div className="mt-6 border-t border-gray-100 pt-4">
        <h3 className="text-sm font-semibold text-gray-900">{t("room.beds")}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{t("room.bedsHint")}</p>
        <div className="mt-2 space-y-2">
          {form.beds.map((bed, index) => (
            <div key={index} className="flex items-center gap-2">
              <select
                aria-label={t("room.bedType")}
                value={bed.type}
                onChange={(event) => updateBed(index, { type: event.target.value })}
                className="border rounded px-3 py-2 text-sm"
              >
                {bedTypes.map((bt) => <option key={bt.value} value={bt.value}>{bt.label}</option>)}
              </select>
              <input
                type="number" min="1" max="20" aria-label={t("room.bedCount")}
                value={bed.count}
                onChange={(event) => updateBed(index, { count: Math.max(1, parseInt(event.target.value, 10) || 1) })}
                className="w-20 border rounded px-3 py-2 text-sm"
              />
              <Button
                type="button" size="sm" variant="ghost"
                onClick={() => setForm((f) => ({ ...f, beds: f.beds.filter((_, i) => i !== index) }))}
              >
                {t("room.bedRemove")}
              </Button>
            </div>
          ))}
          <Button
            type="button" size="sm" variant="outline"
            onClick={() => setForm((f) => ({ ...f, beds: [...f.beds, { type: "double", count: 1 }] }))}
          >
            {t("room.bedAdd")}
          </Button>
        </div>
      </div>

      {/* Équipements : source unique `src/lib/amenities.ts` (mêmes ids que la recherche). */}
      <div className="mt-6 border-t border-gray-100 pt-4">
        <h3 className="text-sm font-semibold text-gray-900">{t("room.amenities")}</h3>
        <p className="text-xs text-gray-500 mt-0.5">{t("room.amenitiesHint")}</p>
        <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
          {AMENITIES.map((amenity) => (
            <label key={amenity.id} className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.amenities.includes(amenity.id)}
                onChange={() => toggleAmenity(amenity.id)}
              />
              {locale === "en" ? amenity.labelEn : amenity.label}
            </label>
          ))}
        </div>
      </div>

      <div className="mt-4 flex gap-3 items-center">
        <Button size="sm" onClick={save} disabled={busy}>{busy ? t("settings.saving") : t("room.save")}</Button>
        {status && <span className="text-sm text-gray-600" role="status">{status}</span>}
      </div>
    </section>
  );
}
