"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { useT } from "@/components/ui-locale-provider";

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
  verb?: "delete" | "archive" | "Supprimer" | "Archiver";
}) {
  const { entity, id, label, disabled, onDeleted, verb = "delete" } = props;
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isArchive = verb === "archive" || verb === "Archiver";
  const verbLabel = isArchive ? t("bulk.archive") : t("bulk.delete");

  async function handleClick() {
    if (busy || disabled) return;
    const suffix = isArchive ? t("bulk.archiveKeepHistory") : t("bulk.deleteIrreversible");
    const confirmText = `${t("bulk.confirmVerb").replace("{verb}", verbLabel).replace("{label}", label)} ${suffix}`;
    if (!window.confirm(confirmText)) {
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
            ? t("bulk.errorPrefix").replace("{msg}", body.error)
            : t("bulk.deleteError"),
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
        setError(t("bulk.ignored").replace("{msg}", result.skipped[0].reason));
      } else if (result.failed.length) {
        setError(t("bulk.failedPrefix").replace("{msg}", result.failed[0].error));
      } else {
        setError(t("bulk.deleteEmpty"));
      }
    } catch (e) {
      setError(t("bulk.networkError").replace("{msg}", e instanceof Error ? e.message : String(e)));
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
        aria-label={`${verbLabel} ${label}`}
        title={disabled ? t("bulk.unavailable").replace("{verb}", verbLabel) : `${verbLabel} ${label}`}
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
