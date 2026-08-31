"use client";

import { formatPrice, intlLocale } from "@/lib/utils";
import { convertAmount, formatMoney } from "@/lib/i18n";
import { useDisplayPreferences } from "@/lib/use-display-currency";
import { useT, useUiLocale } from "@/components/ui-locale-provider";

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
  const { currency: displayCurrency } = useDisplayPreferences();
  const t = useT();
  const locale = useUiLocale();
  const sourceCurrency = currency ?? "EUR";
  const numeric = typeof basePrice === "number" ? basePrice : parseFloat(basePrice);
  const converted = Boolean(displayCurrency) && displayCurrency !== sourceCurrency.toUpperCase();
  const priceText = converted
    ? formatMoney(convertAmount(numeric, sourceCurrency, displayCurrency!), displayCurrency!, intlLocale(locale))
    : formatPrice(numeric, sourceCurrency, locale);

  return (
    <>
      <p className={size === "lg" ? "text-2xl font-bold text-gray-900" : "text-lg font-bold text-gray-900"}>
        {priceText}
      </p>
      <p className="text-sm text-gray-500">{t("price.perNightLong")}</p>
      {converted && (
        <p className="text-[10px] text-gray-400" title={t("bookingCard.conversionTooltip")}>
          {t("price.convertedNote")} {sourceCurrency}
        </p>
      )}
    </>
  );
}
