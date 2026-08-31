"use client";

import { FormEvent, useEffect, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type { Stripe } from "@stripe/stripe-js";
import { Loader2, Lock } from "lucide-react";
import { useT } from "@/components/ui-locale-provider";

function StripeConfirmForm({ onSubmitted }: { onSubmitted: () => Promise<void> | void }) {
  const t = useT();
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: { return_url: `${window.location.origin}/mes-reservations` },
    });
    if (result.error) {
      setError(result.error.message ?? t("pay.declined"));
      setBusy(false);
      return;
    }
    await onSubmitted();
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={!stripe || !elements || busy} className="w-full inline-flex justify-center items-center px-5 py-3 bg-[#FF5A5F] text-white font-medium rounded-lg hover:bg-[#e54a4f] disabled:opacity-50">
        {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Lock className="w-4 h-4 mr-2" />}
{t("pay.confirmSecure")}
      </button>
    </form>
  );
}

/**
 * La clé Stripe publiable est résolue côté serveur depuis l'env ou le coffre
 * chiffré, puis exposée par un endpoint public dédié. PAN/CVV restent dans
 * Stripe Elements et ne traversent jamais MyBestBooking.
 */
export function StripePaymentForm({ clientSecret, onSubmitted }: { clientSecret: string; onSubmitted: () => Promise<void> | void }) {
  const t = useT();
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadConfiguration() {
      try {
        const response = await fetch("/api/providers/stripe", { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok || !body.publishableKey) throw new Error(t("pay.notConfigured"));
        if (active) setStripePromise(loadStripe(body.publishableKey));
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : t("pay.notConfigured"));
      }
    }
    void loadConfiguration();
    return () => { active = false; };
  }, []);

  if (error) return <p role="alert" className="p-3 rounded-lg bg-amber-50 text-sm text-amber-900">{t("pay.noneConfirmed").replace("{error}", error)}</p>;
  if (!stripePromise) return <p className="text-sm text-gray-500"><Loader2 className="inline w-4 h-4 mr-2 animate-spin" />{t("pay.loading")}</p>;
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: "stripe" } }}>
      <StripeConfirmForm onSubmitted={onSubmitted} />
    </Elements>
  );
}
