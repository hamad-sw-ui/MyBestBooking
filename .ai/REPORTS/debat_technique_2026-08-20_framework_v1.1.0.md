# Débat technique — T-011 : Framework v1.1.0

- **Date** : 2026-08-20 · **Niveau** : C · **Ref** : §15.2

## Proposition initiale
Option A du rapport de conception : R14-R17 + FEATURES.md +
PRODUCT_ACCEPTANCE.md + tag 🎯 PROMISED + rituel audit produit +
Playwright installé.

## Rôles

### 1. Architecte
Le framework passe de « discipline » à « discipline + complétude ».
C'est un vrai bump de portée, C justifié. Le fait que FEATURES ait
un état ✅/🚧/🎯/❌ crée un langage commun avec le produit. RAS
sauf : bien séparer `FEATURES.md` (inventaire) de `BACKLOG.md`
(actions), sinon on va tout mélanger. Résolu par le format proposé.

### 2. Développeur Next.js senior
Playwright installé mais **pas** dans `npm test` de la CI courte,
seulement dans `npm run e2e` séparé. Bien : Playwright a besoin du
serveur Next lancé + navigateur, on ne veut pas gonfler le
`test` unitaire. RAS.

### 3. Expert TypeScript
R14 utilise un tableau `EXPECTED_ENDPOINT_TABLES` en dur. Fragile
si `schema.ts` change. Proposition : parser `src/db/schema.ts`
dynamiquement pour extraire les `pgTable("nom_table", …)`.
**Contre-argument** : parsing JS de TS est fragile aussi. On garde
la liste en dur dans le script mais on ajoute un test qui vérifie
que la liste match ce qui est dans le schema. Retenu comme suivi.

### 4. Expert React (RSC / Client)
R15 va matcher les labels de bouton en français. Quid des Server
Actions futures ? Ajouter au regex : `useTransition`, `action=`, et
les fetch inline. Résolu — la conception mentionne « fetch OU
Server Action ».

### 5. Expert Drizzle / SQL
RAS pour lui, R14 vérifie juste l'existence d'un route.ts, il ne
regarde pas les requêtes.

### 6. Expert PostgreSQL
Idem, aucun impact.

### 7. Expert sécurité web
**Objection** : R14 ne couvre pas les endpoints qui **devraient**
être admin-only (ex: `/api/promotions` POST). Cette dimension
(RBAC) doit rester dans les analyses d'impact des tâches futures.
Résolu — on ne surcharge pas R14, on documente la limite dans
CODING_RULES §4 (Sécurité).

### 8. Ingénieur QA
Le rituel « audit produit tous les 5 VALIDÉ / 10 commits » est
**non-mécanisable**. Comment l'appliquer réellement ? Proposition :
ajouter un champ `sessions_since_last_product_audit` dans `STATE.md`,
incrémenté à chaque session, remis à 0 après un audit produit. R17
vérifie que ce compteur < 5. Retenu — ajouté à R17.

### 9. DevOps / SRE
Playwright ajoute ~250 MB dans `node_modules` (Chromium). Confirmer
que c'est acceptable. `--with-deps` est même plus lourd. Proposition :
`npx playwright install chromium` uniquement, pas les autres
navigateurs. Retenu.

### 10. Expert UX / a11y
`PRODUCT_ACCEPTANCE.md` est une bonne idée pour tracer les parcours
critiques. Ajouter au moins un parcours a11y (ex: navigation clavier
à travers la home). Retenu — PAR-005 à ajouter.

### 11. Relecteur (advocatus diaboli)
Trois questions gênantes :

1. **Le framework va-t-il continuer d'être en 11 OK ?** Non — et
   c'est le but. Le premier `ai:check` post-v1.1.0 va lister ~10
   fails (R14 : promotions/messages/conversations/rate-plans/
   room-availability sans endpoint ; R15 : bouton Répondre sans
   fetch ; R16 : BACKLOG contient des items déjà corrigés). C'est
   voulu — le framework arrête de mentir.

2. **Ne va-t-on pas décourager les prochaines sessions avec des
   « 12 fails » à chaque run ?** Risque réel. Mitigation : les
   fails R14-R17 sont **informatifs** (couverture partielle) et
   pas bloquants pour committer. Ils sont bloquants pour marquer
   un item `VALIDÉ` sans preuve, ce qui reste conforme à §13.

3. **Qui gère FEATURES.md à jour ?** Réponse : R17 le rappelle
   mécaniquement, et chaque tâche S/C qui ajoute une feature doit
   la cocher dans FEATURES **dans le même commit** (nouvelle règle
   §11 étendue). À documenter.

## Objections bloquantes

| Rôle | Objection | Résolution |
|---|---|---|
| Architecte | Séparer FEATURES et BACKLOG | Format explicite, retenu |
| QA | Rituel non-mécanisable | Compteur dans STATE + R17 |
| DevOps | Poids Playwright | Chromium seul |
| Relecteur | Décourager avec des fails | Fails R14-R17 informatifs, pas bloquant commit |

## Décision finale

**Option A retenue avec 3 amendements** :
1. R14 + test futur qui vérifie la liste vs schema.
2. R17 étendu au compteur `sessions_since_last_product_audit` dans STATE.
3. Playwright installe Chromium seul.

Validé.
