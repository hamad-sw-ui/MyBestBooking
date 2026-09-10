import type { UiStringKey } from "@/lib/ui-strings";

/** Pays proposés dans les formulaires publics/back-office. */
export const SUPPORTED_COUNTRIES = ["FR", "MA", "TN", "ES", "IT", "PT", "DE", "GB", "US"] as const;

export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number];

const COUNTRY_LABEL_KEYS: Record<SupportedCountry, UiStringKey> = {
  FR: "prop.country.FR",
  MA: "prop.country.MA",
  TN: "prop.country.TN",
  ES: "prop.country.ES",
  IT: "prop.country.IT",
  PT: "prop.country.PT",
  DE: "prop.country.DE",
  GB: "prop.country.GB",
  US: "prop.country.US",
};

export function isSupportedCountry(value: string | null | undefined): value is SupportedCountry {
  return SUPPORTED_COUNTRIES.includes(value as SupportedCountry);
}

export function countryOptions(t: (key: UiStringKey) => string): Array<{ value: SupportedCountry; label: string }> {
  return SUPPORTED_COUNTRIES.map((value) => ({ value, label: t(COUNTRY_LABEL_KEYS[value]) }));
}
