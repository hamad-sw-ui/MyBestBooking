"use client";

import { formatPrice } from "@/lib/utils";
import { convertAmount, formatMoney } from "@/lib/i18n";
import { useDisplayPreferences } from "@/lib/use-display-currency";
import { uiStrings } from "@/lib/ui-strings";

/**
 * T-132 — Prix d'une chambre sur la fiche logement, affiché dans la devise
 * d'affichage du visiteur (XAF par défaut plateforme) et libellé localisé.
 * Affichage uniquement : la réservation/paiement reste dans la devise de la
 * chambre (note « conversion indicative »).
 */
export function LocalizedRoomPrice({
  basePrice,
  currency,
  size = "lg",
}: {
  basePrice: number | string;
  currency: string | null;
  size?: "lg" | "md";
}) {
  const { currency: displayCurrency, language } = useDisplayPreferences();
  const t = uiStrings(language);
  const sourceCurrency = currency ?? "EUR";
  const numeric = typeof basePrice === "number" ? basePrice : parseFloat(basePrice);
  const converted = Boolean(displayCurrency) && displayCurrency !== sourceCurrency.toUpperCase();
  const priceText = converted
    ? formatMoney(convertAmount(numeric, sourceCurrency, displayCurrency!), displayCurrency!)
    : formatPrice(numeric, sourceCurrency);

  return (
    <>
      <p className={size === "lg" ? "text-2xl font-bold text-gray-900" : "text-lg font-bold text-gray-900"}>
        {priceText}
      </p>
      <p className="text-sm text-gray-500">{t["price.perNightLong"]}</p>
      {converted && (
        <p className="text-[10px] text-gray-400" title="Conversion indicative, taux figés. Le paiement reste en devise de l'hébergement.">
          {t["price.convertedNote"]} {sourceCurrency}
        </p>
      )}
    </>
  );
}
