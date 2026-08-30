# 🎯 TÂCHE EN COURS

**ID** : T-152

**Niveau de proportionnalité** : S

**Titre** : Implémentation des findings de l'audit fonctionnel n°24
(A→E + G) — sans régression.

**Statut** : CORRIGÉ (VALIDÉ) — 2026-08-30

Rapports (exigés §14/§15.1 pour un niveau S, avant tout code) :
- `REPORTS/analyse_impact_T-152_2026-08-30.md`
- `REPORTS/analyse_conception_T-152_2026-08-30.md`
- `REPORTS/opportunites_T-152_2026-08-30.md`
- `REPORTS/validation_T-152_2026-08-30.md`

Source : `REPORTS/audit_fonctionnel_profond24_2026-08-30.md` (T-151).

## Validation (résumé)
🔨 tsc **0 erreur** · lint **0 erreur** (14 warnings préexistants, liste de
fichiers identique à la baseline vérifiée par stash) · build **OK**
(Next.js 16.2.6) · 🧪 vitest **329/329** (47 fichiers, **+13** tests) ·
▶️ smoke **94/94** · 🔨 ai:check **19 OK · 1 warn · 0 fail** (warn STATE
résolu par ce commit) · ▶️ preuves runtime A/B/C/D/E (détails dans
`REPORTS/validation_T-152_2026-08-30.md` §2.2). Playwright E2E : CI-only
(CDN Chromium bloqué ici).

## Périmètre retenu (décision)
- **A** 🟠 : `pending` → bouton « Payer maintenant »
  (`/reservation?booking={id}`) + Annuler autorisé ; reprise auto du
  `resumePayment()` existant à l'ouverture de la page.
- **B** 🟠 : devises réelles dans `/reservation` (`room.currency`,
  `formatPrice` partout) — plus de « € » codé en dur.
- **C** 🟠 : totaux analytics/billing **par devise** (helper
  `currency-summary`, jamais d'addition affichée de devises mélangées).
- **D** 🟠 : sélecteur FR/EN dans le header (PATCH users/me si connecté,
  localStorage si anonyme) + `<html lang>` dynamique + `lang` script.
- **E** 🟠 : état avis — `review` additif sur `GET /api/bookings`, badge dans
  `/mes-reservations`, écran d'état dans `/avis/[id]`.
- **G** ⚪ : smoke auto-suffisant (wishlist créée par le smoke si absente).
- Hors périmètre (proposés, à arbitrer) : migration i18n des 93 composants
  restants, moteur multi-devises transactionnel, arabe — voir
  `REPORTS/opportunites_T-152_2026-08-30.md`.

## Contraintes de non-régression
- AUCUNE modification de schéma, AUCUNE migration, AUCUNE signature d'API
  retirée (champs additifs uniquement) ; contrats 200/400/409/503 inchangés.
- Défauts conservés : langue `fr`, devise EUR (cas réel du seed → rendus
  identiques), CTA avis (avant dépôt).

---

## ℹ️ Audit fonctionnel n°25 (après T-152)

🔍 Rapport produit : `REPORTS/audit_fonctionnel_profond25_2026-08-30.md`
(7 findings A→G, **aucune modification de code**). Les plus intéressants :
**A** wallet EUR appliqué 1:1 à un total USD (preuve runtime
`MBB-2026-9HYHNJ`), **B** promos `fixed_amount` sans devise, **C** cashback
BestRewards crédité sans conversion. En attente de l'arbitrage utilisateur
avant implémentation (A+B recommandés en priorité — véracité monétaire).
