/**
 * T-182 — Cache de lecture TTL en mémoire (pattern jumeau du cache
 * settings de T-179, lui-même validé en prod).
 *
 * ## Pourquoi
 * Les pages catalogue (`/recherche` sans dates) et fiches publiques
 * (`/hebergement/[slug]`) relisent en base un contenu identique pour tous
 * les visiteurs. Un TTL court (60 s) absorbe les rafales sans changer le
 * modèle de rendu (SSR dynamique conservé, personnalisation intacte).
 *
 * ## Garanties (non-régression)
 * - **Données publiques uniquement** : jamais de payload dépendant de
 *   l'utilisateur (recherche avec dates = disponibilité temps réel → NON
 *   cachée ; vue privée hôte/admin = NON cachée).
 * - **Fraîcheur bornée** : une écriture (validation d'hébergement, avis
 *   approuvé, prix modifié) est visible au plus tard après `ttlMs`
 *   (60 s — même ordre que le cache maintenance T-179).
 * - **Mémoire bornée** : `cap` entrées max, purge des expirées à l'accès.
 * - **Process-local** : comme le rate-limit store mémoire
 *   (KNOWN_LIMITATIONS) — suffisant en mono-instance (sandbox/prod unique),
 *   à remplacer par `unstable_cache` si multi-instance un jour.
 *
 * Pur et sans I/O côté module → testable unitairement.
 */

export interface TtlCache {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  /** Invalide une entrée précise (utilitaire pour tests/écritures). */
  del(key: string): void;
  /** Exécute `fn` ou sert le cache. */
  wrap<T>(key: string, fn: () => Promise<T>): Promise<T>;
  /** Nombre d'entrées (diagnostics/tests). */
  size(): number;
}

export function createTtlCache(opts: { ttlMs: number; cap?: number }): TtlCache {
  const { ttlMs } = opts;
  const cap = opts.cap ?? 500;
  // Map : clé → { value, expiresAt } (Map conserve l'ordre d'insertion,
  // ce qui donne un éviction FIFO bon marché quand le cap est atteint).
  const store = new Map<string, { value: unknown; expiresAt: number }>();

  function purgeExpired(now: number) {
    for (const [k, v] of store) {
      if (v.expiresAt <= now) store.delete(k);
    }
  }

  function evictIfNeeded() {
    while (store.size > cap) {
      const first = store.keys().next();
      if (first.done) break;
      store.delete(first.value);
    }
  }

  return {
    get<T>(key: string): T | undefined {
      const now = Date.now();
      const hit = store.get(key);
      if (!hit) return undefined;
      if (hit.expiresAt <= now) {
        store.delete(key);
        return undefined;
      }
      return hit.value as T;
    },
    set<T>(key: string, value: T): void {
      purgeExpired(Date.now());
      store.set(key, { value, expiresAt: Date.now() + ttlMs });
      evictIfNeeded();
    },
    del(key: string): void {
      store.delete(key);
    },
    async wrap<T>(key: string, fn: () => Promise<T>): Promise<T> {
      const hit = this.get<T>(key);
      if (hit !== undefined) return hit;
      const value = await fn();
      this.set(key, value);
      return value;
    },
    size(): number {
      purgeExpired(Date.now());
      return store.size;
    },
  };
}

/**
 * Cache catalogue/fiches publiques — 60 s (T-182). Instance unique par
 * process (module-level), comme le cache settings T-179 : sous Turbopack
 * chaque bundle (proxy/routes) a sa propre instance — acceptable : le TTL
 * borne la divergence (leçon T-179).
 */
export const publicCatalogCache = createTtlCache({ ttlMs: 60_000 });
