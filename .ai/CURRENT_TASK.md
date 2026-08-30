# 🎯 TÂCHE EN COURS

**ID** : T-159 (clôture du cycle audit n°29 — T-156, T-157, T-158, T-159 implémentés et validés)

**Niveau de proportionnalité** : L (implémentation additive : aucun contrat API public
modifié, aucune migration de schéma, cas EUR numériquement identiques)

**Titre** : Audit n°29 — analyse profonde à l'exécution + implémentation sans
régression : annulation par acteur (host/admin = remboursement intégral),
identité compte en mode connecté, i18n fiche propriété + devise publique,
hygiène sims purge, PATCH settings merge, cohérence 400/409.

**Statut** : **CORRIGÉ (VALIDÉ)**. Preuves : crawl **40 pages × 4 rôles + 30
APIs × 4 rôles = 0 erreur** ; probes runtime `.data/a29/probes.mjs` **30/30
(0 échec)** ; 🔨 `tsc --noEmit` **0 erreur** ; 🧪 `vitest run` **57 fichiers ·
390/390 tests** (+16 nouveaux) ; ▶️ `run_all_sims.py` **5/5 · 396 assertions ·
0 KO (3 WARN statiques justifiés)** · ▶️ `ai:check` vert.

Rapport : `.ai/REPORTS/audit_fonctionnel_profond29_2026-08-30.md` (source).

## Synthèse des findings corrigés

- **🔴 T-156 (P1)** — Annulation par acteur : `CancellationActor`
  (`customer|host|admin|system`) ; hôte/admin → fee 0 + remboursement
  intégral + raison forcée serveur (« Annulée par l'hébergeur/…l'administrateur »)
  ; mail plateforme `bookingCancelledByOperator` (fr/en) ; quote annulation
  GET autorisé hôte du bien + admin (champs additifs `actor`/`fullRefund`) ;
  UI hôte dédiée sans raison client ; voyageur = grille historique inchangée.
  ▶️ probes 200/fee 0.00/refund=total · 🧪 `booking-cancellation-actor.test.ts`
  + `cancellation/route.test.ts`.
- **🟠 T-157 (P2)** — Identité connectée : `bookingGuestIdentity()` (fonction
  pure) — le serveur ignore les champs invité du payload pour un compte
  connecté (email normalisé, défauts phone null/country FR) ; guest mode
  inchangé. UI étape 2 lecture seule + encart « Réservé au nom de votre
  compte ». 🧪 `booking-identity.test.ts` (3 cas) ; mocks auth complets
  dans `bookings/route.test.ts` (le mock partiel provoquait un 500).
- **🟠 T-158 (P2)** — i18n vague 1 fiche propriété : boutons (Réserver,
  favori, partage, alerte prix, avis utile), formulaire d'avis complet,
  bannière confiance, breadcrumb, badge, tooltips, **métadonnées** (title/
  description via cookie `mybb:ui-language` + `getServerLocale`) ; sélecteur
  de devise publique EUR/USD/GBP/XAF (priorité compte > localStorage >
  plateforme, `displayCurrency` serveur inchangé). 🧪 `ui-currency.test.ts` ;
  0 libellé FR résiduel détecté sur la fiche.
- **🟢 T-159 (P3)** — Hygiène/robustesse : `scripts/purge-sim-data.mjs`
  (dry-run, 0 artefact restant) ; PATCH settings merge additif + erreurs
  Zod sans `issues` ; `dates/capacity/min_stay/bad_price` → **400**,
  `unavailable` → **409** ; tests corrigés (property BR/non-BR explicite,
  mocks auth).

## Validation (résumé)

- 🔨 tsc 0 · 🧪 vitest 390/390 (57 fichiers) · ▶️ sims 396/0 · ▶️ probes 30/30 ·
  ✅ ai:check.

Rapports liés : `.ai/REPORTS/audit_fonctionnel_profond28_2026-08-30.md`
(findings sources) ; `.ai/REPORTS/audit_fonctionnel_profond29_2026-08-30.md`
(ce cycle).
