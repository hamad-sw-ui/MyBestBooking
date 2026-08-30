# Analyse de conception — T-001 : JWT_SECRET obligatoire

- **Date** : 2026-08-20 (Session 4)
- **Tâche** : T-001
- **Niveau** : C
- **Référence** : `CODING_RULES.md` §15.1

---

## Options considérées

### Option A — `throw new Error()` au chargement du module (retenu)

```ts
const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error(
    "JWT_SECRET is required. Set it in your environment before starting the server. See .ai/SECURITY.md."
  );
}
const JWT_SECRET = new TextEncoder().encode(secret);
```

**Avantages** :
- Fail-fast : le serveur ne peut pas démarrer avec un secret vide.
- Simple, une seule ligne de logique.
- L'erreur remonte au build (`npm run build`) ET au démarrage
  (`npm start` / `next dev`) — impossible de manquer.
- Compatible avec tous les runtimes Next.js (dev, prod, edge, node).

**Inconvénients** :
- Un `throw` au top-level d'un module rend le module **impossible à
  importer** sans la variable. Cela veut dire que tout test unitaire du
  module doit définir `JWT_SECRET` au préalable — supportable via
  `beforeEach` ou variables `.env.test`.

### Option B — `throw` lazy (à la première utilisation)

```ts
function getSecret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is required");
  return new TextEncoder().encode(s);
}
export async function createToken(userId: string) {
  return new SignJWT({ userId }).setProtectedHeader({ alg: "HS256" })
    .sign(getSecret());
}
```

**Avantages** :
- Le module peut être importé sans crash.
- Meilleure testabilité (on mocke `getSecret`).

**Inconvénients** :
- **Ne fail-fast pas** : une erreur de conf peut passer inaperçue
  pendant plusieurs jours si aucun endpoint auth n'est appelé.
- Multiplie les appels à `process.env` (petit surcoût).

### Option C — `process.exit(1)` au chargement

**Rejeté** : brutal, empêche tout `catch` supérieur (utile pour un
supervisor qui logge avant de quitter). Un `throw` fait la même chose
en laissant Node afficher la stack proprement.

### Option D — Fallback dev-only (`if NODE_ENV === "development"`)

```ts
const secret = process.env.JWT_SECRET
  || (process.env.NODE_ENV === "development"
        ? "dev-only-do-not-use-in-prod-abc123"
        : (() => { throw new Error("..."); })());
```

**Rejeté** : c'est **exactement** le pattern qui a créé BUG-001. Si un
développeur commit une image Docker avec `NODE_ENV=development` par
inadvertance, la faille revient. On préfère forcer la définition en
dev aussi (déjà faite dans `.env.local`).

## Option retenue : **A — `throw` au chargement**

Motivations principales :
1. **Fail-fast strict** — la sécurité de l'auth ne doit **jamais**
   dépendre d'un chemin d'exécution.
2. **Alignement avec §4 de CODING_RULES** : « aucun fallback hard-codé
   pour JWT_SECRET, clés API, tokens ».
3. **Testabilité acceptable** : Vitest peut charger le module après
   avoir positionné la variable, ou utiliser `vi.resetModules()` pour
   tester le cas d'erreur.

## Plan d'implémentation

1. Modifier `src/lib/auth.ts` (patch minimal, 5 lignes).
2. Créer `.env.example` à la racine (documente `JWT_SECRET`).
3. Créer `src/lib/auth.test.ts` (double validation §13.5) :
   - test 1 : `JWT_SECRET=x` → `hashPassword` + `verifyPassword` + round-trip token OK.
   - test 2 : `JWT_SECRET` absent → import throw.
4. Mettre à jour `SECURITY.md` (P1 BUG-001 marqué corrigé).
5. Mettre à jour `DEV_ENVIRONMENT.md` (renforcer la mention obligatoire).
6. Mettre à jour `BUGS.md` (déplacer BUG-001 en Corrigés).
7. `npm run typecheck && npm run build && npm test && npm run ai:check`.
8. Commit.

## Plan de rollback

`git revert HEAD` — le fallback revient. Aucun autre effet.

## Critères d'acceptation

Voir `CURRENT_TASK.md`. Les preuves acquises (🔨/🧪/▶️) sont consignées
dans `TRACEABILITY.md` pour audit §22 futur.
