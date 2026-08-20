"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Props {
  userId: string;
  suspended: boolean;
  disabled?: boolean;
}

/**
 * Bouton client Suspendre / Réactiver (T-021).
 * L'endpoint PATCH /api/users/[id]/suspend existe depuis T-016 mais
 * n'était branché à aucune UI. On complète.
 */
export function UserSuspendActions({ userId, suspended, disabled }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function toggle() {
    setError(null);
    const label = suspended ? "réactiver" : "suspendre";
    if (!confirm(`Confirmer ${label} cet utilisateur ?`)) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/users/${userId}/suspend`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suspended: !suspended }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({ error: "Erreur" }));
          throw new Error(j.error || "Erreur");
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={suspended ? "outline" : "danger"}
        onClick={toggle}
        disabled={disabled || isPending}
      >
        {isPending ? "…" : suspended ? "Réactiver" : "Suspendre"}
      </Button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
