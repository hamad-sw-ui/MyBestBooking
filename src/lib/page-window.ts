/**
 * T-245 (audit n°5, A2) — fenêtre d'affichage des écrans de liste.
 *
 * Les tableaux de bord chargent aujourd'hui **toutes** les lignes
 * (`dashboard/bookings`, `users`, `reviews`, `properties`, `promotions`,
 * `mes-reservations`) : le coût est linéaire en volume et le premier rendu
 * devient inutilisable à l'échelle. On borne donc le chargement à une
 * **fenêtre** que l'utilisateur peut élargir explicitement.
 *
 * Pourquoi une fenêtre progressive plutôt qu'un paginateur classique : ces
 * écrans filtrent, trient et comptent **côté client** (recherche, statut,
 * sélection groupée). Un `?page=N` classique aurait restreint ces filtres et
 * ces compteurs à la page courante — régression fonctionnelle. Avec une
 * fenêtre, tout ce qui est affiché reste cohérent : les filtres portent sur
 * les lignes chargées, et l'utilisateur élargit d'un clic (le bandeau précise
 * le périmètre).
 *
 * Helper pur : aucun accès disque, aucune dépendance, testable directement.
 */

/** Taille de fenêtre par défaut : premier rendu d'un tableau de bord. */
export const WINDOW_STEP = 25;

/**
 * Plafond de sécurité : au-delà, on n'élargit plus automatiquement (l'écran
 * invite à affiner les filtres). Évite qu'un `?limit=999999` fasse retomber
 * le problème de charge qu'on vient de corriger.
 */
export const WINDOW_MAX = 500;

export interface PageWindow {
  /** Nombre de lignes demandées (≥ WINDOW_STEP, ≤ WINDOW_MAX). */
  size: number;
  /** Nombre de lignes à demander au serveur (`size + 1` : détecte la suite). */
  queryLimit: number;
  /** Offset à appliquer (`0` : la fenêtre commence toujours au début). */
  offset: number;
  /** L'utilisateur a-t-il demandé explicitement la totalité (limit ≥ WINDOW_MAX) ? */
  atMax: boolean;
}

/**
 * Lit `?limit=` (fenêtre demandée) et la borne.
 * Valeur absente, non numérique ou ≤ 0 → `WINDOW_STEP` (comportement sûr).
 * Valeur supérieure au plafond → `WINDOW_MAX` + `atMax` (l'UI l'explique).
 */
export function parsePageWindow(raw: string | string[] | undefined): PageWindow {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const parsed = Number.parseInt(value ?? "", 10);
  const requested = Number.isFinite(parsed) && parsed > 0 ? parsed : WINDOW_STEP;
  const size = Math.min(Math.max(requested, WINDOW_STEP), WINDOW_MAX);
  return {
    size,
    queryLimit: size + 1,
    offset: 0,
    atMax: requested > WINDOW_MAX,
  };
}

/** `?limit=` à écrire pour élargir la fenêtre (jamais au-delà du plafond). */
export function nextWindowSize(current: number, step: number = WINDOW_STEP): number {
  return Math.min(current + step, WINDOW_MAX);
}

/**
 * Pagination **opt-in** des API : `limit`/`offset` ne s'appliquent que si l'un
 * des deux paramètres est présent. Sans paramètre, la réponse reste
 * strictement celle d'aujourd'hui (contrat inchangé pour les appelants).
 * Bornes alignées sur `GET /api/properties` (1–100, offset ≥ 0).
 */
export interface ApiPagination {
  limit: number;
  offset: number;
}

export const API_PAGE_MAX = 100;
export const API_PAGE_DEFAULT = 20;

export function parseApiPagination(
  searchParams: URLSearchParams,
): { pagination: ApiPagination | null; error: string | null } {
  const hasLimit = searchParams.has("limit");
  const hasOffset = searchParams.has("offset");
  if (!hasLimit && !hasOffset) return { pagination: null, error: null };

  // Chiffres uniquement : « 1.5 » ou « 10px » ne sont pas des entiers, alors que
  // `Number.parseInt` les accepterait en tronquant.
  const digitsOnly = /^\d{1,7}$/;
  const limitRaw = searchParams.get("limit") ?? "";
  if (hasLimit && !digitsOnly.test(limitRaw)) {
    return { pagination: null, error: "Le paramètre limit doit être un entier entre 1 et 100" };
  }
  let limit = hasLimit ? Number.parseInt(limitRaw, 10) : API_PAGE_DEFAULT;
  if (limit < 1) {
    return { pagination: null, error: "Le paramètre limit doit être un entier entre 1 et 100" };
  }
  limit = Math.min(limit, API_PAGE_MAX);

  const offsetRaw = searchParams.get("offset") ?? "";
  if (hasOffset && !digitsOnly.test(offsetRaw)) {
    return { pagination: null, error: "Le paramètre offset doit être un entier positif ou nul" };
  }
  const offset = hasOffset ? Number.parseInt(offsetRaw, 10) : 0;

  return { pagination: { limit, offset }, error: null };
}
