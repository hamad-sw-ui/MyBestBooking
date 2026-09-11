# Validation — audit n°8 (F1 → F5, T-271 → T-275)

- **Date** : 2026-09-11 · **Branche** : `arena/01a0913d-mybestbooking`
- **Périmètre** : les **5 constats** de l'audit runtime n°8 (parcours d'exécution,
  base seed + fixtures rejouées) — F1 (majeur) 500 latent `/mes-reservations`,
  F2 no-show muet, F3 remboursement hors plateforme non finalisable,
  F4 alertes prix d'un compte supprimé, F5 claim invité sans renvoi.
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_n8_parcours_execution.md`
  (copie `.ai/REPORTS/`)
- **Analyses pré-code (avant toute ligne de code, §14/§15.1/§15.2)** :
  `analyse_impact_T271_T275_2026-09-11_audit8.md` (9 questions, faits cités) ·
  `analyse_conception_T271_T275_2026-09-11_audit8.md` (3+ options par tâche,
  retenue argumentée) · `debat_technique_T273_T275_2026-09-11_audit8.md`
  (10 rôles, objections vérifiées dans le code — niveau C obligatoire).

## 1. Livré

| Tâche | Constat | Livrable | Non-régression argumentée |
|---|---|---|---|
| **T-271** (S) | F1 — `formatTimestamp` mélangeait styles Intl (`dateStyle`/`timeStyle`) et composants explicites → `RangeError` (ECMA-402) pour **tout** client possédant une demande `pending` (champ `requestExpiresAt` posé à 100 % des créations) | `src/lib/dates.ts` : quand `dateStyle`/`timeStyle` sont présents, options = styles + `timeZone` **seuls** ; sinon chemin historique inchangé | Les 34 autres rendus de l'app passent par le chemin composants (inchangé) ; rendu FR `Intl` verrouillé par test (`« 5 avr. 2027 »`, virgule US) ; aucun appelant modifié |
| **T-272** (S) | F2 — la transition hôte `→ no_show` ne produisait **aucun** e-mail au voyageur (preuve outbox vide) | Gabarit `noShow` FR/EN (`mail/strings.ts` + `templates.ts`) + `src/lib/no-show-notification.ts` (`sendNoShowNotificationIfNeeded`, idempotent `no-show:<id>`, best-effort post-commit) + interrupteur `notifications.bookingNoShow` (défaut `true` via `mergeDefaults`) + hook dans `PUT /api/bookings/[id]` | L'envoi est **après** commit et tolère l'échec (jamais de 5xx) ; l'interrupteur nouveau est additif (défaut = ancien comportement augmenté d'un e-mail d'information) ; aucune autre transition touchée |
| **T-273** (C) | F3 — `refundStatus` ne devenait `refunded` que par le webhook Stripe ; **aucune** action hôte/admin ; un remboursement déjà effectué hors plateforme restait « à traiter » indéfiniment | `POST /api/bookings/[id]/refund` : hôte du bien/admin (403 voyageur/tiers) ; `{reason}` 3–500 strict (400 sinon, y compris champ inconnu) ; gardes `paid` + `refundStatus='none'` + `paymentIntentId IS NULL` + non-`pending` (409) ; `FOR UPDATE` ; idempotent 409 au 2e appel ; écrit `refunded`/`refundedAt`/`refundAmount=total` + audit `booking.refund.manual` `{host, reason, refundAmount, currency}` + e-mail `refund-finalized:<id>` best-effort ; UI : action « Finaliser le remboursement » (`ReasonDialog` générique réutilisé hors admin) dans `BookingRowActions` + `booking-settlement-cell`, plomberie `refundStatus` (`bookings-manager`, liste, détail) | **Zéro contact PSP** : la garde `paymentIntentId IS NULL` rend la voie Stripe exclusivement Stripe (webhook intact) ; les lignes non concernées (PSP, non payées, pending, déjà remboursées) répondent 409 avec motif ; le `ReasonDialog` existant est réutilisé sans modification ; aucun libellé existant modifié |
| **T-274** (S) | F4 — `anonymizeUserAccount` ne touchait ni `price_alerts` ni `users.priceAlertEnabled`, et le scan cron ne filtrait pas `users.deletedAt` → e-mails « sent » vers `deleted-…@anonymized.local` (prouvé : alerte `c9509c78`, cron `notified:1`) | (a) `src/lib/account-anonymization.ts` : `price_alerts.active=false` + `users.price_alert_enabled=false` **dans la même transaction** (dernier tarif de notification conservé — historique non réécrit) ; (b) `src/app/api/cron/price-alerts/route.ts` : requête extraite en `selectActivePriceAlerts()` (exportée) + **garde `isNull(users.deletedAt)`** (protège aussi les comptes supprimés avant le correctif) | Le compte sain garde son alerte et son flag (test de non-régression) ; le GET cron appelle la même fonction (comportement identique) ; pas de colonne ajoutée ni modifiée |
| **T-275** (C) | F5 — le claim invité est un e-mail **unique** (eventKey idempotent `guest-claim:<id>`) + jeton 24 h ; le compte est créé `passwordHash=null` (pas de connexion) ; `resend-verification` ne couvre que `email_verification` pour un utilisateur **connecté** → impasse sans support si le 1er e-mail est perdu ou la fenêtre dépassée | `POST /api/auth/resend-guest-claim` : zod strict `{bookingReference (5–50), guestEmail}` ; **double identification** (référence **et** e-mail exact du booking — 1 requête jointe `bookings ⋈ users` sur référence indexée) ; 4 gardes d'émission (`pending`, `passwordHash IS NULL`, `deletedAt IS NULL`) ; **réponse strictement générique 200** dans tous les cas (anti-énumération) ; rate-limit **IP 10/h puis email 3/h avant toute lecture** (429 + `Retry-After`) ; jeton `guest_claim` 24 h **neuf, non annulé** (le lien précédent reste valable — `consumeToken` atomique, le premier consommé l'emporte) ; gabarit `guestAccountClaim` réutilisé ; eventKey `guest-claim-resend:<bookingId>:<ts>` (l'initiale n'est jamais rejouée) ; échec d'envoi = best-effort, jamais de 5xx ; UI : bouton « Renvoyer l'e-mail d'activation » sur l'écran de confirmation du tunnel, visible uniquement en `guestAccessPending` | Le tunnel de création est inchangé (le claim initial part exactement comme avant) ; le jeton initial n'est jamais invalidé (pas de race « le lien dans la boîte mail ne marche plus ») ; `resend-verification` (auth) intact ; le strict zod rejette tout champ parasite ; aucun jeton dans la réponse |

## 2. i18n

- **T-273** : `book.finalizeRefund` FR/EN (+1).
- **T-275** : `reservation.resendClaim`, `reservation.resendClaimSent`,
  `reservation.resendClaimError` FR/EN (+3) + 2 messages API FR→EN dans
  `src/lib/api-error.ts` (message générique du renvoi + « Référence de
  réservation invalide »).
- Verrou `ui-strings` : **1770 → 1774**, parité FR/EN exacte (0 clé manquante
  des deux côtés), passé dans la chaîne CI.

## 3. Preuves automatisées (base réelle, routes réelles)

- `src/lib/dates.t271.test.ts` — **35/35** : styles exclusifs des composants,
  `timeZone` appliqué, rendus FR `Intl` verrouillés, chemin historique
  (composants) inchangé, fusion d'options préexistante corrigée.
- `src/lib/no-show-notification.t272.test.ts` — **5/5** : envoi idempotent
  (`no-show:<id>`), interrupteur coupé → **aucune** ligne d'outbox, échec
  d'envoi toléré (post-commit), localisation FR/EN.
- `src/app/api/bookings/[id]/refund/route.t273.test.ts` — **10/10** : happy hôte
  (200 + audit + mail), idempotence 409, pending 409, non payé 409, PSP 409,
  voyageur 403, hôte tiers 403, admin 200, reason courte 400, champ inconnu 400.
- `src/lib/account-anonymization.t274.test.ts` — **2/2** : flag + alerte coupés
  dans la tx (dernier tarif conservé) ; compte sain inchangé (non-régression).
- `src/app/api/cron/price-alerts/route.t274.test.ts` — **3/3** : compte supprimé
  HORS scan malgré active + flag on ; compte vivant DANS le scan ; opt-out HORS.
- `src/app/api/auth/resend-guest-claim/route.t275.test.ts` — **8/8** : happy
  guest (200 générique + outbox `guest-claim-resend:<id>:%` + jeton valide non
  consommé + compte toujours à activer), compte déjà claimé → générique sans
  e-mail, booking non pending → idem, e-mail non concordant → idem, référence
  inconnue → **message strictement identique** (anti-énumération), zod
  (manquant / strict / email invalide) → 400 ×3, rate-limit email 3/h → 429 +
  `Retry-After`, rate-limit IP 10/h (11e → 429) bornes indépendantes.

**Non-régression globale** : vitest intégral **161 fichiers / 858 tests, 0 échec**
(28 skips DB-gated) — toutes les suites préexistantes (bookings, messages,
wallet, promos, 2FA, claim, cron, reviews, auth, i18n) vertes sans modification.

## 4. Chaîne de gates (`npm run ci`)

| Gate | Résultat |
|---|---|
| Typecheck (`tsc --noEmit`) | 0 erreur |
| Lint (`eslint src --max-warnings 0`) | 0 erreur / 0 warning |
| Garde-fou i18n | warn-only, 6 candidats **préexistants** (0 nouveau) |
| Garde-fou framework (`ai:check` v3.0.1) | **19 OK / 1 warn (R7 toléré : SHA du propre commit) / 0 fail** |
| Vitest | **161 f / 858 t passés, 0 échec** |
| Build production | OK (toutes pages) |
| Smoke HTTP | **95/95** |

## 5. Runtime réel (serveur dev :3000, base seed, fixtures purgées en sortie)

- **T-271** : `customer@mybestbooking.com` (seed) possède une demande `pending`
  avec `requestExpiresAt` → `GET /mes-reservations` **200** (avant : 500
  `RangeError` au rendu de l'échéance).
- **T-272** : fixture `MBB-T272-XBPXL7` (confirmed, séjour passé) → hôte
  `PUT {status:"no_show"}` → 200 + outbox `no-show:<id>` **sent** au voyageur
  (« Votre séjour MBB-T272-XBPXL7 a été marqué non-présentation »).
- **T-273** : fixture `MBB-T273-XBPXL7` (confirmed, `paid` hors plateforme) →
  hôte `POST /refund` → 200 : `refundStatus="refunded"`, `refundedAt` posée,
  `refundAmount="200.00"`, audit `booking.refund.manual`
  `{host:true, reason, currency:"EUR", refundAmount:"200.00"}`, e-mail
  `refund-finalized:<id>` **sent** ; 2e appel → **409** « Le remboursement a
  déjà été finalisé ».
- **T-274** : compte supprimé (fixture `t274-del-*`, `deleted_at` posée) avec
  alerte `active=true` + flag on + contrôle customer seed (alerte `max_price`
  réajustée) → `GET /api/cron/price-alerts` → `ok:true, scanned:1, notified:1` :
  l'alerte du compte supprimé est **exclue du scan** (0 e-mail, `last_notified_*`
  intactes) ; l'alerte de la contrôlée est notifiée (e-mail `price-alert:<id>:base:89.00`
  **sent**). Trace `cron_runs` `price-alerts` `ok` `scanned:1 notified:1`.
- **T-275** : demande guest réelle `MBB-2026-Q7IYI8` (tunnel public
  `POST /api/bookings` `isGuestBooking`, `guestAccessPending:true`, compte
  `passwordHash=null`) → 1er e-mail `guest-claim:<id>` **sent** ; 3 renvois
  `POST /api/auth/resend-guest-claim` → 200 générique ×3 + 3 e-mails
  `guest-claim-resend:<id>:<ts>` **sent** + 4 jetons `guest_claim` valides
  non consommés + lien `activer-compte?token=…` et référence dans le mail ;
  4e essai → **429** « Trop de demandes, réessayez plus tard » + `Retry-After`.

## 6. Hygiène de la base

- Fixtures T-272/T-273/T-274/T-275 (bookings, users, alerts, tokens, outbox,
  audit, sessions, cron_runs) **purgées** + résidus des passes vitest/smoke du
  jour (outbox 40, audit 22, sessions 7, tokens 6, cron 3, 4 users `@test.local`,
  1 booking smoke) nettoyés.
- État final vérifié = **seed exact** : 8 users · 0 outbox · 0 audit · 0 cron_runs
  · 0 sessions · 0 tokens · 0 price_alerts · 33 bookings · 8 properties ·
  23 rooms · 0 wallet_transactions · 0 conversations · 0 messages · 1 wishlist.
