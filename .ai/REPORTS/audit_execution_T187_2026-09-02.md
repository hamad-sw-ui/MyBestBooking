# Audit d'exécution — T-187 (e-mails transactionnels en conditions réelles)

- **Date** : 2026-09-02
- **Périmètre** : tous les types de mails transactionnels, exécutés en
  production locale via l'API réelle, trace vérifiée en `email_outbox`.

## Scénarios exécutés (tous SANS défaut)

| Type | Scénario | Trace outbox |
|---|---|---|
| Vérification e-mail | `POST /api/auth/register` | « Vérifiez votre email — MyBestBooking » → nouveau compte ✅ `sent` |
| Reset mot de passe | `POST /api/auth/forgot-password` | « Réinitialiser votre mot de passe » → compte ✅ `sent` |
| Réservation | `POST /api/bookings` (schéma complet) | « Réservation confirmée MBB-… » client **+** « Nouvelle réservation MBB-… » hôte ✅ |
| Annulation | `PUT /api/bookings/{id}` `status=cancelled` | « Réservation annulée » client **+** « Annulation de votre réservation » hôte ; statut DB = `cancelled` ✅ |
| Message | ouverture conversation + `POST /api/messages` | « Nouveau message de Marie Martin » → hôte (nom réel de l'expéditrice) ✅ `sent` |

Outbox : état final **16 mails, tous `sent`, attempts=1** — pipeline
idempotent (T-105) sain ; aucun échec ni retry observé.

## Après-purge (remarque « artefacts d'audit »)

- Compte `audit-<rand>@test.dev` (créé pour le test register) : sessions,
  tokens de vérification, compte → **supprimés** (FK `sessions` +
  `verification_tokens` identifiées au passage).
- Réservation d'audit + conversation + message + mails associés :
  **supprimés** (4 mails orphelins inclus).
- Token reset « pending » du compte customer (non consommé par le test
  forgot) : **supprimé** — aucune arme d'audit laissée.
- État final : 14 mails = traces légitimes des runs smoke ; base
  conforme au seed (remarque (b) **entièrement résolue** — RENTREE2026
  et comptes `@test.dev` historiques avaient déjà disparu au reseed).

## Visuels dédiés (remarque (a))

3 alias remplacés par des JPG dédiés (générés) : `dest-tunis`, `hero-home`,
`placeholder-property` — optimizer : hero 227 Ko → 129 Ko (200).

## Incident transitoire (documenté)

Un run vitest a marqué **2 échecs** pendant que l'audit SQL purgeait la
même base : interférence attendue (tests DB à état). Rejoué à froid :
**479/479 ×2 consécutifs**. Leçon : ne jamais auditer en base pendant un
run de tests (règle déjà implicite, ici prouvée).
