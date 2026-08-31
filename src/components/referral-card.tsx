"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Gift, Copy, Check, Loader2 } from "lucide-react";
import { useT } from "@/components/ui-locale-provider";

/**
 * <ReferralCard /> (T-030)
 * Affiche le code parrainage de l'user courant, avec bouton copier.
 * Récupère (ou génère) via GET /api/users/me/referral.
 */
export function ReferralCard() {
  const t = useT();
  const [code, setCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/users/me/referral");
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? t("auth.error"));
        if (!cancelled) setCode(j.code);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t("auth.error"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  async function copy() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback : sélection texte (silencieux)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-[#F5A623]" />
          <CardTitle>{t("referral.title")}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 mb-4">
          {t("referral.body")}
        </p>
        {loading ? (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" /> {t("action.loading")}
          </div>
        ) : code ? (
          <div className="flex items-center gap-3">
            <code className="text-2xl font-bold tracking-widest bg-gradient-to-r from-[#F5A623] to-[#FF5A5F] bg-clip-text text-transparent">
              {code}
            </code>
            <Button
              size="sm"
              variant="ghost"
              onClick={copy}
              aria-label={t("referral.copyAria")}
            >
              {copied ? (
                <><Check className="w-4 h-4 mr-1" /> {t("wishlist.copy")}</>
              ) : (
                <><Copy className="w-4 h-4 mr-1" /> {t("referral.copy")}</>
              )}
            </Button>
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : null}
        {code ? (
          <p className="mt-4 text-xs text-gray-500 break-all">
            {t("referral.signupLink")}{" "}
            <span className="text-gray-700 font-medium">
              {typeof window !== "undefined" ? window.location.origin : ""}/inscription?ref={code}
            </span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
