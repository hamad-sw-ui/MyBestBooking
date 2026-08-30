# T-149 — Paiement Stripe en mode réel + e-mails plateforme stylés pour chaque événement

**Date :** 2026-08-30
**Branche :** `arena/01a042cf-mybestbooking`
**Tâche :** rendre le tunnel Stripe réel opérationnel de bout en bout (configurable via
l'admin, clés chiffrées, fallback env, sans casser le mode mock dev/test) **et**
garantir un e-mail stylé (HTML responsive de marque + texte brut) pour **chaque
événement** du cycle de vie, dans la **langue du destinataire**.

---

## 1. Audit du socle existant (lecture + exécution)

### 1.1 Paiement Stripe — déjà complet et de qualité
Le tunnel de paiement était **déjà entièrement codé** et n'a pas eu besoin d'être
reconstruit. Vérifié à la lecture :

- **Abstraction provider** (`src/lib/payment/`) : `types.ts` (interface
  `PaymentProvider`), `index.ts` (`getPaymentProvider()` → coffre chiffré DB puis
  env ; en production exige `secretKey`+`webhookSecret`+`publishableKey`, sinon
  throw ; en dev, bascule sur `MockPaymentProvider` si clés absentes),
  `mock.ts` (dev/test, idempotent), `stripe.ts` (appels HTTPS directs à
  `api.stripe.com/v1/...`, **sans SDK**, `Idempotency-Key`, `receipt_email`,
  `automatic_payment_methods`, vérification **manuelle** de la signature webhook
  HMAC-SHA256 avec tolérance 300 s, `timingSafeEqual`, gestion de plusieurs `v1`
  pour rotation de clé).
- **Inbox idempotente** (`payment-events.ts`) : `recordPaymentEvent` +
  `processPendingPaymentEvents` (un webhook reçu avant le commit du booking est
  conservé puis rejoué), compensation des paiements capturés après annulation
  (`refundLateCapturedPayment`, rétentions `reconcileLateCapturedPaymentRefunds`).
- **Confirmation** (`booking-confirmation.ts`) : écriture des e-mails dans la même
  transaction que le marqueur `confirmationEmailSentAt`, idempotence par
  `eventKey` déterministe.
- **Front** (`stripe-payment-form.tsx`) : Stripe.js + `PaymentElement`, clé
  publiable récupérée côté serveur via `/api/providers/stripe` (jamais de secret
  côté navigateur), `return_url` après confirmation.
- **Chiffrement des clés** (`provider-credentials.ts`) : AES-256-GCM, clé maître
  `CREDENTIALS_ENCRYPTION_KEY` (rotation via `..._PREVIOUS`), tables
  `providerCredentials` / `providerTestLogs`.
- **Administration** (`/dashboard/settings` → onglet Providers, API
  `/api/admin/providers`) : saisie/chiffrement des clés, **test de connexion**
  réel (crée puis annule un PaymentIntent de 0,50 € pour Stripe ; envoie un e-mail
  de test pour Resend ; put+delete d'un objet pour S3), rotation de clé maître,
  journal d'audit. Garde admin vérifiée : client → **403**.

**Conclusion paiement :** le mode réel est opérationnel dès que les clés sont
saisies. Aucune clé Stripe/Resend réelle n'étant disponible en sandbox, la
vérification s'est faite sur le **mode mock + ConsoleMailer** et sur la
**présence/cohérence du câblage** (la preuve réelle nécessite les clés de production,
cf. §5).

### 1.2 E-mails — socle présent, mais 4 événements sans déclencheur
- Outbox transactionnelle (`email-outbox.ts`) : claim à bail, 8 tentatives,
  idempotence par `eventKey` (`onConflictDoNothing`), reprise cron.
- Templates HTML de marque (`mail/templates.ts`) + version texte (`stripHtml`),
  substitution `{var}` avec échappement HTML anti-XSS (`render.ts`).
- Mailer `ConsoleMailer` (dev/test, écrit `.data/mails`) et `ResendMailer`
  (réel, via clé coffre/env).

**Anomalies constatées :**
1. **Logo des e-mails en minuscules** (`mybest`+`booking`) alors que la marque
   corrigée est « MyBestBooking » (CamelCase).
2. **4 événements avaient un interrupteur admin (`notifications.*`) mais
   AUCUN envoi réel** : `welcomeEmail`, `bookingReminderJ3`, `bookingReminderJ1`,
   `reviewRequest` — réglages « morts ».
3. L'e-mail **d'alerte de prix** n'utilisait pas le gabarit de marque stylé
   (HTML brut inline).
4. **Tous les e-mails étaient en français**, quelle que soit la langue du
   destinataire (alors que l'interface web respecte déjà `user.language`).

---

## 2. Correctifs apportés (code)

### 2.1 Marque
- `src/lib/mail/templates.ts` : logo → `MyBest` (bleu) + `Booking` (corail),
  cohérent avec la marque web. Le slogan reste en pied de page, désormais localisé.

### 2.2 Nouveaux templates d'e-mails stylés
- `src/lib/settings.ts` : ajout au schéma zod `emailTemplatesSchema` et aux
  `DEFAULTS` de **3 blocs éditables** (sujet + corps) : `welcomeEmail`,
  `bookingReminder` (J-3/J-1, porte `{daysLabel}`), `reviewRequest`.
- `src/lib/mail/templates.ts` : ajout des fonctions correspondantes (layout de
  marque, tableau récapitulatif pour le rappel, boutons d'action) + d'un gabarit
  `priceAlert` de marque (contenu transactionnel non éditable par l'admin).
- `src/components/admin/settings-panel.tsx` : les 3 nouveaux templates sont
  éditables dans le panneau admin (titre + variables documentées).

### 2.3 Déclencheurs réels des e-mails manquants
- **Bienvenue** — `src/app/api/auth/verify/route.ts` : à la transition
  `emailVerified` false→true, envoie `welcomeEmail` (best-effort, respecte
  `notifications.welcomeEmail`, idempotent `welcome:{userId}`).
- **Rappels J-3 / J-1 et demande d'avis post-séjour** — nouveau module
  `src/lib/booking-lifecycle-emails.ts` :
  - `sendBookingReminders()` cible les réservations confirmées+payées dont
    l'arrivée est J+3 ou J+1 ;
  - `sendReviewRequests()` cible les séjours `completed` (checkOut ≤ aujourd'hui,
    fenêtre 14 j) sans avis (left join `reviews`, `bookingId` unique) ;
  - **idempotence** : `eventKey` déterministe **et** clause `NOT EXISTS` sur
    l'outbox pour ne pas re-cibler/re-tenter chaque jour ;
  - respecte les interrupteurs `notifications.bookingReminderJ3/J1` et
    `notifications.reviewRequest`.
  - Câblé dans la tâche cron `src/app/api/cron/price-alerts/route.ts`
    (compteurs `bookingRemindersSent` / `reviewRequestsSent` dans la réponse).

### 2.4 Localisation des e-mails dans la langue du DESTINATAIRE
- Nouveau `src/lib/mail/strings.ts` : dictionnaire **fr/en** de l'habillage
  (slogan, boutons, en-têtes des tableaux récapitulatifs, mentions légales,
  gabarits entièrement gérés par la plateforme comme l'alerte de prix et
  l'activation de compte invité). `toMailLocale()` borne sur fr/en (comme
  `UiLocale` ; `ar` → repli fr).
- Chaque template accepte un paramètre optionnel `language` ; le `<html lang>`
  et tout l'habillage suivent la langue du destinataire.
- La langue est passée depuis chaque déclencheur, **pour le bon destinataire** :
  confirmation (langue du voyageur pour l'e-mail voyageur, langue de l'hôte pour
  l'e-mail hôte — `booking-confirmation.ts`), annulation
  (`booking-cancellation.ts`), message (`messages/route.ts`), bienvenue/vérif/reset
  (`auth/*`), claim invité (`bookings/route.ts`), rappels/avis/alerte prix (cron,
  langue du voyageur abonné).

> **Périmètre de traduction honnête :** l'**habillage** (boutons, en-têtes,
> slogans, gabarits plateforme) est traduit fr/en selon le destinataire. Les
> **corps de message éditables par l'admin** (`emailTemplates.*.body/.subject`)
> restent dans la langue de rédaction choisie par l'admin (français par défaut) :
> c'est du contenu éditorial, non traduit automatiquement. Les **montants**
> restent dans la devise de facturation de la réservation (EUR) — cf. §4.

---

## 3. Preuves d'exécution (sandbox, mode mock + ConsoleMailer)

- **Rappels J-3/J-1 + demande d'avis** (script `.data/t24/test-lifecycle.mjs`) :
  création de 4 réservations (J+3, J+1, séjour terminé dans la fenêtre, séjour
  trop vieux) → `sendBookingReminders() = 2`, `sendReviewRequests() = 1`,
  la réservation hors fenêtre (30 j) **exclue**. **Re-jeu → 0/0** (idempotence).
- **Fichiers mail générés** (`.data/mails`) : rappel J-3 « Votre arrivée est dans
  3 jours », J-1 « Votre arrivée est demain », demande d'avis ; logo
  `MyBest`+`Booking`, tableau récapitulatif (Référence/Hébergement/Arrivée/Départ).
- **Bienvenue** : inscription réelle (`POST /api/auth/register` → 200), extraction
  du lien de vérification, `GET /api/auth/verify?token=…` → **307
  `/verifier-email?ok=1`** et e-mail « Bienvenue sur MyBestBooking 🎉 » créé.
  Second appel avec le même token (consommé) → **307 `?ok=0`**, **pas de doublon**.
- **Localisation EN** : un utilisateur `language=en` reçoit l'habillage en anglais
  — slogan « Book better. Travel further. », bouton « View my booking », en-têtes
  « Check-in », `priceAlert` sujet « Price alert: … », `guestAccountClaim`
  « Access your booking ». `language=ar` → repli fr (`<html lang="fr">`).
- **Admin** : `GET /api/admin/settings` expose les **9** templates (3 nouveaux
  présents) ; `PATCH /api/admin/settings/emailTemplates` → **200** (zod accepte,
  les autres blocs restent intacts) ; la surcharge de test a été supprimée
  (retour aux DEFAULTS).
- **Sécurité** : `GET /api/admin/providers` en client → **403** ;
  `/api/providers/stripe` (public) sans clé → `{configured:false}` (ne fuite
  aucun secret).
- **Données de test entièrement nettoyées** : 8 utilisateurs actifs, 31
  réservations de seed, outbox vide, `app_settings` vide (DEFAULTS).

---

## 4. Devise & langue : ce qui respecte « celui qui reçoit » (réponse à la question)

### Langue
- **Interface web :** la langue suit `user.language` (défaut plateforme sinon) ;
  fr/en traduits, `ar` pour le contenu des logements seulement.
- **E-mails (T-149) :** l'habillage suit désormais la **langue du destinataire**
  (voyageur ou hôte), pas celle de l'expéditeur/plateforme. Les corps éditables
  admin restent dans la langue de rédaction admin (limite documentée §2.4).

### Devise
- **Affichage web des prix d'aperçu :** suit `user.currency` (préférence
  utilisateur qui prime sur le défaut plateforme XAF), conversion par taux figés
  (`RATES_FROM_EUR`, snapshot — pas de FX temps réel), et les bornes de recherche
  saisies en FCFA sont reconverties vers la devise de stockage (EUR).
- **Montants transactionnels (paiement, total de réservation, remboursement,
  portefeuille, et donc les montants dans les e-mails de confirmation/rappel) :**
  ils restent **dans la devise de facturation de la chambre/passerelle (EUR)** et
  ne sont **jamais convertis**. C'est volontaire : Stripe ne traite pas le FCFA,
  et afficher un montant « converti » comme montant débité serait trompeur. La
  conversion est purement présentielle (aperçu), jamais utilisée pour débiter.

---

## 5. Configuration en mode réel (Stripe + Resend) — procédure

1. **Clé maître de chiffrement** (obligatoire pour stocker les clés en base) :
   `CREDENTIALS_ENCRYPTION_KEY` = 32 octets (`openssl rand -hex 32`). Optionnel :
   `CREDENTIALS_ENCRYPTION_KEY_PREVIOUS` pour la rotation.
2. En tant qu'**admin**, aller sur **`/dashboard/settings` → onglet Providers**
   (ou utiliser les variables d'environnement en fallback) :
   - **Stripe** : `secretKey` (`sk_live_…`), `webhookSecret` (`whsec_…`),
     `publishableKey` (`pk_live_…`). Bouton **Tester la connexion** (crée+annule
     un PaymentIntent de 0,50 €).
   - **Resend** : `apiKey` (`re_…`) + `mailFrom` (ex.
     `MyBestBooking <no-reply@mybestbooking.com>`). Bouton **Tester** envoie un
     e-mail réel à l'admin.
3. **Webhook Stripe** : dans le dashboard Stripe, ajouter un endpoint pointant
   vers `https://<domaine>/api/webhooks/stripe`, événements
   `payment_intent.succeeded|payment_failed|canceled|processing` et
   `charge.refunded` (mappés en `refund.*`), puis copier le secret de signature
   dans `webhookSecret`.
4. Variables d'env possibles en fallback : `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `RESEND_API_KEY`,
   `MAIL_FROM`.
5. **Ordonnancement** : la tâche cron (`/api/cron`, protéger par `CRON_SECRET` en
   production, planif. dans `vercel.json`) envoie rappels J-3/J-1, demandes d'avis,
   alertes prix, et traite l'outbox/les événements de paiement.

En l'absence de clés, l'application reste en **mode mock** (paiement auto-réussi)
et **ConsoleMailer** (e-mails écrits dans `.data/mails`) — aucun comportement
dev/test cassé.

---

## 6. Validation (aucune régression)

| Contrôle | Résultat |
|---|---|
| `npm run typecheck` (tsc) | **0 erreur** |
| `npm run lint` (eslint) | **0 erreur** (warnings préexistants) |
| `npm run test` (vitest) | **299/299** (42 fichiers ; +11 tests nouveaux vs 288) |
| `npm run smoke` | **94/94 assertions** |
| `npm run build` (next build) | **succès**, 60 pages (BUILD:0) |
| `npm run ai:check` | **20 OK · 0 warn · 0 fail** |

Nouveaux tests : `src/lib/mail/index.test.ts` (logo CamelCase, welcomeEmail,
bookingReminder, reviewRequest, priceAlert brandé, anti-XSS, localisation fr/en/ar,
claim invité EN).

---

## 7. Fichiers touchés

- `src/lib/mail/strings.ts` *(nouveau)* — chaînes d'habillage fr/en.
- `src/lib/booking-lifecycle-emails.ts` *(nouveau)* — rappels J-3/J-1 + demande d'avis.
- `src/lib/mail/templates.ts` — logo marque, 3 templates + priceAlert, param. `language`.
- `src/lib/settings.ts` — schéma + DEFAULTS des 3 nouveaux blocs `emailTemplates`.
- `src/components/admin/settings-panel.tsx` — édition admin des nouveaux templates.
- `src/app/api/auth/verify/route.ts` — e-mail de bienvenue après vérification.
- `src/app/api/auth/register|forgot-password|resend-verification/route.ts` — langue.
- `src/lib/booking-confirmation.ts`, `src/lib/booking-cancellation.ts` — langue du bon destinataire.
- `src/app/api/bookings/route.ts`, `src/app/api/messages/route.ts` — langue.
- `src/app/api/cron/price-alerts/route.ts` — câblage rappels/avis + priceAlert brandé/localisé.
- `src/lib/mail/index.test.ts` — +11 tests.
