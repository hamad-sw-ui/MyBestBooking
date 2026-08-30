"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

/**
 * <RowDeleteButton> (T-034) — icône corbeille pour supprimer un item
 * unique via l'API bulk (`POST /api/admin/bulk { action: "delete", ids: [id] }`).
 *
 * - Confirm() natif avant l'action
 * - Refresh() du serveur en cas de succès
 * - Message d'erreur si skipped[0] ou failed[0]
 * - État `busy` désactive le bouton pour éviter double-clic
 *
 * Props :
 *   entity: entité cible (users/properties/reviews/rooms/promotions)
 *   id: identifiant unique de la ligne
 *   label: description humaine pour le confirm (ex: "l'utilisateur alice@x.com")
 *   disabled: optionnel, désactive le bouton
 *   onDeleted: callback optionnel (avant refresh)
 */
export function RowDeleteButton(props: {
  entity: "users" | "properties" | "reviews" | "rooms" | "promotions";
  id: string;
  label: string;
  disabled?: boolean;
  onDeleted?: () => void;
  /** Une property conserve son historique : l’action est un archivage. */
  verb?: "Supprimer" | "Archiver";
}) {
  const { entity, id, label, disabled, onDeleted, verb = "Supprimer" } = props;
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (busy || disabled) return;
    const suffix = verb === "Archiver" ? "L'hébergement ne sera plus public, mais son historique sera conservé." : "Cette action est irréversible.";
    if (!window.confirm(`${verb} ${label} ? ${suffix}`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, action: "delete", ids: [id] }),
      });
      const body = (await res.json()) as
        | {
            requested: number;
            succeeded: number;
            skipped: Array<{ id: string; reason: string }>;
            failed: Array<{ id: string; error: string }>;
          }
        | { error: string };
      if (!res.ok) {
        setError(
          "error" in body
            ? `Erreur : ${body.error}`
            : "Erreur lors de la suppression.",
        );
        return;
      }
      const result = body as {
        succeeded: number;
        skipped: Array<{ id: string; reason: string }>;
        failed: Array<{ id: string; error: string }>;
      };
      if (result.succeeded === 1) {
        onDeleted?.();
        router.refresh();
        return;
      }
      if (result.skipped.length) {
        setError(`Ignoré : ${result.skipped[0].reason}`);
      } else if (result.failed.length) {
        setError(`Échec : ${result.failed[0].error}`);
      } else {
        setError("Suppression n'a rien renvoyé.");
      }
    } catch (e) {
      setError(`Erreur réseau : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || disabled}
        aria-label={`${verb} ${label}`}
        title={disabled ? `${verb} indisponible` : `${verb} ${label}`}
        className="p-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        data-testid={`row-delete-${entity}-${id}`}
      >
        <Trash2 className="w-4 h-4 text-red-600" />
      </button>
      {error && (
        <span
          role="alert"
          className="text-[10px] text-red-600 max-w-[180px] text-right leading-tight mt-1"
        >
          {error}
        </span>
      )}
    </div>
  );
}
