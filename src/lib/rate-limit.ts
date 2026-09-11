/**
 * Rate-limiter en mémoire simple (T-009, BUG-009).
 *
 * Utilise une Map<clé, tentatives[]> et une fenêtre glissante. Suffisant
 * pour un déploiement mono-instance ou pour freiner un attaquant naïf.
 * Pour un déploiement multi-instance, remplacer par Redis (voir
 * KNOWN_LIMITATIONS.md).
 *
 * L'API renvoie `{ ok: true }` si la requête est autorisée, ou
 * `{ ok: false, retryAfter: <secondes> }` si limite atteinte.
 */

type Attempt = number; // timestamp ms

const store = new Map<string, Attempt[]>();

/**
 * T-264 (audit n°6, B12) — le limiteur est en mémoire : au-delà d'une instance,
 * la limite effective est divisée par le nombre d'instances. On le **dit une
 * fois** dans les journaux de production (sans `REDIS_URL`) au lieu de laisser
 * la limite invisible ; aucun changement de comportement (le passage à un
 * stockage partagé reste une décision produit, cf. `docs/CI.md`).
 */
let warnedSharedStore = false;
function warnIfNotShared(): void {
  if (warnedSharedStore || process.env.NODE_ENV !== "production" || process.env.REDIS_URL) return;
  warnedSharedStore = true;
  console.warn(
    "[rate-limit] limiteur en mémoire en production : au-delà d'une instance, " +
      "la limite effective est divisée par le nombre d'instances — prévoir un " +
      "stockage partagé (Redis), cf. docs/CI.md.",
  );
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfter: number;
}

export interface RateLimitOptions {
  /** Nombre maximal d'essais dans la fenêtre. */
  limit: number;
  /** Durée de la fenêtre en millisecondes. */
  windowMs: number;
}

export function rateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  warnIfNotShared();
  const now = Date.now();
  const cutoff = now - opts.windowMs;

  const previous = store.get(key) ?? [];
  const recent = previous.filter((t) => t > cutoff);

  if (recent.length >= opts.limit) {
    const oldest = recent[0];
    const retryAfter = Math.ceil((oldest + opts.windowMs - now) / 1000);
    // On ne push pas cette tentative → n'aggrave pas la punition
    store.set(key, recent);
    return { ok: false, remaining: 0, retryAfter: Math.max(1, retryAfter) };
  }

  recent.push(now);
  store.set(key, recent);
  return {
    ok: true,
    remaining: Math.max(0, opts.limit - recent.length),
    retryAfter: 0,
  };
}

/**
 * T-235 (audit n°3, F4) — message de refus **explicite** : le constat reprochait
 * un « réessayez plus tard » sans délai, qui laissait l'utilisateur deviner
 * combien de temps attendre (et donnait l'impression d'une panne).
 *
 * Le libellé reste traduisible : `localizeApiMessage` reconnaît les deux formes
 * (« … dans N secondes » / « … dans N minutes ») et les rend en anglais.
 */
export function rateLimitMessage(retryAfterSeconds: number): string {
  const seconds = Math.max(1, Math.ceil(retryAfterSeconds));
  if (seconds < 60) {
    return `Trop de tentatives, réessayez dans ${seconds} seconde${seconds > 1 ? "s" : ""}`;
  }
  const minutes = Math.ceil(seconds / 60);
  return `Trop de tentatives, réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}`;
}

/**
 * T-235 — clé de quota d'un visiteur **non connecté**.
 *
 * Le constat F4 relevait que le quota invité reposait sur la seule IP : tous les
 * voyageurs derrière une IP publique partagée (hôtel, campus, opérateur mobile)
 * consommaient le même compteur. On préfère donc l'identifiant de cookie posé
 * par le tunnel (`mbb_guest`), avec l'IP en repli pour les clients qui refusent
 * les cookies.
 */
export const GUEST_QUOTA_COOKIE = "mbb_guest";

export function guestQuotaKey(request: Request, cookieName = GUEST_QUOTA_COOKIE): string {
  const cookie = request.headers?.get?.("cookie") ?? null;
  if (cookie) {
    const match = cookie.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`));
    if (match && match[1]) {
      return `guest-cookie:${decodeURIComponent(match[1]).slice(0, 64)}`;
    }
  }
  return `guest-ip:${ipFromRequest(request)}`;
}

/** Extrait une clé d'IP raisonnable d'une requête Next.js. */
export function ipFromRequest(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/** Vide le store — utilisé par les tests, ne pas appeler en runtime. */
export function _resetRateLimit(): void {
  store.clear();
}
