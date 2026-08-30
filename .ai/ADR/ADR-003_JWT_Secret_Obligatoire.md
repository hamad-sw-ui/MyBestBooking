# ADR-003 — JWT_SECRET obligatoire au démarrage

- **Date** : 2026-08-20
- **Statut** : accepté
- **Niveau** : C
- **Tâche associée** : T-001 (corrige BUG-001)
- **Rapports liés** :
  - `REPORTS/analyse_impact_2026-08-20_jwt_secret.md`
  - `REPORTS/analyse_conception_2026-08-20_jwt_secret.md`
  - `REPORTS/debat_technique_2026-08-20_jwt_secret.md`

## Contexte

`src/lib/auth.ts:9` contenait un fallback hard-codé pour `JWT_SECRET` :
```ts
process.env.JWT_SECRET || "mybestbooking-secret-key-2025"
```
Cette chaîne est publiquement lisible dans le repo. Si la variable
d'environnement n'est pas définie en production, n'importe qui peut
forger un JWT admin. Voir `REPORTS/analyse_impact_2026-08-20_jwt_secret.md`.

## Décision

Supprimer le fallback. Le module `auth.ts` **throw au chargement** si
`process.env.JWT_SECRET` est absent ou vide. En complément, un
`console.warn` est émis si le secret fait moins de 32 caractères
(recommandation du Relecteur, §15.2).

```ts
const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error(
    "JWT_SECRET is required. Generate one with `openssl rand -hex 32` " +
    "and set it in your environment. See .ai/SECURITY.md."
  );
}
if (secret.length < 32) {
  console.warn(
    "[auth] JWT_SECRET is shorter than 32 characters — this is insecure. " +
    "Regenerate with `openssl rand -hex 32`."
  );
}
const JWT_SECRET = new TextEncoder().encode(secret);
```

## Alternatives écartées

- **Throw lazy (à la première utilisation)** — ne fail-fast pas, cache
  la mauvaise configuration jusqu'au premier login. Rejeté par
  §15.1 et par l'Architecte.
- **`process.exit(1)`** — brutal, empêche `catch` d'un supervisor.
- **Fallback dev-only** — c'est exactement le pattern qui a créé BUG-001.

## Conséquences

### Positives

- Impossible de déployer avec un secret compromis par oubli d'env var.
- Le message d'erreur est explicite et actionnable (mentionne la
  commande de génération et le doc à lire).
- Warning informatif si le secret est trop court (défense en profondeur).

### Négatives

- Un test qui importe `auth.ts` doit définir `JWT_SECRET` — Vitest le
  gère via `beforeAll` ou `.env.test`.
- Un développeur qui clone le repo sans `.env.local` verra le serveur
  crasher au démarrage. Documentation `DEV_ENVIRONMENT.md` et
  `.env.example` mitigent.

### À suivre

- **Rotation de secret** non prévue. Un `JWT_SECRET` compromis exige
  une rotation manuelle qui invalidera toutes les sessions actives.
  Tracé dans `KNOWN_LIMITATIONS.md`.
- **Support edge runtime** : si un jour une route passe en edge,
  vérifier que `process.env.JWT_SECRET` reste accessible côté edge.
- **Vérification de force du secret** : le warning `< 32` pourrait
  devenir un throw dans une future ADR si on veut être strict.

## Preuves de mise en œuvre (§16)

Consignées dans `TRACEABILITY.md` :
- 🔨 `npm run typecheck` — 0 erreur
- 🔨 `npm run build` — succès avec `JWT_SECRET` défini
- ▶️ `unset JWT_SECRET && npm run build` — échec avec message clair
- 🧪 `npm test` — `src/lib/auth.test.ts` : 2 cas nominal + 1 cas d'échec
- 🧪 test tiers indépendant : le message d'erreur contient
  bien la chaîne « JWT_SECRET »
- ▶️ `POST /api/auth/login` puis `GET /api/auth/me` post-changement
  → session vérifiée normalement

## Signatures

- Auteur : Arena Agent Mode (Session 4 du 2026-08-20)
- Validé par : responsable (validation-cadre 2026-08-20)
