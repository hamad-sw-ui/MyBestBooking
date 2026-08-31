"use client";

import { useState } from "react";
import { MailCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/components/ui-locale-provider";

/**
 * <ResendVerificationButton /> (T-137, A3)
 *
 * Affiche, pour un compte dont l'email n'est pas vérifié, une bannière avec
 * un bouton « Renvoyer l'email de vérification » (POST
 * /api/auth/resend-verification). Boucle le parcours de vérification : sans
 * ce bouton, un lien expiré/perdu laissait l'utilisateur « non vérifié »
 * sans recours. Si l'email est déjà vérifié, le composant ne rend rien.
 */
export function ResendVerificationButton({ verified }: { verified: boolean | null }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  // Vérifié (ou état inconnu en cours de chargement) : rien à afficher.
  if (verified) return null;

  async function resend() {
    if (state === "loading") return;
    setState("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/auth/resend-verification", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t("verify.failed"));
      setMessage(data.message ?? t("verify.sentDefault"));
      setState("sent");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t("auth.error"));
      setState("error");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <MailCheck className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        {t("verify.unverified")}{" "}
        {message ?? t("verify.hint")}
      </span>
      <Button variant="outline" size="sm" onClick={resend} disabled={state === "loading"}>
        {state === "loading" && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
        {state === "sent" ? t("verify.resent") : t("verify.resend")}
      </Button>
    </div>
  );
}
