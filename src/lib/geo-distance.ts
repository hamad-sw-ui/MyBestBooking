/**
 * T-260 (audit n°6, B7) — « Autour de moi » : géométrie pure.
 *
 * `GET /api/properties?near=lat,lng,km` filtrait déjà par distance (T-026) et
 * `properties.latitude`/`longitude` sont désormais saisissables (T-259), mais
 * **aucune interface** n'envoyait `near` : la fonction existait sans bouton.
 *
 * Ici, uniquement du calcul et de l'URL (aucun DOM, aucun React) : la page
 * serveur filtre avec `near`, le bouton client construit son URL avec
 * `buildNearHref`. La distance reprend la même formule que l'API (haversine,
 * rayon terrestre 6371 km) pour que le filtre serveur et un éventuel calcul
 * client donnent le même résultat.
 */

/** Rayon par défaut du bouton « Autour de moi » (25 km, cf. audit n°6). */
export const NEAR_RADIUS_KM = 25;

/** Latitude/longitude valides, rayon en km strictement positif. */
export interface NearPoint {
  lat: number;
  lng: number;
  km: number;
}

/**
 * `lat,lng,km` → point exploitable, ou `null` si mal formé / hors bornes.
 * Ne lève jamais : l'appelant décide (filtre ignoré + avertissement, comme
 * les autres paramètres invalides de la page de recherche).
 */
export function parseNear(raw: string | null | undefined): NearPoint | null {
  if (!raw) return null;
  const parts = raw.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 3 || !parts.every((part) => Number.isFinite(part))) return null;
  const [lat, lng, km] = parts;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180 || km <= 0) return null;
  return { lat, lng, km };
}

/** Normalisation stable de `near` pour les clés de cache (`lat,lng,km`). */
export function normalizeNear(point: NearPoint): string {
  return `${point.lat},${point.lng},${point.km}`;
}

/** Distance grand-cercle en km (même formule que `GET /api/properties`, T-026). */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  // `asin` borné : les erreurs d'arrondi peuvent donner |√a| > 1 sur des
  // points quasi confondus (NaT sinon : « NaN km »).
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Nombre de décimales conservées dans l'URL (~11 m — largement suffisant). */
const COORD_DECIMALS = 4;

/**
 * URL `/recherche` conservant les filtres saisis et ajoutant `near`.
 * `page` est retiré (on repart de la première page) et les champs vides sont
 * ignorés pour garder des liens lisibles (`?search=&near=…` → `?near=…`).
 */
export function buildNearHref(
  current: URLSearchParams | string,
  position: { lat: number; lng: number },
  km: number = NEAR_RADIUS_KM,
): string {
  const query = new URLSearchParams(typeof current === "string" ? current : current.toString());
  query.delete("near");
  query.delete("page");
  for (const [key, value] of [...query.entries()]) {
    if (value.trim() === "") query.delete(key);
  }
  query.set(
    "near",
    `${position.lat.toFixed(COORD_DECIMALS)},${position.lng.toFixed(COORD_DECIMALS)},${km}`,
  );
  return `/recherche?${query.toString()}`;
}
