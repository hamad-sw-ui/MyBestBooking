# 🧠 ÉTAT DU PROJET (STATE)

## 📌 Identification

- **Projet** : MyBestBooking
- **Branche actuelle** : `arena/01a042cf-mybestbooking`
- **HEAD de base** : `46b2ca8`
- **PR ouverte** : #2 sur `arena/01a042cf-mybestbooking` (commit de code/garde-fous/tests validé).
- **HEAD Git** : à mettre à jour en fin de session après le dernier commit de doc.
- **Version Framework** : AI-DOS 3.0.1
- **Dernière tâche validée** : T-112 — conversations idempotentes sous
  concurrence (clé métier unique + tests), et réalignement du framework.

## Preuves de la session 2026-08-27

- 🔨 `typecheck` 0 erreur · `lint` 0 erreur (16 warnings préexistants) ·
  `build` 57/57 pages · migration `0015` appliquée (index
  `conversations_conversation_key_unique`).
- 🧪 `npm test` : **216/216** (3 nouveaux tests T-112
  idempotence/concurrence ; auto-skip si DB absente).
- ▶️ `npm run smoke` : **91/91** · `npm run ai:check` : **20 OK · 0 warn · 0 fail**.
- Environnement : Postgres embarqué :55432, `db:push`, seed via smoke.

## 🛠️ État technique

- Checkout invité : profil créé seulement après les règles de disponibilité/prix;
  lien `guest_claim` hashé, expirant et à usage unique pour password/session.
- Paiement : hold/intention repris par propriétaire via endpoint dédié, même clé
  idempotente, sans créer une nouvelle réservation. Les providers restent hors
  transaction DB.
- Notifications : claim, vérification et reset passent par outbox avec tentative
  immédiate; messages sont livrés immédiatement puis retryables par cron.
- Webhooks : Stripe accepte les signatures v1 de rotation et traite uniquement
  l’allowlist payment/refund. Alertes changées réinitialisent leur déduplication.
- Messages : lien dashboard réel, rate-limit auteur, MIME attachment dérivé de
  l’objet uploadé serveur.

## ✅ Preuves T-109

- 🔨 migration fraîche `0000…0014`, typecheck/build et lint 0 erreur.
- 🧪 `npm test`: **223/223** réussis.
- ▶️ guest invalide sans user, guest claim mail/session/bookings, reset alerte,
  outbox verification, Mock retrieve et Stripe signature tests.
- ▶️ `npm run smoke`: **91/91**.

## Limites résiduelles explicites

- T-110 : settings décoratifs, multi-devise/timezone, quote checkout UI,
  BestRewards/referral/promos, dates bornées et E2E/upgrade dépendances.
- Aucun compte Stripe, Resend ou S3/R2 de test : aucune intégration fournisseur
  réelle n’est déclarée validée.
- Chromium Playwright indisponible; preuves HTTP/DB/build ne sont pas E2E navigateur.

## Documents de référence

- `REPORTS/analyse_impact_2026-08-23_T109_claim_resume_operational.md`
- `REPORTS/analyse_conception_2026-08-23_T109_claim_resume_operational.md`
- `REPORTS/debat_technique_2026-08-23_T109_claim_resume_operational.md`
- `REPORTS/analyse_impact_post_2026-08-23_T109_claim_resume_operational.md`
- `REPORTS/validation_T-109_2026-08-23.md`
- `REPORTS/audit_execution_deep_post_T109_2026-08-23.md`
- `ADR/ADR-014_Claim_invite_reprise_paiement_et_webhooks.md`

---
*Mis à jour le 2026-08-23, T-109 validée; audit post-T-109 sur `400e37b`.*
