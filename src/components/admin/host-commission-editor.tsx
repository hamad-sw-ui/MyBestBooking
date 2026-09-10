"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/ui-locale-provider";
import { useToast } from "@/components/ui/toast";

interface Props {
  userId: string;
  /** Taux hôte (`null` = hérite du taux global). */
  commissionRate: string | null;
  /** Taux global courant (`settings.billing.defaultCommissionRate`). */
  globalRate: number;
  /** Nombre d'hébergements sans taux explicite (héritent du taux hôte). */
  inheritCount: number;
  /** Nombre d'hébergements portant un taux explicite (non impactés sans propagation). */
  explicitCount: number;
  disabled?: boolean;
}

/**
 * T-215 — édition du pourcentage de commission **d'un hôte** par l'admin,
 * depuis la page Utilisateurs, quel que soit son statut d'approbation.
 *
 * S'appuie sur l'action additive `updateCommission` de
 * `PATCH /api/admin/hosts/[id]` : l'approbation/rejet (T-202) n'est pas
 * touchée. Le champ vide signifie « hériter » → `commissionRate: null`.
 *
 * L'impact réel est affiché avant l'enregistrement : la priorité
 * **propriété > hôte > global** fait que seuls les hébergements sans taux
 * explicite suivent le taux hôte, sauf propagation explicite demandée.
 */
export function HostCommissionEditor({
  userId,
  commissionRate,
  globalRate,
  inheritCount,
  explicitCount,
  disabled = false,
}: Props) {
  const t = useT();
  const router = useRouter();
  const { addToast } = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(commissionRate ?? "");
  const [applyToInherited, setApplyToInherited] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inherits = commissionRate === null;
  const label = inherits
    ? t("dash.hostCommissionInherit").replace("{rate}", String(globalRate))
    : `${commissionRate} %`;

  function submit() {
    setError(null);
    const raw = value.trim();
    const parsed = raw === "" ? null : Number(raw.replace(",", "."));
    if (parsed !== null && (!Number.isFinite(parsed) || parsed < 0 || parsed > 100)) {
      setError(t("dash.hostCommissionInvalid"));
      return;
    }

    startTransition(async () => {
      try {
        const body: Record<string, unknown> = {
          action: "updateCommission",
          commissionRate: parsed,
        };
        if (parsed !== null && applyToInherited) body.applyTo = "inherited";

        const res = await fetch(`/api/admin/hosts/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload.error ?? t("settings.error"));

        // Le champ a été vidé → retour à l'héritage global.
        const stored = payload?.host?.commissionRate ?? null;
        addToast(
          "success",
          stored === null
            ? t("dash.hostCommissionResetDone")
            : t("dash.hostCommissionUpdated").replace("{rate}", String(stored)),
        );
        if (payload?.propertiesUpdated > 0) {
          addToast(
            "success",
            t("dash.hostCommissionApplied").replace("{n}", String(payload.propertiesUpdated)),
          );
        }
        setEditing(false);
        setApplyToInherited(false);
        router.refresh();
      } catch (submitError) {
        const message = submitError instanceof Error ? submitError.message : t("settings.error");
        setError(message);
        addToast("error", message);
      }
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1.5">
        <span
          className="text-xs text-gray-500"
          title={
            explicitCount > 0
              ? t("dash.hostCommissionImpact")
                  .replace("{inherit}", String(inheritCount))
                  .replace("{explicit}", String(explicitCount))
              : undefined
          }
        >
          {label}
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setValue(commissionRate ?? "");
            setError(null);
            setEditing(true);
          }}
          className="p-1 rounded-md text-gray-400 hover:text-[#1B3A6B] hover:bg-gray-100 transition-colors disabled:opacity-30"
          title={t("dash.hostCommissionEdit")}
          aria-label={t("dash.hostCommissionEdit")}
        >
          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={0}
          max={100}
          step={0.01}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={String(globalRate)}
          aria-label={t("dash.hostCommission")}
          aria-invalid={error !== null}
          disabled={pending}
          className="w-20 px-2 py-1 text-xs border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-[#1B3A6B] disabled:bg-gray-50"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={submit}
          disabled={pending || disabled}
          title={t("dash.hostCommissionSave")}
          aria-label={t("dash.hostCommissionSave")}
          className="text-green-700 hover:bg-green-50 px-2"
        >
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          disabled={pending}
          title={t("action.cancel")}
          aria-label={t("action.cancel")}
          className="px-2"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {inheritCount > 0 && value.trim() !== "" && (
        <label className="flex items-center gap-1.5 text-[10px] text-gray-500">
          <input
            type="checkbox"
            checked={applyToInherited}
            onChange={(event) => setApplyToInherited(event.target.checked)}
            disabled={pending}
            className="w-3 h-3 rounded border-gray-300 text-[#1B3A6B] focus:ring-[#1B3A6B]"
          />
          {t("dash.hostCommissionApplyInherited").replace("{n}", String(inheritCount))}
        </label>
      )}

      <span className="text-[10px] text-gray-400">
        {t("dash.hostCommissionImpact")
          .replace("{inherit}", String(inheritCount))
          .replace("{explicit}", String(explicitCount))}
      </span>

      {error && (
        <span className="text-xs text-red-600" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
