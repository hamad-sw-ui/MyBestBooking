"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/ui-locale-provider";

interface Props {
  propertyId: string;
  currentStatus: string | null;
}

/**
 * <PropertySubmitButton /> (T-137, A2)
 *
 * Bouton hôte « Soumettre pour validation ». Appelle
 * POST /api/properties/[id]/submit qui fait passer une annonce `draft`
 * (rejetée/brouillon) ou `suspended` vers `pending`.
 *
 * Il comble l'impasse du parcours de modération : après un rejet admin,
 * l'hôte n'avait aucun moyen de remettre son annonce en attente (le
 * changement de statut générique est réservé à l'admin → 403). Le bouton
 * ne s'affiche que dans les états qui autorisent une (re)soumission.
 */
export function PropertySubmitButton({ propertyId, currentStatus }: Props) {
  const t = useT();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submittable = currentStatus === "draft" || currentStatus === "suspended";
  if (!submittable) return null;

  async function submit() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/properties/${propertyId}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t("prop.submitFail"));
      setDone(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.error"));
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button onClick={submit} loading={loading} disabled={done}>
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
{done ? t("prop.submitted") : t("prop.submit")}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
