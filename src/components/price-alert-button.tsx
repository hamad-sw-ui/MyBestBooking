"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, BellRing, Loader2 } from "lucide-react";

interface Props {
  propertyId: string;
  currency?: string;
  defaultMax?: number;
  checkIn?: string;
  checkOut?: string;
  numAdults?: number;
  numChildren?: number;
}

/**
 * <PriceAlertButton /> (T-030)
 * Petit widget sur fiche property : ouvre un mini-formulaire pour
 * définir un prix max, POST /api/price-alerts. Feedback in-place.
 */
export function PriceAlertButton({ propertyId, currency = "EUR", defaultMax = 100, checkIn, checkOut, numAdults, numChildren }: Props) {
  const [open, setOpen] = useState(false);
  const [maxPrice, setMaxPrice] = useState(String(defaultMax));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const n = parseFloat(maxPrice);
    if (!Number.isFinite(n) || n <= 0) {
      setError("Prix invalide");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/price-alerts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ propertyId, maxPrice: n, currency, checkIn: checkIn || undefined, checkOut: checkOut || undefined, numAdults, numChildren }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setStatus("saved");
      setTimeout(() => {
        setOpen(false);
        setStatus("idle");
      }, 1500);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Bell className="w-4 h-4 mr-2" /> Suivre le prix de base
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 border border-gray-200 rounded-lg p-3 bg-white">
      <p className="text-xs text-gray-600 flex items-center gap-1">
        <BellRing className="w-3 h-3" /> M&apos;alerter si le prix de base descend sous :
      </p>
      <div className="flex gap-2 items-end">
        <Input
          type="number"
          min={1}
          value={maxPrice}
          onChange={(e) => setMaxPrice(e.target.value)}
          aria-label="Prix maximum"
          className="w-32"
        />
        <span className="text-sm text-gray-600 pb-2">{currency}</span>
        <Button size="sm" onClick={save} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Annuler
        </Button>
      </div>
      {status === "saved" && <p className="text-xs text-green-600">Alerte créée ✓</p>}
      {status === "error" && error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
