"use client";

import { AlertTriangle } from "lucide-react";
import { useT } from "@/components/ui-locale-provider";

/**
 * T-207 — Stub legacy : le tunnel ne doit plus afficher de formulaire de carte.
 *
 * Le composant reste exporté pour éviter une casse d'import éventuelle, mais il
 * ne charge plus Stripe.js, ne demande plus de clé publiable et ne déclenche
 * aucune confirmation de paiement.
 */
export function StripePaymentForm() {
  const t = useT();
  return (
    <p role="alert" className="p-3 rounded-lg bg-amber-50 text-sm text-amber-900 flex items-start gap-2">
      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
      <span>{t("pay.noneConfirmed").replace("{error}", t("pay.notConfigured"))}</span>
    </p>
  );
}
