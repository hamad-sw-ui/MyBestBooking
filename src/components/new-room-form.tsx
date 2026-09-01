"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useT } from "@/components/ui-locale-provider";

interface Props {
  properties: { id: string; name: string }[];
}

/**
 * <NewRoomForm /> (T-030) — formulaire client POST /api/rooms
 * (endpoint validé T-015). Champs obligatoires : propertyId, name,
 * roomType, maxOccupancy, maxAdults, basePrice, quantity.
 */
export function NewRoomForm({ properties }: Props) {
  const t = useT();
  const router = useRouter();
  const [form, setForm] = useState({
    propertyId: properties[0]?.id ?? "",
    name: "",
    description: "",
    roomType: "double",
    maxOccupancy: 2,
    maxAdults: 2,
    maxChildren: 0,
    sizeSqm: "",
    quantity: 1,
    basePrice: "",
    currency: "EUR",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.propertyId) { setError(t("room.needProperty")); return; }
    if (!form.name.trim()) { setError(t("room.nameRequired")); return; }
    if (!form.basePrice || parseFloat(form.basePrice) <= 0) { setError(t("room.invalidPrice")); return; }
    // T-129 : cohérence des capacités (même règle que l'API, retour immédiat).
    if (form.maxAdults > form.maxOccupancy) {
      setError(t("room.adultsExceed")); return;
    }
    if (form.maxAdults + form.maxChildren > form.maxOccupancy) {
      setError(t("room.occupancyExceed")); return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          propertyId: form.propertyId,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          roomType: form.roomType,
          maxOccupancy: form.maxOccupancy,
          maxAdults: form.maxAdults,
          maxChildren: form.maxChildren,
          sizeSqm: form.sizeSqm ? parseFloat(form.sizeSqm) : undefined,
          quantity: form.quantity,
          basePrice: parseFloat(form.basePrice),
          currency: form.currency,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? t("settings.error"));
      router.push("/dashboard/rooms");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.error"));
    } finally {
      setBusy(false);
    }
  }

  if (properties.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-gray-700">
{t("room.needPropertyFirst")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
<CardHeader><CardTitle>{t("room.details")}</CardTitle></CardHeader>
      <form onSubmit={submit}>
        <CardContent className="space-y-4">
          <div>
<label className="block text-sm font-medium text-gray-700 mb-1">{t("room.property")}</label>
            <select
              value={form.propertyId}
              onChange={(e) => set("propertyId", e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <Input
            label={t("room.name")}
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={t("room.namePlaceholder")}
            required
          />
          <div>
<label className="block text-sm font-medium text-gray-700 mb-1">{t("room.descOptional")}</label>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
<label className="block text-sm font-medium text-gray-700 mb-1">{t("room.type")}</label>
              <select
                value={form.roomType}
                onChange={(e) => set("roomType", e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
              >
<option value="single">{t("room.type.single")}</option>
                <option value="double">{t("room.type.double")}</option>
                <option value="twin">{t("room.type.twin")}</option>
                <option value="suite">{t("room.type.suite")}</option>
                <option value="studio">{t("room.type.studio")}</option>
<option value="family">{t("room.type.family")}</option>
<option value="dormitory">{t("room.type.dormitory")}</option>
              </select>
            </div>
<Input label={t("room.capacity")} type="number" min={1} max={20}
              value={form.maxOccupancy}
              onChange={(e) => set("maxOccupancy", parseInt(e.target.value, 10) || 1)}
            />
<Input label={t("room.size")} type="number" min={0}
              value={form.sizeSqm}
              onChange={(e) => set("sizeSqm", e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
<Input label={t("room.maxAdults")} type="number" min={1}
              value={form.maxAdults}
              onChange={(e) => set("maxAdults", parseInt(e.target.value, 10) || 1)}
            />
<Input label={t("room.maxChildren")} type="number" min={0}
              value={form.maxChildren}
              onChange={(e) => set("maxChildren", parseInt(e.target.value, 10) || 0)}
            />
<Input label={t("room.units")} type="number" min={1}
              value={form.quantity}
              onChange={(e) => set("quantity", parseInt(e.target.value, 10) || 1)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
<Input label={t("room.pricePerNight")} type="number" min={0.01} step={0.01}
                value={form.basePrice}
                onChange={(e) => set("basePrice", e.target.value)}
                required
              />
            </div>
            <div>
<label className="block text-sm font-medium text-gray-700 mb-1">{t("room.currency")}</label>
              <select
                value={form.currency}
                onChange={(e) => set("currency", e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="XAF">XAF</option>
                <option value="MAD">MAD</option>
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </CardContent>
        <CardFooter className="flex gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
{t("room.create")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push("/dashboard/rooms")}>
{t("action.cancel")}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
