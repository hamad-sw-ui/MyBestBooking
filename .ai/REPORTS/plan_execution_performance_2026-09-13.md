# Plan d'exécution — Performance (PERF)

> Analyse mesurée le 2026-09-13 sur l'instance locale du projet.
> Aucune conclusion « à l'œil » : chaque constat est accompagné de la mesure
> qui le prouve (log serveur, `EXPLAIN ANALYZE`, chronométrage de requêtes).

## 1. Constats mesurés

| # | Constat | Preuve | Impact |
|---|---|
| 1 | Le projet réside sur le disque `D:` = **HDD** (466 GB mécanique), le SSD (`C:`) est le disque système. | `Get-PhysicalDisk` → `MediaType HDD` (DeviceId 0, BusType SATA) / `SSD` (DeviceId 1). Next.js avertit lui-même `⚠ Slow filesystem detected`. | **Compilation dev** : `GET /dashboard/properties/<id>` = **87 s** dont `next.js: 87 s` (compilation). Le code applicatif n'y est presque pour rien. |
| 2 | `conversations` et `messages` n'ont **aucun index** hors clé primaire. | `EXPLAIN (ANALYZE)` → `Seq Scan on conversations`, `Seq Scan on messages msg`. `pg_indexes` ne listait que les PK + `conversation_key`. | **`GET /api/conversations`** est appelé par le badge du header sur **chaque page**. En production (volume), deux scans séquentiels par appel. |
| 3 | `getCurrentUser()` fait 2 requêtes DB et n'était **jamais dédupliqué** dans une même requête HTTP. | `getCurrentUser()` ≈ **4 ms** local (2 requêtes). Sur `/` il est appelé via layout + page + `generateMetadata`, plus `getServerLocale()` qui le rappelle → **jusqu'à 5×** le coût DB par page. | Coût redondant par page ; bien plus élevé en production (latence réseau DB managée). |
| 4 | Le pool `pg` utilisait les **défauts** (max 10, aucun timeout). | `src/db/index.ts` : `new Pool({ connectionString })`. | Une requête lente peut immobiliser une connexion sans borne. |

## 2. Correctifs appliqués

### PERF-001 / PERF-002 — Index manquants (`src/db/schema.ts`)
Ajout des index, appliqués en base par `drizzle-kit push` :

- `sessions` : `idx_sessions_user` (purge/revue par utilisateur), `idx_sessions_expires` (nettoyage cron).
- `conversations` : `idx_conversations_user` et `idx_conversations_property` (le filtre
  `user_id = $1 OR properties.host_id = $1`), `idx_conversations_last_message` (tri par activité).
- `messages` : `idx_messages_conversation_created` (visibilité `EXISTS` + lecture du fil),
  `idx_messages_sender`.

Vérification après push : `EXPLAIN` avec `enable_seqscan=off` → `Index Scan using
idx_conversations_property` et `Index Only Scan using idx_messages_conversation_created`
(les `Seq Scan` ont disparu). Sur la base locale vide, PostgreSQL préfère encore le
seq scan sur `conversations` — comportement **optimal** pour une table minuscule ; les
index prennent le relais dès qu'il y a du volume.

### PERF-003 — Déduplication par requête (`src/lib/auth.ts`, `src/lib/server-locale.ts`)
`getSession`, `getCurrentUser` et `getServerLocale` sont désormais enveloppés dans
`React.cache`. Portée = **une seule requête HTTP** (documenté « scoped to the current
request only »), donc :
- aucun partage de données entre requêtes ni entre utilisateurs — **indispensable** pour
  une lecture d'auth ;
- hors rendu React (handler API), l'appel reste correct (simple absence de mémoïsation) ;
- contrat de retour **inchangé** (mêmes requêtes, mêmes règles de validité T-230).

### PERF-004 — Durcissement du pool (`src/db/index.ts`)
`max`, `idleTimeoutMillis`, `connectionTimeoutMillis`, `keepAlive` — surchargeables par
variables d'environnement (`PG_POOL_MAX`, `PG_IDLE_TIMEOUT_MS`, `PG_CONNECT_TIMEOUT_MS`).

## 3. Reste à traiter (non fait ici — hors périmètre du correctif sûr)

| # | Piste | Gain attendu | Effort |
|---|---|
| P1 | **Déplacer le projet sur le SSD (`C:`)** ou exclure `.next/` de l'indexation antivirus. | Le plus gros gain sur les temps de compilation dev (constat #1). | Faible |
| P2 | **Pagination sur `GET /api/conversations`** : la route renvoie *toutes* les conversations sans limite. | Bornes la charge et le payload. | Moyen |
| P3 | **Indexation `pg_trgm`** pour les filtres `ILIKE %...%` de `/recherche` (nom, ville, description). | Recherche texte plus rapide à volume. | Moyen |
| P4 | Étudier `use cache` / `unstable_cache` pour le catalogue multi-instance (le cache actuel est process-local). | Efficacité en déploiement multi-instance. | Moyen |

## 4. Protocole de non-régression

Toute modification ci-dessus est validée par :

```powershell
npm run typecheck   # tsc --noEmit
npm test            # vitest (sur la base de test 55432)
npm run build       # next build
```

et par un contrôle fonctionnel des routes (`/`, `/recherche`, `/connexion`,
`/inscription`, `/api/properties`, `/api/conversations`).

> Note d'environnement : `tests/setup.ts` fixe `DATABASE_URL` par défaut sur
> **`127.0.0.1:55432`** (Postgres embarqué, `npm run db:dev`). Les tests
> d'intégration doivent tourner sur cette base dédiée. Les lancer sur la base
> de développement (`5432`, contenant des données réelles) provoque des
> conflits d'état (409) sans rapport avec le code.
