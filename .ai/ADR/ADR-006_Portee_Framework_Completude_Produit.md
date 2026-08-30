# ADR-006 — Élargir la portée du framework à la complétude produit

- **Date** : 2026-08-20 (Session 5)
- **Statut** : accepté
- **Niveau** : **C** (change les règles opposables §15.0-bis)
- **Tâche** : T-011 (framework v1.1.0)
- **Rapports** :
  - `REPORTS/analyse_impact_2026-08-20_framework_v1.1.0.md`
  - `REPORTS/analyse_conception_2026-08-20_framework_v1.1.0.md`
  - `REPORTS/debat_technique_2026-08-20_framework_v1.1.0.md`

## Contexte

À la fin de Session 4, `npm run ai:check` retournait **11 OK, 2 warn, 0 fail**.
Le framework se déclarait irréprochable. Pourtant, en Session 5, une simple
question du responsable (« fais l'analyse et dis-moi tout ce qui manque ») a
révélé **~40 défauts produit** que le framework n'avait pas signalés :

- Aucun endpoint pour envoyer un message
- Aucun endpoint pour répondre à un avis
- Aucun endpoint upload d'images
- Aucune validation admin des properties
- Aucun email envoyé (confirmation, verification, reset password)
- Aucune vérification de disponibilité avant réservation
- Aucun code promo appliqué
- Aucun endpoint pour rate_plans, room_availability, promotions, conversations, messages
- etc.

**Diagnostic** : le framework AI-DOS Web v1.0.3 était un framework de
**discipline de codeur** (règles de rigueur : impact, conception, preuve,
audit, honnêteté), pas un framework de **complétude produit** (est-ce que
le produit fait vraiment ce qu'il promet ?).

Les 13 règles R1-R13 vérifient des **cohérences internes** entre documents
`.ai/`. Elles ne peuvent structurellement pas détecter :

- Une fonctionnalité qui **devrait exister** et n'a jamais été créée
- Un bouton UI dont l'action côté serveur n'existe pas
- Une table DB sans endpoint API associé
- Un parcours utilisateur cassé faute d'implémentation

Le framework hérite des angles morts de celui qui l'écrit. Si l'auteur oublie
d'ajouter un item à `BUGS.md`, le framework ne le trouvera jamais.

## Décision

**Élargir la portée d'AI-DOS Web** de « discipline de processus » à
« discipline **et** complétude produit ». Pour cela :

### 1. Nouveaux documents obligatoires

- **`FEATURES.md`** — inventaire exhaustif des capacités produit avec
  état ✅ (livré+testé) / 🚧 (partiel) / ❌ (absent), regroupées par
  domaine (Auth, Réservation, Paiement, Messagerie, Hôte, Admin, Emails,
  Uploads, i18n, Observabilité…). Source de vérité de « ce que le
  produit devrait faire ».
- **`PRODUCT_ACCEPTANCE.md`** — parcours utilisateur critiques
  (register → search → book → pay → mail confirm), chacun avec un
  test E2E Playwright associé et un état ✅/🚧/❌.

### 2. Quatre nouvelles règles automatisées

- **R14 — Couverture schéma DB ↔ API** : pour chaque table de
  `src/db/schema.ts` (hors tables techniques comme `sessions`), au
  moins un endpoint `/api/<table>` doit exister sous `src/app/api/`.
  Warning si couverture partielle, fail si aucun endpoint.

- **R15 — Couverture UI ↔ API** : scanner tous les composants `.tsx`
  qui contiennent un `<button>` avec un `aria-label` ou un label
  d'action métier (`Envoyer`, `Répondre`, `Publier`, `Annuler`,
  `Valider`, `Uploader`). Warning si le composant ne contient pas
  d'appel `fetch("/api/…")` ou de Server Action référencée.

- **R16 — Hygiène BACKLOG et BUGS** : détecte les items 🔴/🟠 de
  `BACKLOG.md` qui référencent une chose déjà présente dans `BUGS.md`
  section « Corrigés ». Détecte les items `BUG-xxx` qui n'existent
  ni dans « Ouverts » ni dans « Corrigés » (référence orpheline dans
  d'autres docs).

- **R17 — Fraîcheur FEATURES/PROGRESS** : `FEATURES.md` doit avoir
  été modifié dans les 30 derniers commits qui touchent
  `src/app/api/` ou `src/db/schema.ts`. `PROGRESS.md` doit avoir été
  modifié dans les 5 derniers commits (hors T triviaux).

### 3. Rituel d'audit produit périodique

Toutes les 5 tâches VALIDÉ ou tous les 10 commits, une **session
d'audit produit** est déclenchée : lecture de `FEATURES.md`,
comparaison avec `schema.ts`, `src/app/api/`, `src/app/**/page.tsx`,
et régénération d'un rapport `REPORTS/audit_produit_<date>.md` qui
soulève les manques.

Cette règle est **traçable** mais non-mécanisable dans `check-ai.mjs`
(elle demande jugement humain). Elle sera enregistrée comme
`blocking_rules → periodic_product_audit` avec
`implemented: false, note: "rituel humain, à programmer manuellement"`.

### 4. Nouveau tag §16

- 🎯 **PROMISED** — la fonctionnalité est **promise dans `FEATURES.md`**
  mais son implémentation est encore partielle ou absente. Un item
  peut être `PROMISED` sans être `HYPOTHESIS` : on l'a décidée, on ne
  l'a pas encore livrée.

Ce tag permet de tracer honnêtement le delta entre l'ambition et la
réalité livrée. Une PR qui **retire** une promesse doit expliquer
pourquoi en rétrospective §17.

## Alternatives écartées

- **Ne rien changer** — laisse le framework aveugle aux manques
  produit, qui vont réapparaître sous forme de bugs en prod.

- **Créer un framework séparé pour la complétude** — dispersion,
  perte de la traçabilité unique.

- **Se contenter d'un README FEATURES sans règles automatisées** —
  documente mais ne vérifie pas. Retour au vice initial : « la
  discipline seule ne suffit pas ».

- **Externaliser à un outil (Playwright + tags @required)** —
  couvre R15 partiellement mais pas R14, R16, R17. Complémentaire,
  pas substitut.

## Conséquences

### Positives

- Le framework passe de « surveillant de processus » à « garant
  de livraison ». Il peut détecter :
  - qu'une table `conversations` existe sans endpoint POST
  - qu'un bouton « Répondre » n'a pas de fetch associé
  - qu'un item corrigé traîne dans BACKLOG
  - que FEATURES n'a pas été mis à jour depuis 30 commits API
- L'auteur ne peut plus se cacher derrière « c'est corrigé » sans
  que la promesse produit soit vraiment livrée.

### Négatives

- Coût de maintenance de `FEATURES.md` et `PRODUCT_ACCEPTANCE.md`
  (à chaque nouvelle capacité, mettre à jour l'inventaire).
- Faux positifs possibles sur R14 (tables techniques comme
  `sessions` ne doivent pas avoir d'endpoint) → maintenir une
  liste d'exceptions dans le manifest.
- Le tag 🎯 PROMISED force à distinguer « pas encore fait » de
  « ne sera pas fait » — plus de nuance mais plus d'écriture.

### À suivre

- Après 3 sessions d'usage, vérifier que R14-R17 attrapent
  effectivement des vrais problèmes et pas juste du bruit.
- Envisager R18 : un test Playwright par parcours de
  `PRODUCT_ACCEPTANCE.md` doit exister.
- Envisager R19 : un endpoint API muté sans test d'intégration
  Vitest = fail.

## Preuves (§16)

- 🔍 nouveaux fichiers créés : `FEATURES.md`, `PRODUCT_ACCEPTANCE.md`
- 🔍 nouvelles règles ajoutées au manifest et à `check-ai.mjs` :
  R14, R15, R16, R17
- 🔨 `npm run typecheck` OK après changements
- ▶️ `npm run ai:check` retourne les nouveaux résultats avec R14-R17
  (fails attendus qui deviennent le vrai backlog Session 5+)

## Signatures

- Auteur : Arena Agent Mode (Session 5)
- Validé par : responsable (validation-cadre 2026-08-20 « comblez les
  manques du projet et du framework »)
