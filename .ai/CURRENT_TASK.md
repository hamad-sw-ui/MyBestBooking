# 🎯 TÂCHE EN COURS

**ID** : T-149

**Titre** : Paiement Stripe en mode réel opérationnel de bout en bout + e-mail
plateforme stylé pour chaque événement du cycle de vie, localisé dans la langue
du destinataire.

**Statut** : CORRIGÉ (VALIDÉ)

Rapport : `REPORTS/t-149_paiement_stripe_emails_2026-08-30.md`.

## Résumé
- 🔨 Tunnel Stripe audité : déjà complet (abstraction mock/stripe sans SDK,
  webhook HMAC vérifié, inbox idempotente, remboursements, clés chiffrées
  AES-256-GCM via l'admin avec fallback env, test de connexion réel) → câblage
  vérifié + doc de mise en route.
- 🔨 E-mails : logo → MyBestBooking ; 3 templates manquants créés et câblés
  (bienvenue après vérification, rappels J-3/J-1, demande d'avis post-séjour
  via cron) ; alerte prix passée au gabarit de marque.
- 🔨 Localisation fr/en de l'habillage des e-mails selon la langue du
  destinataire (nouveau `src/lib/mail/strings.ts`).

## Validation
🧪 tsc 0 · lint 0 erreur · vitest 299/299 (+11) · smoke 94/94 · build 60 pages ·
ai:check OK. Données de test nettoyées (8 users, seed intact, outbox vide).

## Reste en production
Saisir les clés Stripe/Resend dans `/dashboard/settings` → Providers (exige
`CREDENTIALS_ENCRYPTION_KEY`) + webhook Stripe → `/api/webhooks/stripe`.
