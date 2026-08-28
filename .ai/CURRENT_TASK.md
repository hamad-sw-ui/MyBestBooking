# 🎯 TÂCHE EN COURS

**Tâche :** Correctifs de l'audit fonctionnel n°5 — modération des avis,
bouclage du parrainage, motif de suspension tracé, garde RSC de la page d'avis.
**ID** : T-125 — 1 migration additive, comportements finance/avis.
**Niveau** : S
**Statut** : **CORRIGÉ (VALIDÉ)** — 2026-08-28.

## Périmètre

- **P1** : modération des avis pilotée par réglage admin
  `reviews.requireModeration` (défaut `false` = publication immédiate
  historique ; `true` → avis `pending` alimentant la file `/dashboard/reviews`).
  Un auteur voit ses propres avis non approuvés (sans fuite).
- **P2** : bouclage du parrainage — migration `0017` (`users.referred_by`,
  `users.referral_rewarded_at`), code généré à l'inscription, `referralCode`
  accepté au register (non bloquant), champ + `?ref=` au formulaire
  d'inscription, récompense idempotente au séjour terminé (parrain +10 €,
  filleul +5 €, réglables dans `bestrewards.referral`).
- **P3** : le motif de suspension (`reason`) est journalisé dans l'audit.
- **P4** : page de dépôt d'avis en Server Component avec garde (connecté,
  UUID valide, réservation propre, séjour terminé) → `notFound()` sinon ;
  formulaire extrait dans `<ReviewForm/>`.

## Sortie (validé)

- 🔨 typecheck 0 erreur · lint 0 erreur (15 warnings préexistants) · build ✓.
- 🧪 `npm test` **245/245** (38 fichiers ; +5 tests `src/lib/referral.test.ts`).
- ▶️ `npm run smoke` **94/94** · `npm run ai:check` **20/20**.
- ▶️ E2E 3 rôles : parrainage (lien, récompense, idempotence), modération
  (pending/public/admin), motif d'audit, gardes RSC — voir
  `REPORTS/validation_T-125_2026-08-28.md`.

> Voir `REPORTS/analyse_impact_T-125_2026-08-28.md` (§14) et
> `REPORTS/analyse_conception_T-125_2026-08-28.md` (§15.1).
