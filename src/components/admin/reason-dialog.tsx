"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/ui-locale-provider";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Valide l'action avec le motif saisi (déjà `trim()`). */
  onConfirm: (reason: string) => void;
  /** Libellé du bouton d'action (« Refuser », « Suspendre », …). */
  actionLabel: string;
  /** Utilise la variante rouge (actions destructives). */
  destructive?: boolean;
  /** Longueur maximale acceptée, alignée sur la validation serveur. */
  maxLength?: number;
  busy?: boolean;
  /** Erreur renvoyée par l'API, affichée dans le dialogue. */
  error?: string | null;
}

/**
 * T-247 (audit n°5, A3) — saisie **obligatoire** d'un motif de décision
 * (refus, masquage, suspension d'annonce ou de compte).
 *
 * Remplace `window.prompt` : le libellé, le compteur de caractères et le
 * bouton désactivé tant que le motif est vide sont explicites, et la validation
 * serveur (motif requis pour `hidden`/`rejected`) devient impossible à rater.
 */
export function ReasonDialog({
  open,
  onClose,
  onConfirm,
  actionLabel,
  destructive = true,
  maxLength = 500,
  busy = false,
  error = null,
}: Props) {
  const t = useT();
  // Le motif repart d'un champ vide à chaque ouverture : l'appelant remonte le
  // dialogue (`key={action}`) — pas d'état résiduel d'une action précédente,
  // et pas de `setState` dans un effet (règle react-hooks du dépôt).
  const [reason, setReason] = useState("");

  const trimmed = reason.trim();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("dialog.reason.title").replace("{action}", actionLabel)}
      description={t("dialog.reason.hint")}
      closeLabel={t("action.close")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("action.cancel")}
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={() => onConfirm(trimmed)}
            disabled={busy || trimmed.length === 0}
          >
            {actionLabel}
          </Button>
        </>
      }
    >
      <label className="sr-only" htmlFor="reason-dialog-input">
        {t("dialog.reason.label")}
      </label>
      <textarea
        id="reason-dialog-input"
        value={reason}
        onChange={(event) => setReason(event.target.value.slice(0, maxLength))}
        rows={3}
        maxLength={maxLength}
        placeholder={t("dialog.reason.placeholder")}
        className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-[#1B3A6B] focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
      />
      <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
        <span>{t("dialog.reason.required")}</span>
        <span aria-live="polite">
          {trimmed.length}/{maxLength}
        </span>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </Dialog>
  );
}
