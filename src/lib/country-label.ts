import type { UiStringKey } from "@/lib/ui-strings";

const COUNTRY_KEYS: Record<string, UiStringKey> = {
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

/** Libellé pays (ISO-2) via le catalogue ; repli sur le code si inconnu. */
export function countryLabel(code: string | null | undefined, t: (key: UiStringKey) => string): string {
  if (!code) return "";
  const key = COUNTRY_KEYS[code.toUpperCase()];
  return key ? t(key) : code;
}
