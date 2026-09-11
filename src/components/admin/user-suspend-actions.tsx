"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { useT } from "@/components/ui-locale-provider";

interface Props {
  userId: string;
  suspended: boolean;
  disabled?: boolean;
  /**
   * T-230 (A10) : un compte **supprimé** (anonymisé) n'est pas « suspendu » et
   * n'est pas réactivable. L'UI affiche l'état réel au lieu d'un bouton qui
   * échouerait en 409.
   */
  deleted?: boolean;
  /** T-231 (A11) : la 2FA active de ce compte peut être réinitialisée par le support. */
  twoFactorEnabled?: boolean;
}

/**
 * Bouton client Suspendre / Réactiver (T-021).
 * L'endpoint PATCH /api/users/[id]/suspend existe depuis T-016 mais
 * n'était branché à aucune UI. On complète.
 */
export function UserSuspendActions({ userId, suspended, disabled, deleted, twoFactorEnabled }: Props) {
  const t = useT();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resetting2fa, setResetting2fa] = useState(false);
  /** T-247 : motif saisi dans le dialogue avant la suspension effective. */
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);

  /**
   * T-231 (A11) : dernier recours support — l'utilisateur a perdu son
   * téléphone ET ses codes de secours. L'action révoque le facteur, coupe les
   * sessions et envoie un e-mail d'information (tracée `user.2fa.reset`).
   */
  function resetTwoFactor() {
    setError(null);
    if (!confirm(t("user.confirm2faReset"))) return;
    setResetting2fa(true);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/users/${userId}/two-factor/reset`, { method: "POST" });
        if (!res.ok) {
          const j = await res.json().catch(() => ({ error: t("settings.error") }));
          throw new Error(j.error || t("settings.error"));
        }
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("settings.error"));
      } finally {
        setResetting2fa(false);
      }
    });
  }

  /**
   * T-247 (audit n°5, A3) : la réactivation reste une confirmation simple ;
   * la suspension exige un motif saisi dans un dialogue accessible (l'API
   * accepte toujours un motif facultatif — aucune rupture de contrat).
   */
  function toggle() {
    setError(null);
    if (suspended) {
      if (!confirm(t("user.confirmToggle").replace("{verb}", t("user.verbReactivate")))) return;
      send(true, "");
      return;
    }
    setSuspendDialogOpen(true);
  }

  function send(nextSuspended: boolean, reason: string) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/users/${userId}/suspend`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            suspended: nextSuspended,
            ...(reason.trim() ? { reason: reason.trim() } : {}),
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({ error: t("settings.error") }));
          throw new Error(j.error || t("settings.error"));
        }
        setSuspendDialogOpen(false);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("settings.error"));
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {deleted ? (
        <span className="text-xs font-medium text-gray-500">{t("bulk.deletedNoReactivate")}</span>
      ) : (
        <Button
          size="sm"
          variant={suspended ? "outline" : "danger"}
          onClick={toggle}
          disabled={disabled || isPending}
        >
{isPending ? "…" : suspended ? t("bulk.reactivate") : t("bulk.suspend")}
        </Button>
      )}
      {twoFactorEnabled && !deleted && (
        <Button size="sm" variant="ghost" onClick={resetTwoFactor} disabled={disabled || resetting2fa}>
          {resetting2fa ? "…" : t("user.reset2fa")}
        </Button>
      )}
      {error && !suspendDialogOpen && <span className="text-xs text-red-600">{error}</span>}

      <ReasonDialog
        key={suspendDialogOpen ? "suspend-open" : "suspend-closed"}
        open={suspendDialogOpen}
        onClose={() => {
          setSuspendDialogOpen(false);
          setError(null);
        }}
        onConfirm={(reason) => send(false, reason)}
        actionLabel={t("bulk.suspend")}
        busy={isPending}
        error={suspendDialogOpen ? error : null}
      />
    </div>
  );
}
