import { z } from "zod";

/**
 * T-259 (audit n°6, B6) — champs de coordonnées des hébergements.
 *
 * Les colonnes `properties.latitude` / `longitude` existaient, `?near=` les
 * lisait, mais **rien** ne permettait de les saisir : les schémas d'API
 * acceptaient n'importe quelle chaîne (aucune borne), et le formulaire ne les
 * envoyait jamais — toute annonce créée par un hôte restait donc invisible de
 * la recherche « autour de moi ».
 *
 * Ici : intervalle réel (−90..90 / −180..180), virgule décimale française
 * acceptée puis normalisée en point, chaîne vide ⇒ `null` (effacer la valeur
 * plutôt que d'écrire `""` dans une colonne `decimal`).
 */

function bounds(kind: "latitude" | "longitude"): { min: number; max: number; label: string } {
  return kind === "latitude"
    ? { min: -90, max: 90, label: "Latitude" }
    : { min: -180, max: 180, label: "Longitude" };
}

/** Vrai si `value` est une coordonnée exploitable dans l'intervalle attendu. */
export function isCoordinate(value: string, kind: "latitude" | "longitude"): boolean {
  const { min, max } = bounds(kind);
  const parsed = Number(value.trim().replace(",", "."));
  return value.trim() !== "" && Number.isFinite(parsed) && parsed >= min && parsed <= max;
}

/**
 * Valeur d'affichage d'une coordonnée : PostgreSQL rend un `decimal(10,8)`
 * sous la forme « 43.76900000 » — on retire les zéros inutiles pour que le
 * champ ne montre pas une précision que l'utilisateur n'a jamais saisie.
 */
export function displayCoordinate(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const raw = String(value).trim();
  if (raw === "" || !Number.isFinite(Number(raw))) return raw;
  return raw.includes(".") ? raw.replace(/0+$/, "").replace(/\.$/, "") : raw;
}

/** Champ de schéma zod : chaîne facultative, bornée, normalisée, vide ⇒ null. */
export function coordinateField(kind: "latitude" | "longitude") {
  const { min, max, label } = bounds(kind);
  return z
    .string()
    .trim()
    .refine((value) => value === "" || isCoordinate(value, kind), `${label} invalide (${min} à ${max})`)
    .transform((value) => (value === "" ? null : value.trim().replace(",", ".")))
    .optional();
}
