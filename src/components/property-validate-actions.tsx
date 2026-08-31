"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Ban } from "lucide-react";
import { useT } from "@/components/ui-locale-provider";

interface Props {
  propertyId: string;
  currentStatus: string;
}

/**
 * Boutons admin pour approve/reject/suspend une property (T-016).
 * POST /api/properties/[id]/validate
 */
export function PropertyValidateActions({ propertyId, currentStatus }: Props) {
  const router = useRouter();
  const t = useT();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "approve" | "reject" | "suspend") {
    setError(null);
    setLoading(action);
    try {
      const res = await fetch(`/api/properties/${propertyId}/validate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t("auth.genericError"));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("auth.genericError"));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {currentStatus !== "active" && (
        <button
          onClick={() => run("approve")}
          disabled={loading !== null}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          <Check className="w-3 h-3" />
          {loading === "approve" ? "…" : t("mod.approve")}
        </button>
      )}
      {currentStatus !== "draft" && (
        <button
          onClick={() => run("reject")}
          disabled={loading !== null}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50"
        >
          <X className="w-3 h-3" />
          {loading === "reject" ? "…" : t("mod.reject")}
        </button>
      )}
      {currentStatus !== "suspended" && (
        <button
          onClick={() => run("suspend")}
          disabled={loading !== null}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
        >
          <Ban className="w-3 h-3" />
          {loading === "suspend" ? "…" : t("bulk.suspend")}
        </button>
      )}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
