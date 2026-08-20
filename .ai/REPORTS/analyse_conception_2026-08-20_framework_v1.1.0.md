# Conception — T-011 : Framework v1.1.0

- **Date** : 2026-08-20 · **Niveau** : C · **Ref** : §15.1

## Options considérées

### Option A — 4 règles automatisées + 2 nouveaux docs (retenu)

R14 (schéma↔API), R15 (UI↔API), R16 (hygiène BACKLOG),
R17 (fraîcheur FEATURES/PROGRESS) + `FEATURES.md` +
`PRODUCT_ACCEPTANCE.md`.

**Avantages** :
- Les 4 règles couvrent 4 angles morts distincts.
- Docs additionnels documentent l'intention produit.
- Extensible : R18 Playwright, R19 test-per-endpoint viendront après.

**Inconvénients** :
- 4 nouvelles règles à écrire et à maintenir.
- FEATURES.md doit être tenu à jour manuellement (partiellement mitigé
  par R17).

### Option B — Une seule règle « produit » qui parse FEATURES.md

Une seule règle R14 qui compare `FEATURES.md ✅` à la présence
d'endpoints et fichiers.

**Rejetée** : trop couplée à un format `FEATURES.md`. Casserait si
quelqu'un change le format.

### Option C — Externaliser à Playwright + tags @required

Chaque parcours critique = un test Playwright avec `@required`. Un
grep sur `@required` détecte les manques.

**Rejetée** comme substitut (couvre seulement les parcours, pas les
endpoints), mais **retenue comme complément** (Playwright installé,
R18 futur).

### Option D — Générer FEATURES.md par introspection code

Un script parse `src/db/schema.ts` + `src/app/api/**/route.ts` +
`src/app/**/page.tsx` et génère `FEATURES.md` automatiquement.

**Rejetée** : perdrait la dimension « ce qu'on veut faire vs. ce qu'on
fait ». FEATURES doit exprimer l'ambition, pas juste l'inventaire.

## Option retenue : **A**

## Format `FEATURES.md`

Une seule table par domaine, avec 4 colonnes :

| Feature | État | Preuve | Traçabilité |
|---|---|---|---|
| Inscription email/mot de passe | ✅ | POST /api/auth/register + test | T-001 |
| Envoi email de vérification | ❌ | — | à faire T-013 |

**États normalisés** :
- ✅ livré + testé
- 🚧 partiel (préciser dans « Preuve » ce qui manque)
- 🎯 promis (planifié, tracé, non commencé) — utilise le nouveau tag
- ❌ absent, non planifié

**Sortie R14** : parse ce document et compte les ❌/🎯. Fail si
featureCount(❌) > seuil défini dans manifest (défaut : illimité,
uniquement warning).

## Format `PRODUCT_ACCEPTANCE.md`

Une liste de parcours utilisateur numérotés :

```
### PAR-001 — Réservation nominale
Utilisateur crée un compte, cherche à Paris, réserve une chambre,
paie, reçoit un email de confirmation, retrouve sa réservation.
- Test E2E : tests/e2e/par-001-booking.spec.ts (❌ à créer)
- État : 🚧 (booking OK, paiement mocké, email absent)
```

**Sortie R18 (futur)** : chaque `PAR-xxx` doit avoir un
`tests/e2e/par-xxx-*.spec.ts` qui passe.

## Format R14

```js
// Pour chaque table (hors sessions), au moins un route.ts qui
// mentionne le nom de la table.
const EXPECTED_ENDPOINT_TABLES = [
  "users", "properties", "rooms", "ratePlans", "roomAvailability",
  "bookings", "reviews", "wishlists", "wishlistItems", "conversations",
  "messages", "promotions"
];
const EXEMPTED_TABLES = ["sessions"];
```

Un endpoint pour `bookings` couvre-t-il `bookings` ? On accepte oui
si `src/app/api/bookings/route.ts` existe et contient le mot `bookings`.
Pragmatique, pas parfait mais utile.

## Format R15

Cherche dans tous les `.tsx` sous `src/app/`:
- boutons avec label matché par `/\b(Envoyer|Répondre|Publier|Annuler|Valider|Supprimer|Uploader|Enregistrer|Sauvegarder|Confirmer)\b/i`
- fetch `/api/` dans le même fichier OU import d'une Server Action

Si mismatch : warning avec la liste des fichiers concernés.

## Format R16

- Lit `BACKLOG.md` section « Sécurité », « Base de données »… (les 🔴)
- Lit `BUGS.md` section « Corrigés »
- Match textuel : si un item BACKLOG contient un mot-clé aussi présent
  dans Corrigés (« JWT_SECRET », « middleware », « rate-limit »), warn.
- Aussi : match `BUG-\d+` dans autres docs qui n'existe ni dans Ouverts
  ni dans Corrigés → fail (référence orpheline).

## Format R17

Utilise `git log --format=%h -- <path>` :
- Compte les commits qui ont touché `src/app/api/**` ou `src/db/schema.ts`
  depuis le dernier commit qui a touché `FEATURES.md`. Si > 30 → warn.
- Idem `PROGRESS.md` vs. n'importe quel `src/**` (hors T triviaux) : > 5 → warn.

## Plan d'implémentation

1. Créer ADR-006 + rapports impact/conception/débat.
2. Bump manifest v1.1.0 + changelog + nouveaux mandatory_documents.
3. Créer squelettes `FEATURES.md` + `PRODUCT_ACCEPTANCE.md` peuplés
   à partir de l'analyse Session 5.
4. Étendre `check-ai.mjs` avec R14-R17.
5. Installer Playwright (dev-dep) + `playwright.config.ts` + un test
   d'exemple minimal (`smoke.spec.ts`).
6. Réécrire `BACKLOG.md` en 4 sections claires : Sécurité résiduelle,
   Fonctionnalités manquantes, Qualité, Idées produit.
7. Nettoyer `KNOWN_LIMITATIONS.md`.
8. Mettre à jour INDEX, STATE, PROGRESS, TRACEABILITY,
   PROCESS_IMPROVEMENTS, CODING_RULES (§16 tag PROMISED).
9. `npm run ai:check` → lister les nouveaux warns/fails.
10. Commit.
