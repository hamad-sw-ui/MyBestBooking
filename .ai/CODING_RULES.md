# 📏 CODING_RULES — règles non négociables

Ce document fixe les règles de gouvernance et de rigueur qui s'appliquent à
toute intervention sur MyBestBooking. Les conventions de style de bas niveau
(nommage, imports, patterns Next.js/Drizzle) vivent dans `CODING_STYLE.md` ;
ici on parle **rigueur, preuves, proportionnalité, clôture**.

Les sections numérotées §13, §14, §15, §16, §17, §22 sont citées ailleurs
dans le framework et **ne doivent pas être renumérotées**.

---

## §1 Portée

S'applique à tout `.ts`, `.tsx`, `.js`, `.mjs`, `.sql`, `.json` du dépôt,
ainsi qu'à tout fichier de `.ai/` (la documentation est du livrable au même
titre que le code).

## §2 Précédence des sources

En cas de conflit :

1. `STATE.md` prime pour l'état courant.
2. `CODING_RULES.md` (ce document) prime pour les règles.
3. `framework.manifest.json` prime pour les règles machine-lisibles.
4. Le code réel prime sur toute doc `.ai/` **pour décrire ce qui existe**.
5. Le responsable humain prime sur tout ce qui précède.

## §3 Types et validation

- `tsconfig.json` en `strict: true` — ne pas relâcher.
- Zéro `any` sans commentaire justifiant en ligne.
- Toute entrée externe (body HTTP, searchParams, cookie) passe par **Zod**.
- Réutiliser les types exportés par `@/db/schema` (`User`, `Property`,
  `Booking`, `Review`, etc.) plutôt que de dupliquer.

## §4 Sécurité

- **Aucun secret** en clair dans le repo. Pas de fallback hard-codé pour
  `JWT_SECRET`, clés API, tokens.
- Cookie de session : toujours `HttpOnly`, `SameSite=Lax` minimum, `Secure`
  en prod.
- Mots de passe : hachage `bcryptjs` coût ≥ 12. Jamais renvoyés par l'API.
- Toute mutation qui modifie une ressource appartenant à un utilisateur
  vérifie l'appartenance **avant** d'appliquer.
- Voir `SECURITY.md` pour le détail du modèle.

## §5 Erreurs

- **Interdit** : `catch (e) {}` vide.
- Toute erreur serveur → `console.error("<contexte>", error)` + réponse
  neutre côté client (`{error: "Une erreur est survenue"}`).
- Zod → `400 {error: error.issues[0].message}`.
- Auth manquante → `401`. Pas les bons droits → `403` (ou `401` si on ne
  veut pas révéler l'existence de la ressource).

## §6 Base de données

- Un seul pool `pg` (exporté par `src/db/index.ts`).
- Toutes les requêtes passent par `db` (Drizzle typé) sauf `sql\`select 1\``
  du health check.
- Pas de concaténation SQL. Toujours paramétrer.
- Toute modification de `src/db/schema.ts` **doit** être accompagnée d'une
  migration Drizzle générée et commitée dans `drizzle/`.
- Toute suppression de colonne ou de table est de niveau **C** et exige un
  ADR + une stratégie de rollback documentée.

## §7 Interface

- RSC par défaut. `"use client"` seulement pour hooks/état/événements.
- Icônes via `lucide-react` exclusivement.
- Français côté utilisateur ; conserver la cohérence.
- Accessibilité minimum : `alt` sur les images, `sr-only` sur les icônes
  seules, contraste AA.

## §8 Git

- Une session = une branche = **`arena/01a01eee-mybestbooking`**. Ne pas
  bifurquer.
- Commits atomiques : un commit = une intention. Message : impératif
  présent, décrit **le pourquoi** en plus du quoi.
- Format recommandé : `<type>(<scope>): <résumé>` où type ∈ `feat`, `fix`,
  `docs`, `refactor`, `chore`, `test`, `perf`, `sec`.

## §9 Dépendances

- Toute nouvelle dépendance runtime justifie sa présence par écrit dans
  `DEPENDENCIES.md`.
- Épingler les versions majeures des paquets critiques (`next`, `react`,
  `drizzle-*`, `eslint-config-next`, `tailwindcss`, `zod`, `jose`).

## §10 Tests

Voir `TEST_PLAN.md` pour la stratégie complète. En résumé :

- Une fonction utilitaire pure (`src/lib/utils.ts`) sans test unitaire est
  un défaut.
- Un handler API sans au moins un test d'intégration nominal est un défaut.
- Une régression réintroduite deux fois exige un test de non-régression.

## §11 Documentation

- Toute modification du schéma DB → `DATABASE.md` mis à jour dans le même
  commit.
- Toute nouvelle route API ou changement de contrat → `API.md`.
- Tout écart avec l'architecture cible → `ARCHITECTURE.md` (section
  « Écarts et zones grises »).
- Toute décision structurante → ADR (`ADR/ADR-NNN_…md`).

## §12 Périmètre autorisé

Ne traiter qu'**une seule tâche à la fois**, celle décrite dans
`CURRENT_TASK.md`. Toute dérive de périmètre non triviale exige la validation
explicite du responsable.

---

## §13 Définition de « terminé » (règle de clôture)

Un correctif ou une fonctionnalité est **terminé** quand **toutes** les
conditions ci-dessous sont réunies :

1. **§13.1 Typecheck** : `npm run typecheck` passe sans erreur.
2. **§13.2 Build** : `npm run build` réussit.
3. **§13.3 Lint** : `npm run lint` passe (ou les warnings restants sont
   documentés).
4. **§13.4 Tests** : `npm test` passe (dès qu'un runner sera installé) ; les
   tests couvrant le code modifié existent et passent.
5. **§13.5 Double validation** (niveau **C** uniquement) : le comportement
   est validé par une **implémentation** ET par un **test automatisé
   indépendant** rédigé après ou en parallèle, pas dérivé du même
   raisonnement.
6. **§13.6 Zéro régression** : les fonctionnalités adjacentes ont été
   testées manuellement et n'ont pas dégradé.
7. **§13.7 Documentation** : `STATE.md`, `PROGRESS.md`, `BACKLOG.md`,
   `BUGS.md`, `TRACEABILITY.md` sont à jour.

**Statuts autorisés** :

- `PLANIFIÉ` — la tâche est dans le backlog
- `EN COURS` — `CURRENT_TASK.md` la référence
- `CORRIGÉ (INSPECTION)` — code livré, §13 pas encore prouvé
- `CORRIGÉ (VALIDÉ)` — §13 prouvé et documenté (avec preuves 🔨/🧪/▶️)
- `RÉGRESSION` — un item validé cesse de fonctionner (redevient `EN COURS`)

Tant que §13 n'est pas prouvé, le statut est **`CORRIGÉ (INSPECTION)`**,
jamais `CORRIGÉ (VALIDÉ)`.

## §14 Analyse d'impact préalable

Avant toute modification de niveau **L**, **S** ou **C**, rédiger un
document dans `REPORTS/analyse_impact_<date>_<sujet>.md` qui répond aux
**9 questions** :

1. **Quoi** — qu'est-ce qui change exactement ?
2. **Où** — quels fichiers, quelles lignes, quels symboles ?
3. **Pourquoi** — quel problème cela résout ? quelle valeur ajoutée ?
4. **Appelants** — qui appelle le code modifié ? (`grep -rn` obligatoire)
5. **Contrat public** — le changement casse-t-il une API, un type exporté,
   un schéma DB, un contrat de route ?
6. **Migration** — que doit faire l'existant pour ne pas casser ? migration
   DB ? invalidation de cache ? rotation de secret ?
7. **Sécurité** — le changement introduit-il une nouvelle surface d'attaque,
   une élévation de privilèges, une fuite de données ?
8. **Test** — comment vérifier que ça marche ? comment vérifier que ça n'a
   rien cassé ?
9. **Rollback** — comment revenir en arrière si ça casse en prod ?

Niveau **L** : version allégée acceptée (points 1, 2, 4, 8).
Niveaux **S** et **C** : les 9 points sont **obligatoires**.

## §15 Conception et débat multi-rôles

### §15.0 Proportionnalité

La profondeur des rituels **suit l'impact, pas la taille du diff** :

| Niveau | Exemple | Impact | Conception | Débat | Opportunités | ADR |
|---|---|---|---|---|---|---|
| **T** | typo | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| **L** | refactor interne | allégée | ⬜ | ⬜ | ⬜ | ⬜ |
| **S** | route API, page, signature | ✅ | ✅ | si désaccord | ✅ | ✅ |
| **C** | auth, paiement, migration | ✅ | ✅ | ✅ | ✅ | ✅ + double validation |

### §15.1 Document de conception (S, C)

Rédiger `REPORTS/analyse_conception_<date>_<sujet>.md` : options considérées,
option retenue, alternatives écartées avec raisons, schéma d'architecture si
pertinent, plan de migration.

### §15.2 Débat multi-rôles (C, ou S en cas de désaccord)

Toute décision technique de niveau **C** doit être raisonnée successivement
selon les **11 rôles** définis dans `PROMPTS/roles.md` :

1. Architecte
2. Développeur Next.js senior
3. Expert TypeScript
4. Expert React (RSC / Client)
5. Expert Drizzle / SQL
6. Expert PostgreSQL
7. Expert sécurité web (auth, cookies, CSP)
8. Ingénieur QA
9. DevOps / SRE
10. Expert UX / a11y
11. Relecteur (advocatus diaboli)

Chaque rôle produit un avis en 3-5 lignes maximum, avec objection éventuelle.
Le débat est consigné dans
`REPORTS/debat_technique_<date>_<sujet>.md`.

## §16 Honnêteté technique (tags de preuve)

Toute affirmation factuelle dans un rapport, un commentaire de PR ou
`PROGRESS.md` **doit** être qualifiée par l'un des tags suivants :

| Tag | Signification |
|---|---|
| 🔍 **OBSERVED** | J'ai lu le code / le fichier / la sortie |
| 🔨 **COMPILED** | `npm run typecheck` / `npm run build` a réussi |
| 🧪 **TESTED** | Un test automatisé passe |
| ▶️ **EXECUTED** | J'ai lancé la commande / cliqué sur le bouton |
| 🧠 **DEDUCED** | Raisonnement plausible non vérifié |
| ❓ **HYPOTHESIS** | Supposition à confirmer |

**Interdit** :

- Affirmer qu'un correctif « fonctionne » sans 🔨 ni ▶️ ni 🧪.
- Marquer un item `CORRIGÉ (VALIDÉ)` avec seulement des 🧠 ou ❓.
- Cacher une impossibilité de vérification : préférer « ❓ non testé,
  environnement Docker indisponible » à un silence.

## §17 Rétrospective de session

À la fin de chaque session non triviale, ajouter une entrée dans
`PROCESS_IMPROVEMENTS.md` :

- Ce qui a bien marché.
- Ce qui a mal marché.
- Ce qui pourrait être ajouté au framework (proposition à discuter, pas
  application automatique).
- Ce qui pourrait être **retiré** — si une règle n'a servi personne en
  3 sessions, elle est candidate à la suppression.

## §18–§21 (réservés)

Numéros réservés pour compatibilité avec le framework AI-DOS d'origine.
Peuvent être utilisés pour de futures règles sans casser les références
existantes.

## §22 Audit des preuves

À la demande du responsable, ou en début de session, tout item marqué
`CORRIGÉ (VALIDÉ)` peut être **audité** :

1. Retrouver la preuve associée dans `TRACEABILITY.md`.
2. Rejouer la preuve : relancer le test, la commande, la requête curl.
3. Si la preuve n'est plus reproductible → repasser l'item en
   `RÉGRESSION`, ouvrir une entrée `BUGS.md`.

Un item validé sans ligne dans `TRACEABILITY.md` est **considéré comme non
validé** et retourne en `CORRIGÉ (INSPECTION)`.

---

## Application

Ces règles sont opposables. Une intervention qui les enfreint sans
justification écrite peut être **refusée** par le responsable et redemandée.
L'objectif n'est pas la bureaucratie mais la traçabilité : chaque règle
existe pour éviter une classe d'erreurs déjà rencontrées.
