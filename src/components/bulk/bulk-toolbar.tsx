"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, CheckSquare, Square, Trash2, Check, Eye, EyeOff, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * <BulkToolbar> (T-033, Session 12) — barre d'outils pour un dashboard
 * avec filtres + sélection multiple + actions groupées.
 *
 * Utilisation :
 *   <BulkToolbar
 *     entity="users"
 *     actions={[{ key: "suspend", label: "Suspendre", icon: <XCircle /> }]}
 *     selectedIds={[...]}
 *     onClear={...}
 *     searchValue={q}
 *     onSearchChange={setQ}
 *     statusOptions={[{ value: "all", label: "Tous" }, ...]}
 *     statusValue={status}
 *     onStatusChange={setStatus}
 *   />
 *
 * Raccourcis clavier globaux :
 *   /       — focus barre recherche
 *   Escape  — vider sélection / annuler focus
 *   Ctrl+A  — sélectionner tout (custom event bulk:selectAll)
 *   Ctrl+D  — désélectionner tout (custom event bulk:deselectAll)
 */

export interface BulkAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  variant?: "primary" | "danger" | "secondary";
  confirmMessage?: string;
}

export interface StatusOption {
  value: string;
  label: string;
}

interface Props {
  entity:
    | "users"
    | "properties"
    | "reviews"
    | "bookings"
    | "rooms"
    | "promotions";
  actions: BulkAction[];
  selectedIds: string[];
  onClear: () => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
  searchValue: string;
  onSearchChange: (v: string) => void;
  searchPlaceholder?: string;
  statusOptions?: StatusOption[];
  statusValue?: string;
  onStatusChange?: (v: string) => void;
  onExecuted?: (result: BulkResult) => void;
}

export interface BulkResult {
  entity: string;
  action: string;
  requested: number;
  succeeded: number;
  skipped: Array<{ id: string; reason: string }>;
  failed: Array<{ id: string; error: string }>;
}

export function BulkToolbar(props: Props) {
  const {
    entity,
    actions,
    selectedIds,
    onClear,
    onSelectAll,
    onDeselectAll,
    searchValue,
    onSearchChange,
    searchPlaceholder = "Rechercher…",
    statusOptions,
    statusValue,
    onStatusChange,
    onExecuted,
  } = props;

  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Raccourcis clavier globaux
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inField =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (e.key === "/" && !inField) {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (e.key === "Escape") {
        if (document.activeElement === searchRef.current) {
          searchRef.current?.blur();
        } else if (selectedIds.length > 0) {
          onClear();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && !inField && onSelectAll) {
        e.preventDefault();
        onSelectAll();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && !inField && onDeselectAll) {
        e.preventDefault();
        onDeselectAll();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds.length, onClear, onSelectAll, onDeselectAll]);

  async function runAction(action: BulkAction) {
    if (selectedIds.length === 0) return;
    if (action.confirmMessage && !window.confirm(action.confirmMessage)) return;

    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entity,
          action: action.key,
          ids: selectedIds,
        }),
      });
      const body = (await res.json()) as BulkResult | { error: string };
      if (!res.ok) {
        setFeedback(
          `Erreur : ${"error" in body ? body.error : "réponse inattendue"}`,
        );
        return;
      }
      const result = body as BulkResult;
      const parts = [`${result.succeeded}/${result.requested} traité(s)`];
      if (result.skipped.length) parts.push(`${result.skipped.length} ignoré(s)`);
      if (result.failed.length) parts.push(`${result.failed.length} en échec`);
      setFeedback(`✅ ${action.label} — ${parts.join(", ")}`);
      onExecuted?.(result);
      onClear();
      router.refresh();
    } catch (e) {
      setFeedback(
        `Erreur réseau : ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-3 items-end">
        {/* Recherche */}
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Rechercher <span className="text-gray-400">(tapez « / »)</span>
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-10 pr-9 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent outline-none"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Effacer la recherche"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            )}
          </div>
        </div>

        {/* Filtre statut */}
        {statusOptions && onStatusChange && (
          <div className="min-w-[160px]">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Filtrer
            </label>
            <select
              value={statusValue}
              onChange={(e) => onStatusChange(e.target.value)}
              className="w-full py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1B3A6B] focus:border-transparent outline-none bg-white"
            >
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Bandeau actions groupées (visible si sélection) */}
      {selectedIds.length > 0 && (
        <div
          role="toolbar"
          aria-label="Actions groupées"
          className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex flex-wrap gap-2 items-center"
        >
          <span className="text-sm font-medium text-blue-900">
            {selectedIds.length} sélectionné{selectedIds.length > 1 ? "s" : ""}
          </span>
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-blue-700 hover:text-blue-900 underline"
          >
            (Échap pour vider)
          </button>
          <div className="flex-1" />
          {actions.map((a) => (
            <Button
              key={a.key}
              size="sm"
              variant={a.variant ?? "secondary"}
              disabled={busy}
              onClick={() => runAction(a)}
              className="gap-1"
            >
              {a.icon}
              {a.label}
            </Button>
          ))}
        </div>
      )}

      {feedback && (
        <div
          role="status"
          aria-live="polite"
          className="mt-2 p-2 text-sm bg-gray-50 border border-gray-200 rounded"
        >
          {feedback}
        </div>
      )}
    </div>
  );
}

/**
 * Icons pré-empaquetés pour usage courant (évite d'importer lucide-react
 * dans chaque parent).
 */
export const BulkIcons = {
  suspend: <XCircle className="w-4 h-4" />,
  reactivate: <RefreshCw className="w-4 h-4" />,
  approve: <Check className="w-4 h-4" />,
  reject: <X className="w-4 h-4" />,
  hide: <EyeOff className="w-4 h-4" />,
  show: <Eye className="w-4 h-4" />,
  delete: <Trash2 className="w-4 h-4" />,
  selectAll: <CheckSquare className="w-4 h-4" />,
  deselectAll: <Square className="w-4 h-4" />,
};
