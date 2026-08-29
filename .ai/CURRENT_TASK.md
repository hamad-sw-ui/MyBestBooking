# 🎯 TÂCHE EN COURS

**Tâche :** T-143 — suite de l'audit n°19 : rendre l'onglet BestRewards de
« Mon compte » piloté par les réglages (il codait en dur seuils 5/15, taux
10/15/20 % et promettait un « Petit-déj. » qui n'existe dans aucun réglage).

**Problème.** Seuls `Mon compte` figeait les paramètres BestRewards ; la page
publique `/bestrewards` et `BestRewardsStatus` lisent déjà les réglages. Divergence
si un admin change les valeurs + avantage inventé (« Petit-déj. »).

**Solution (additive, sans migration).**
- 🔨 `src/app/api/app-preferences/route.ts` (route publique existante) : ajout de
  `bestrewards:{thresholds,discounts}` (non sensible, déjà public sur /bestrewards).
- 🔨 `src/app/(main)/mon-compte/page.tsx` : lit `/api/app-preferences` au montage
  (repli sur les valeurs par défaut si échec) ; niveaux dérivés des réglages,
  vocabulaire aligné sur la page publique, mention « Petit-déj. » supprimée ;
  progression et « Plus que N réservations » restent dynamiques.

**Environnement restauré** (re-clone) : `.env.local` recréé, Postgres embarqué
redémarré, `db:push`, `POST /api/seed` → 3 comptes démo + 8 propriétés +
32 réservations.

**ID** : T-143 — additif.
**Niveau** : L
**Statut** : **CORRIGÉ (VALIDÉ)** — 2026-08-29.

## Sortie (validé — T-143)

- 🔨 `tsc` 0 · `eslint` 0. 🧪 `vitest` **288 passés (42 fichiers)**.
- ▶️ `smoke` **94/94** · `build` ✓ (Compiled successfully, **59 pages**) ·
  `ai:check` **19 OK · 1 warn · 0 fail**.
- ▶️ DEV + PROD (`next start` 3100, arrêté) : `app-preferences` renvoie
  bestrewards ; admin passe à [7,20]/[12,18,25] → API reflète immédiatement
  (puis restore [5,15]/[10,15,20]).
- 🧹 Résa smoke supprimée → **32 réservations**.
- Rapport : `.ai/REPORTS/validation_T-143_2026-08-29.md`.
