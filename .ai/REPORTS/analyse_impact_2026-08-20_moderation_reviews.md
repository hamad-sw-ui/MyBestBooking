# 📊 Analyse d'impact — T-023 Modération d'avis admin

- **Date** : 2026-08-20 (Session 7, suite)
- **Tâche** : T-023 — Modération d'avis admin (endpoint + UI)
- **Niveau** : **S** (nouvel endpoint mutation, refactor UI existante,
  invariant averageRating à préserver, aucune migration DB)
- **Auteur** : Arena Agent Mode

## §14 — 9 questions obligatoires

### 1. Quoi

Permettre à un admin de **modérer** un avis (`reviews.status`) via une
UI dans `/dashboard/reviews` : approuver, masquer, rejeter. Recalculer
`properties.averageRating` et `properties.totalReviews` de manière
atomique après chaque changement (invariant T-007).

Statuts autorisés (déjà supportés par le schéma existant) :

- `approved` — visible publiquement (défaut historique).
- `pending` — en attente de modération, invisible publiquement.
- `hidden` — masqué par un modérateur, invisible publiquement.
- `rejected` — refusé (contenu inapproprié), invisible.

Seuls `approved` compte dans les moyennes.

### 2. Où

Nouveau fichier :

- `src/app/api/reviews/[id]/moderate/route.ts` — `PATCH` admin-only.
- `src/components/admin/review-moderate-actions.tsx` — client, 3 boutons
  (Approuver, Masquer, Rejeter) + statut.
- `.ai/REPORTS/analyse_impact_2026-08-20_moderation_reviews.md` (ce
  document).
- `.ai/REPORTS/analyse_conception_2026-08-20_moderation_reviews.md`
  (§15.1).
- `src/app/api/reviews/[id]/moderate/route.test.ts` — test intégration
  DB-backed (403 non-admin, 404 review inconnue, 200 admin, recalcul
  averageRating).

Modifiés :

- `src/app/dashboard/reviews/page.tsx` — insertion du bloc
  `<ReviewModerateActions>` quand `isAdmin`, affichage du statut,
  bandeau explicatif pour `pending`/`hidden`/`rejected`.

Pas de changement de schéma DB.

### 3. Pourquoi

Feature promise dans `FEATURES.md` (« Modération d'avis » = ❌) et
manque identifié dans `BACKLOG.md → T-023`. La colonne `reviews.status`
existait depuis le seed mais aucun endpoint ne l'écrivait, aucune UI
ne l'affichait, et aucune vérification n'était faite du recalcul de
`averageRating` en cas de changement.

Valeur : réponse aux avis inappropriés ou faux (obligation légale
DSA en Europe), défense de la marque.

### 4. Appelants

`grep -rn "reviews.status\|status.*approved" src/` :

- `src/app/api/reviews/route.ts:GET` — filtre `status || "approved"`
  (voyageur ne voit que approved par défaut).
- `src/app/api/reviews/route.ts:POST` — après création, recalcule
  `averageRating` avec un `AVG` filtré sur `status='approved'`.
- `src/db/schema.ts` — index composé `(propertyId, status)` déjà en
  place → aucune requête n'exigera d'être rejouée pour la performance.
- Pas d'autre caller. La fiche property et la page recherche filtrent
  déjà par status='approved'.

### 5. Contrat public

- **Nouveau** endpoint `PATCH /api/reviews/[id]/moderate` — additif.
- **Aucune** signature existante ne change. `GET /api/reviews?status=X`
  continue de fonctionner exactement pareil.
- Le recalcul `averageRating` utilise la **même expression SQL** que
  `POST /api/reviews` (T-007) → cohérence garantie.

### 6. Migration

Aucune. Le champ `status` existait déjà avec un défaut `"approved"`.
Les avis historiques restent visibles inchangés.

### 7. Sécurité

- Endpoint gardé par `role === 'admin'` (403 sinon), même pattern que
  `/api/users/[id]/suspend`, `/api/properties/[id]/validate`.
- Payload validé Zod : whitelist stricte `status ∈ {approved, pending,
  hidden, rejected}` + `moderationReason?: string ≤ 500`.
- Rate-limit léger `admin:review-moderate:${user.id}` : 60/min.
- Log de modération : `console.info("[reviews] admin=%s review=%s
  %s→%s")` — traçabilité minimale (ADR-007 § « À suivre » : sera
  intégrée à `audit_log` T-024 quand livré).
- Aucune PII exposée en réponse au-delà des champs déjà retournés
  par `GET /api/reviews`.

### 8. Test

Unitaires (route.test.ts DB-backed) :

- Non-admin → 403 « Accès admin requis ».
- Admin sur review inconnue → 404.
- Admin change `approved` → `hidden` → 200 + averageRating recalculé
  (l'avis n'est plus compté).
- Admin change `hidden` → `approved` → 200 + averageRating remonte.
- Zod refuse `status: 'foo'` → 400.

Manuel ▶️ :

1. Login admin → `/dashboard/reviews` → chaque avis affiche un badge
   statut + 3 boutons.
2. Cliquer « Masquer » sur un avis 9/10 → statut passe à `hidden`,
   averageRating de la property recule.
3. Cliquer « Approuver » → revient à `approved`, moyenne remonte.
4. En tant que voyageur, `GET /api/reviews?propertyId=X` ne retourne
   pas les avis `hidden/rejected/pending`.

### 9. Rollback

- `git revert` du commit → l'endpoint disparaît, l'UI redevient
  lecture seule pour admin. Aucune donnée à restaurer.
- Rollback partiel possible : supprimer le composant client sans
  toucher à l'endpoint (ou vice versa).
