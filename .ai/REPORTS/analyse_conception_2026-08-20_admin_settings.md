# 🧠 Conception — T-021 Panel d'administration configurable

- **Date** : 2026-08-20 (Session 7)
- **Auteur** : Arena Agent Mode
- **Statut** : conception validée avant implémentation

## Problème

Voir `analyse_impact_2026-08-20_admin_settings.md` §14.1-3 : 4 catégories
de réglages sont aujourd'hui **hardcodés**, ce qui rend impossible tout
ajustement business sans redéploiement.

## Options considérées

### Option A — fichier JSON versionné (`config/settings.json`)

- ➕ simple à lire, pas de migration DB.
- ➖ modifiable uniquement par PR : ne répond **pas** à la demande *sans
  passer par le code*.
- ➖ pas d'audit trail par utilisateur.

→ **Écartée** : ne résout pas le problème posé.

### Option B — variables d'environnement (`process.env.TAX_RATE=...`)

- ➕ familier, déjà utilisé pour secrets.
- ➖ chaque changement = redéploiement (Vercel, Docker, k8s).
- ➖ pas de saisie via UI, pas d'admin panel.

→ **Écartée** : redéploiement requis.

### Option C — table `app_settings` (key/value JSONB) — **retenue**

- ➕ écriture atomique, transactionnelle, immédiate.
- ➕ audit trail natif via `updatedBy`, `updatedAt`.
- ➕ compatible avec un futur mode multi-tenant (ajouter `tenantId`).
- ➕ zéro nouveau service à déployer (utilise PostgreSQL existant).
- ➖ nécessite un cache mémoire par process pour éviter 1 round-trip DB
  par lecture — géré dans `src/lib/settings.ts`.

Choix : **Option C**. Documenté dans `ADR-007`.

### Option D — service dédié (Redis / Consul / LaunchDarkly)

- ➕ propagation temps réel multi-instance.
- ➖ complexité + coût opérationnel disproportionnés à ce stade (mono-app
  Next.js sur une seule DB PostgreSQL).

→ **Écartée** pour V1. Sera pertinente si on scale horizontalement.

## Architecture retenue

```
┌──────────────────────┐
│ /dashboard/settings  │  (RSC — lit via getSetting)
│  formulaires client  │──── fetch PATCH /api/admin/settings/[key]
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐          ┌────────────────────┐
│  src/lib/settings.ts │◀────────▶│  app_settings (DB) │
│  ── cache LRU par    │          │  key TEXT PK       │
│     process          │          │  value JSONB       │
│  ── DEFAULTS fallback│          │  updated_at        │
│  ── Zod validation   │          │  updated_by uuid   │
└──────────┬───────────┘          └────────────────────┘
           │
           ├──▶ POST /api/bookings           (taxRate, bestrewardsThresholds)
           ├──▶ PUT  /api/bookings/[id]     (cancellationGrid)
           └──▶ (autres callers ajoutés au fil de l'eau)
```

### Contrat `src/lib/settings.ts`

```ts
export const SETTING_KEYS = {
  general: "general",
  billing: "billing",
  bestrewards: "bestrewards",
  cancellation: "cancellation",
  notifications: "notifications",
  security: "security",
} as const;
export type SettingKey = keyof typeof SETTING_KEYS;

// Schémas Zod stricts par clé (bornes, types).
export const settingSchemas = { … };

// Valeurs par défaut reproduisant le comportement actuel.
export const DEFAULTS: { [K in SettingKey]: z.infer<...> } = {
  general: { siteName: "MyBestBooking", …, defaultCurrency: "EUR" },
  billing: { taxRate: 0.10, defaultCommissionRate: 15 },
  bestrewards: { thresholds: [5, 15], discounts: [10, 15, 20] },
  cancellation: { free: {…}, flexible: {…}, moderate: {…}, strict: {…},
                  non_refundable: {…} },
  notifications: { welcomeEmail: true, bookingConfirmation: true, … },
  security: { rateLimits: {…}, sessionDays: 30, minPasswordLength: 8 },
};

export async function getSetting<K extends SettingKey>(key: K)
  : Promise<z.infer<typeof settingSchemas[K]>>;
export async function setSetting<K extends SettingKey>(
  key: K, value: unknown, updatedBy: string,
): Promise<z.infer<typeof settingSchemas[K]>>;
export function clearSettingsCache(): void; // pour tests
```

### Cache

`Map<SettingKey, {value, expiresAt}>`, TTL 60 s **ou** invalidation
immédiate après `setSetting`. Suffisant : Next.js dev tourne mono-process,
prod Vercel = multi-lambda mais chaque lambda charge à la demande.

### Sécurité

- Middleware admin sur toutes les routes `/api/admin/*` : `getCurrentUser`
  + `role === 'admin'`.
- Rate-limit `admin:settings:${user.id}` : 30 req/min.
- Zod strict par clé : refuse toute valeur hors bornes (TVA ∈ [0, 1],
  seuils bestrewards entiers positifs croissants, pourcentages ∈ [0, 100]).
- Log de traçabilité : `console.info("[settings] admin=%s key=%s prev=%o
  next=%o")` — visible dans les logs plate-forme.

### UI

Formulaires client (`"use client"`) dans `src/components/admin/settings-*`,
un composant par section pour limiter le rerender. Chaque section utilise
un pattern :

```tsx
const [value, setValue] = useState(initial);
const [status, setStatus] = useState<"idle"|"saving"|"saved"|"error">("idle");
async function save() {
  setStatus("saving");
  const r = await fetch(`/api/admin/settings/${key}`, {
    method: "PATCH", headers: {"Content-Type": "application/json"},
    body: JSON.stringify(value),
  });
  setStatus(r.ok ? "saved" : "error");
}
```

Aucune 3rd-party form lib : le projet n'en utilise pas et l'ajouter
serait hors périmètre.

## Plan de migration

1. Créer la table `app_settings` via migration Drizzle 0005.
2. Livrer `src/lib/settings.ts` avec DEFAULTS = valeurs actuelles.
3. Ajouter endpoint `/api/admin/settings` (GET+PATCH par clé).
4. Refactor `POST /api/bookings` et `PUT /api/bookings/[id]` pour lire
   via `getSetting`.
5. Refactor UI `/dashboard/settings/page.tsx` en composition RSC + client
   sections.
6. Livrer le bouton *Suspendre* dans `/dashboard/users`.
7. Tests unitaires settings + non-régression cancellation.
8. Manuel ▶️ des 5 scénarios listés au §14.8.
9. Docs `.ai/` : FEATURES, TRACEABILITY, PROGRESS, STATE, ADR-007.

Aucun downtime, aucun script de backfill.

## Points ouverts (backlog non bloquant)

- Templates emails éditables (nécessite un moteur mustache — reporté).
- Providers Stripe/Resend/S3 restent pilotés par env vars (redéploiement
  requis) — l'UI ne fait qu'afficher l'état. Point signalé au user, non
  bloquant pour la valeur promise.
- Mode maintenance : la table est prête, le middleware qui l'observe
  reste à câbler (T-022 potentielle).
- Multi-tenant : ajouter `tenantId` à `app_settings` le jour où on scale.

## Débat multi-rôles §15.2

Non requis à ce niveau S (§15.0 tableau). Un désaccord entre rôles
déclencherait un débat ; ici la conception fait consensus entre
Architecte (choix table), TS/React (typage stricts Zod), QA (defaults
= comportement actuel), SRE (mono-DB, pas de nouveau service), UX
(section par section, chargement progressif), Sécurité (whitelist Zod +
role admin + rate-limit + zéro exposition de secret).
