# 🧠 Conception — T-022 Câblage du mode maintenance

- **Date** : 2026-08-20 (Session 7, suite)
- **Auteur** : Arena Agent Mode
- **Statut** : conception validée avant implémentation

## Problème

`security.maintenanceMode` est enregistrable par un admin depuis T-021
mais **inerte** : aucun code ne le lit. Il faut :

1. Rediriger les utilisateurs non-admin loin des pages métier.
2. Bloquer les mutations API critiques.
3. Ne **jamais** empêcher un admin de se connecter puis de désactiver
   le mode (anti-lockout).

## Options considérées

### Option A — vérification dans le **proxy edge** (`src/proxy.ts`)

- ➕ un seul endroit, filtrage avant même que RSC/handler s'exécute.
- ➖ le proxy tourne en edge runtime : **pas d'accès à `pg`**, donc
  impossible de lire `app_settings`. Un fetch interne HTTP côté edge
  ajouterait une latence sur chaque requête et créerait un cycle.

→ **Écartée** : contrainte edge documentée ADR-005.

### Option B — guards dans les **layouts RSC** + handlers API — **retenue**

- ➕ code Node runtime → accès direct DB via `getSetting` (cache 60 s).
- ➕ pas de latence supplémentaire côté client (rendu SSR).
- ➕ granularité fine : whitelist explicite des routes de secours.
- ➖ doit être ajouté à chaque nouveau layout / handler API critique.
  Mitigé par un helper unique `assertNotMaintenance()` qu'on grep
  facilement.

Choix : **Option B**.

### Option C — flag global via `revalidateTag` + cache RSC

- ➕ propagation temps réel entre requêtes.
- ➖ complexité disproportionnée pour un simple booléen déjà caché
  60 s par `getSetting`.

→ **Écartée** (over-engineering).

## Architecture retenue

```
┌────────────────────────────────┐
│  Admin coche maintenance ✓     │
│  → PATCH /api/admin/settings/  │
│         security                │
└────────────────┬────────────────┘
                 │  écriture DB + invalidation cache 60 s
                 ▼
        app_settings.security.maintenanceMode = true
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│ Lecture par (getSetting("security")).maintenanceMode │
│                                                     │
│  Layouts RSC :                                      │
│    (main)/layout   → non-admin → redirect(/maintenance)
│    dashboard/layout → non-admin → redirect(/maintenance)
│                                                     │
│  Handlers API métier :                              │
│    POST /api/bookings, PUT /api/bookings/[id],      │
│    POST /api/uploads, POST /api/reviews,            │
│    GET  /api/promotions/apply                       │
│      → assertNotMaintenance(user) → 503 + Retry-After
│                                                     │
│  Whitelist (jamais bloquée) :                       │
│    /api/auth/*   /api/admin/*   /connexion          │
│    /maintenance  /_next/*  /favicon.ico  /robots.txt│
└─────────────────────────────────────────────────────┘
```

### Contrat `src/lib/maintenance.ts`

```ts
export class MaintenanceError extends Error {
  code = "MAINTENANCE_MODE" as const;
  retryAfterSeconds = 60;
}

export async function isMaintenanceActive(): Promise<boolean>;

export async function assertNotMaintenance(
  user: { role: string } | null,
): Promise<void>; // throw MaintenanceError si actif et non admin

export function shouldBypassMaintenance(pathname: string): boolean;

export function maintenanceResponse(): NextResponse; // 503 JSON standard
```

### Page `/maintenance`

RSC statique, `noindex` (meta), design cohérent (couleurs marque),
message court en français + bouton retour au site (`/` — reboucle mais
si toujours en maintenance re-redirect, transparent pour l'utilisateur
quand le mode est levé).

### Whitelist déterministe

Cœur de la sécurité anti-lockout : la liste ne dépend d'aucune donnée,
un admin peut **toujours** :

- ouvrir `/connexion`,
- appeler `POST /api/auth/login`,
- accéder à `/api/admin/settings/security` pour désactiver le mode.

## Plan de migration

1. `src/lib/maintenance.ts` + tests.
2. Page `/maintenance/page.tsx`.
3. Guard dans `(main)/layout.tsx` + `dashboard/layout.tsx`.
4. Guard `assertNotMaintenance` en tête des 5 handlers API métier
   critiques.
5. Tests unitaires + typecheck + build + tests intégration.
6. Manuel ▶️ des 5 scénarios.
7. Docs `.ai/`.

## Débat multi-rôles §15.2

Non requis à ce niveau S (§15.0). Consensus rapide entre rôles :
Architecte (guards RSC/handler > proxy edge), Sécurité (whitelist
déterministe anti-lockout), QA (helper unique testable), SRE (503 +
Retry-After respecte les conventions HTTP), UX (page maintenance
en français + branding).
