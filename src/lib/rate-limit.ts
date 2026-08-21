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
