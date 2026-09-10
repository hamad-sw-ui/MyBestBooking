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
  /** Clés courantes (hors entrées expirées) — invalidation par préfixe. */
  keys(): string[];
}

/**
 * T-233 — le cache public doit être **partagé** entre les bundles de routes.
 *
 * En développement comme en production, Next.js compile les pages et les routes
 * d'API dans des bundles distincts : deux copies du module `read-cache` = deux
 * caches, donc une invalidation déclenchée depuis une route d'API qui n'atteint
 * jamais la copie lue par la fiche publique. On ancre donc l'instance sur
 * `globalThis` — exactement la même raison que le pool `pg` dans `src/db/index.ts`.
 *
 * Constaté au runtime : après suspension d'un hôte, la fiche restait servie
 * depuis un cache que l'invalidation ne touchait pas.
 */
const globalForCache = globalThis as typeof globalThis & {
  __mbbPublicCatalogCache?: TtlCache;
};

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
    keys(): string[] {
      purgeExpired(Date.now());
      return [...store.keys()];
    },
  };
}

/**
 * Cache catalogue/fiches publiques — 60 s (T-182). Instance unique par
 * process (module-level), comme le cache settings T-179 : sous Turbopack
 * chaque bundle (proxy/routes) a sa propre instance — acceptable : le TTL
 * borne la divergence (leçon T-179).
 */
export const publicCatalogCache: TtlCache =
  globalForCache.__mbbPublicCatalogCache ?? createTtlCache({ ttlMs: 60_000 });

// En production, l'instance est réutilisée entre invocations ; en développement,
// elle survit au rechargement à chaud (sinon chaque édition repart d'un cache
// vide et le comportement observé ne reflète pas la production).
globalForCache.__mbbPublicCatalogCache = publicCatalogCache;

/**
 * T-233 (audit n°3, F2) — invalidation ciblée du catalogue public.
 *
 * Le cache de lecture a un TTL de 60 s : sans invalidation, une annonce d'hôte
 * suspendu resterait servie jusqu'à une minute après la sanction. On purge donc
 * les entrées concernées dès que le statut change.
 *
 * L'implémentation s'appuie sur `keys()` du cache (aucune réflexion sur la Map
 * interne) : les fiches (`property:<slug>`) et les recherches (`search:<…>`)
 * sont retirées par préfixe.
 */
export function invalidatePublicCatalog(reason: string): number {
  let removed = 0;
  for (const key of publicCatalogCache.keys()) {
    if (key.startsWith("property:") || key.startsWith("search:")) {
      publicCatalogCache.del(key);
      removed += 1;
    }
  }
  if (removed > 0) {
    console.info(`[read-cache] catalogue public invalidé (${reason}) : ${removed} entrée(s)`);
  }
  return removed;
}
