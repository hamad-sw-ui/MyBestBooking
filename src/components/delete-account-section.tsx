"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Loader2 } from "lucide-react";
import { useT } from "@/components/ui-locale-provider";

/**
 * <DeleteAccountSection /> (T-030) — supprime définitivement le compte
 * (soft-delete côté DB, révoque toutes les sessions).
 * Confirmation par saisie du mot « SUPPRIMER » pour éviter les erreurs.
 */
export function DeleteAccountSection() {
  const t = useT();
  const router = useRouter();
  const confirmWord = t("account.deleteConfirmWord");
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del() {
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/users/me", { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? t("auth.error"));
      // Le cookie a été retiré côté serveur, on redirige vers /
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("auth.error"));
      setBusy(false);
    }
  }

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="text-red-600">{t("account.dangerZone")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="font-medium text-red-600">{t("account.deleteAccount")}</p>
            <p className="text-sm text-gray-500">
              {t("account.deleteBody")}
            </p>
          </div>
          <Input
            label={t("account.deleteConfirmLabel").replace("{word}", confirmWord)}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={confirmWord}
            aria-label={t("account.deleteAria")}
          />
          <Button
            variant="danger"
            size="sm"
            onClick={del}
            disabled={busy || confirmText !== confirmWord}
          >
            {busy ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            {t("account.deleteForever")}
          </Button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
