"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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

  function toggle() {
    setError(null);
    const label = suspended ? t("user.verbReactivate") : t("user.verbSuspend");
    if (!confirm(t("user.confirmToggle").replace("{verb}", label))) return;
    const reason = suspended ? "" : window.prompt(t("user.suspendReasonPrompt")) ?? null;
    if (reason === null) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/users/${userId}/suspend`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ suspended: !suspended, ...(reason.trim() ? { reason: reason.trim() } : {}) }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({ error: t("settings.error") }));
          throw new Error(j.error || t("settings.error"));
        }
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
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
