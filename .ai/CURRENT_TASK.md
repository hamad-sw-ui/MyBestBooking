# 🎯 TÂCHE EN COURS

**Tâche :** Audit fonctionnel profond n°19 (T-142) — analyse à l'exécution des
scénarios/éléments inachevés ou mal pensés, explication + solution sans
régression.

**Investigation (3 rôles + anonyme, DEV puis PROD).** Couvert : réglages admin,
billing/export CSV, BestRewards (page publique + statut + mon-compte), aide,
chambres (création/calendrier/tarifs), promotions, messagerie, vote « utile »
avis, recherche (filtres/tri/pagination/vides), favoris(wishlists), tunnel
réservation (dates/capacité/auth), modération+réponse avis, RBAC dashboard,
pages légales, liens footer, préférences, upload photos.

**Anomalie corrigée (P2 — bug d'affichage visible).** FAQ de la page publique
BestRewards : la réponse « Comment monter de niveau ? » était une **chaîne
simple** (guillemets doubles) contenant `${level2Threshold}` /
`${level3Threshold}` non interpolés → l'utilisateur voyait le texte littéral
au lieu des vrais seuils. 🔨 Corrigé en template literal (backticks). Après :
« Après 5 séjours… Après 15 séjours… » (DEV + PROD), aucun littéral résiduel.

**Observation P3 (non corrigée, aucun impact sous config par défaut).** L'onglet
BestRewards de `mon-compte` code en dur seuils (5/15) et libellés d'avantages,
alors que la page publique lit les réglages. Valeurs identiques aux réglages
par défaut → pas de bug visible ; divergence potentielle si un admin change les
réglages. Mise en cohérence laissée de côté (nécessiterait un exposant public
des réglages) pour ne pas risquer de régression.

Tous les autres flux testés sont **sains** (détail dans le rapport).

**ID** : T-142 — correctif additif (1 fichier, aucune migration/route).
**Niveau** : L
**Statut** : **CORRIGÉ (VALIDÉ)** — 2026-08-29.

## Sortie (validé — T-142)

- 🔨 `tsc` 0 · `eslint` 0. 🧪 `vitest` **288 passés (42 fichiers)**.
- ▶️ `smoke` **94/94** · `build` ✓ (Compiled successfully, **59 pages**) ·
  `ai:check` **19 OK · 1 warn · 0 fail** (warn R7 = synchro HEAD).
- ▶️ DEV + PROD (`next start` 3100, arrêté) : FAQ affiche 5/15, 0 littéral
  résiduel. Nombreux garde-fous vérifiés (400/401/403/404/409/307).
- 🧹 Résa smoke supprimée → **32 réservations**.
- Rapport : `.ai/REPORTS/validation_T-142_2026-08-29.md`.
