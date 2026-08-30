"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, BellRing, Loader2 } from "lucide-react";
// T-154d (audit n°26, P2-8) : feedback global via ToastProvider.
import { useToast } from "@/components/ui/toast";

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
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const contextual = Boolean(checkIn && checkOut && Number.isInteger(numAdults) && Number.isInteger(numChildren));
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
        body: JSON.stringify({
          propertyId,
          maxPrice: n,
          currency,
          ...(contextual ? { checkIn, checkOut, numAdults, numChildren } : {}),
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setStatus("saved");
      addToast("success", `Alerte créée ✓ (max ${n} ${currency})`);
      setTimeout(() => {
        setOpen(false);
        setStatus("idle");
      }, 1500);
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Erreur");
      addToast("error", e instanceof Error ? e.message : "Impossible de créer l'alerte");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Bell className="w-4 h-4 mr-2" /> {contextual ? "Suivre le prix de ce séjour" : "Suivre le prix de base"}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 border border-gray-200 rounded-lg p-3 bg-white">
      <p className="text-xs text-gray-600 flex items-center gap-1">
        <BellRing className="w-3 h-3" /> M&apos;alerter si {contextual ? "le total des nuits de ce séjour (hors taxes)" : "le prix de base"} descend sous :
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
      {contextual && <p className="text-xs text-gray-500">Dates, voyageurs, stock et prix journalier seront vérifiés au moment de l&apos;alerte.</p>}
      {status === "saved" && <p className="text-xs text-green-600">Alerte créée ✓</p>}
      {status === "error" && error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
