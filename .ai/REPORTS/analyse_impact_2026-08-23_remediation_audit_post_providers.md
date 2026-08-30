# Analyse d’impact — T-104 : remédiation audit post-providers

- **Date** : 2026-08-23
- **Niveau** : **C**
- **Justification** : post-actions financières Stripe, stockage privé de fichiers, schéma booking/messages/rate plans, endpoint provider test et règles de recherche.

## Périmètre

Corriger les défauts P1/P2 du rapport `audit_execution_post_providers_2026-08-23.md` sans modifier les contrats utilisateur déjà validés.

## §14 — 9 questions

### 1. Appelants directs

| Sujet | Fichiers directs |
|---|---|
| confirmation/refund Stripe | `api/bookings/route.ts`, `api/bookings/[id]/route.ts`, `api/webhooks/stripe/route.ts`, `lib/payment/*`, mail templates |
| attachments | `api/uploads`, `api/messages`, `storage/*`, `MessageComposer`, `MessageAttachment`, pages conversation |
| rate plan | `schema`, `api/rooms/[id]/rate-plans`, fiche property, checkout, booking, dashboard rooms |
| provider test | `api/admin/providers`, `SettingsPanel`, factories Stripe/Resend/S3 |
| recherche | `app/(main)/recherche`, `api/properties` |
| avis utile | `api/reviews/[id]/helpful`, fiche property |
| promesses/alertes | home, BestRewards, PriceAlert UI/cron, dashboard billing |

### 2. Dépendances indirectes

- migration Drizzle, `provider_credentials`, `messages`, `bookings`, `rate_plans` ;
- `getMailer`, `getPaymentProvider`, `getUploader` et leurs caches ;
- webhook Stripe signé, audit admin, rate limits, CSP ;
- confirmation voyageur/hôte, annulation et reporting.

### 3. Écrans affectés

Fiche property, checkout, réservations, conversation voyageur/hôte, dashboard rooms/settings/billing, recherche, home et BestRewards.

### 4. Services/tâches

Le cron est concerné pour la réconciliation de remboursements si le PSP webhook manque. Aucun secret ou fichier privé ne doit être exposé par le scheduler.

### 5. Contrats publics / compatibilité

- les nouveaux champs booking/message/rate-plan seront additifs ;
- les anciennes `attachmentUrl` restent lisibles mais ne créent aucune nouvelle URL publique ;
- la route upload conserve `{url,key,size,mimeType}` pendant migration ;
- les nouvelles routes attachment/download, provider test et export sont additives ;
- une réservation sans rate plan garde le prix historique de room.

### 6. Tests existants

Commandes précédemment exécutées : `npm test`, smoke 91/91, builds. Les tests couvrent crypto provider, booking rules, paiement mock, storage local, mais pas encore le cycle webhook-email/refund, téléchargement privé, rate-plan snapshot ou suppression S3 `uploads/...`.

### 7. Tests nouveaux

1. webhook confirmation/email sent once ; refund event pending/succeeded/failed ;
2. S3 remove accepte la clé générée et rejette traversal ;
3. attachment autorisé au participant, refusé à tiers ;
4. rate-plan compatible produit un snapshot immuable et ne casse pas basePrice ;
5. search min/max sur une même room ;
6. helpful review UI/API ;
7. provider test n’expose pas secret et exige admin.

### 8. Risques

| Risque | Parade |
|---|---|
| double email Stripe webhook | marqueur persistant `confirmationEmailSentAt` dans transaction |
| double refund / mauvais refund | `refundProviderId`, événements typés et transitions idempotentes |
| perte d’anciennes attachments | fallback legacy lecture, migration seulement pour nouvelles pièces jointes |
| changement de prix rate-plan | snapshot au booking, jamais recalcul de réservations existantes |
| provider test coûteux | Stripe intent annulé, Resend uniquement admin, S3 objet test supprimé, aucune valeur loggée |
| fuite URL privée | handler participant + storage local hors public / presigned S3 à concevoir |

### 9. Revérification

Migrations fraîches, auth RBAC, booking mock, webhook, messages, upload, S3 mock, rate plans, recherche, build, tests, smoke et ai:check.
