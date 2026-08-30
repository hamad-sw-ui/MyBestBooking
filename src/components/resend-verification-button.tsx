"use client";

import { useState } from "react";
import { MailCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      if (!res.ok) throw new Error(data.error ?? "L'envoi a échoué");
      setMessage(data.message ?? "Un email de vérification vous a été envoyé.");
      setState("sent");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erreur");
      setState("error");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <MailCheck className="h-4 w-4 shrink-0" />
      <span className="flex-1">
        Votre adresse email n&apos;est pas encore vérifiée.{" "}
        {message ?? "Vérifiez votre boîte de réception ou renvoyez l'email de confirmation."}
      </span>
      <Button variant="outline" size="sm" onClick={resend} disabled={state === "loading"}>
        {state === "loading" && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
        {state === "sent" ? "Email renvoyé" : "Renvoyer l'email"}
      </Button>
    </div>
  );
}
