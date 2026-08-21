"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, X as XIcon, Loader2 } from "lucide-react";

interface Alert {
  id: string;
  propertyId: string;
  maxPrice: string;
  currency: string;
  active: boolean;
  createdAt: string;
}

interface PropertyMeta {
  id: string;
  name: string;
  city: string;
}

interface Props {
  properties: PropertyMeta[]; // pour l'affichage lisible (id → nom)
}

/**
 * <PriceAlertsSection /> (T-030)
 * Liste + suppression des alertes prix de l'user courant.
 * Utilise GET/DELETE /api/price-alerts et /api/price-alerts/[id].
 * La création se fait depuis la fiche property (<PriceAlertButton />
 * ci-dessous).
 */
export function PriceAlertsSection({ properties }: Props) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const propNameById = new Map(properties.map((p) => [p.id, p]));

  async function refresh() {
    setLoading(true);
    try {
      const r = await fetch("/api/price-alerts");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setAlerts(j.alerts);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function remove(id: string) {
    if (!confirm("Supprimer cette alerte ?")) return;
    try {
      const r = await fetch(`/api/price-alerts/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Erreur");
      setAlerts((a) => a.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-[#1B3A6B]" />
          <CardTitle>Alertes prix</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
          </div>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-gray-500">
            Vous n&apos;avez pas encore d&apos;alerte prix. Cliquez sur
            « Suivre le prix » depuis la fiche d&apos;un hébergement.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {alerts.map((a) => {
              const p = propNameById.get(a.propertyId);
              return (
                <li key={a.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">
                      {p ? `${p.name} — ${p.city}` : a.propertyId.slice(0, 8) + "…"}
                    </p>
                    <p className="text-sm text-gray-500">
                      Alerte si le prix descend sous {parseFloat(a.maxPrice).toFixed(2)} {a.currency}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(a.id)}
                    aria-label="Supprimer l'alerte"
                  >
                    <XIcon className="w-4 h-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </CardContent>
    </Card>
  );
}
