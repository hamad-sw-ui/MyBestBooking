# 📓 Journal de développement

Notes libres, une entrée par intervention. Antéchronologique (la plus récente
en haut). Aucun format imposé — quelques lignes suffisent : ce qu'on a fait,
ce qu'on a appris, ce qu'on laisse pour la prochaine fois.

---
## 2026-09-07 — T-204 mise en œuvre des remarques (garde P3 + preuves e-mails)

**Fait.** Après l'audit T-203, l'utilisateur a demandé d'implémenter les remarques
restantes du framework `.ai/` sans régression. Deux points ouverts :

1. **P3 — machinerie Stripe orpheline** (`StripePaymentForm`, `pendingStripePayment`).
   Elle était jugée inatteignable par le flux manuel, mais **aucun garde** ne
   l'interdisait formellement. → J'ai extrait la décision dans
   `shouldShowStripeForm` (`src/lib/booking-flow.ts`) : une réponse
   `manualConfirmation:true` ne peut jamais afficher l'UI carte, même si le serveur
   renvoyait un `payment`. Appliqué à `handleSubmit` ET `resumePaymentFor`. Testé
   5/5. La machinerie reste mais est désormais **inatteignable et prouvée** (reprise
   d'un booking manuel sur `/api/bookings/[id]/payment` → 409).
2. **E-mails non re-testés au runtime** (annulation + price-alert). → Re-testés :
   annulation = **2 mails réels** (voyageur fr + hôte en, eventKeys distincts) ;
   price-alert = **1 mail fr réel** (nouveau test d'intégration `price-alert-mail.test.ts`),
   idempotent (2 enqueues → 1 ligne outbox).

**Appris.** Les 17 tests vitex « skippés » dans `npm run ci` (`admin/bulk`,
`admin/hosts`) sont des tests **serveur-live** : ils ignorent le serveur Next s'il
n'est pas actif. En les relançant avec le serveur actif, ils passent 17/17 → le
total réel est **554 tests**, identique à avant la session : **aucune régression de
couverture**.

**Laissé.** La machinerie Stripe n'est pas supprimée (hors périmètre) mais
documentée dans `KNOWN_LIMITATIONS.md` comme inoffensive et gardée.

---
## 2026-09-07 — T-203 audit e-mails (P7 : confirmation manuelle)

**Fait.** L'utilisateur m'a demandé de tester l'intégralité du site et de dire
si les e-mails sont complets et fonctionnels. Le test d'intégralité était déjà
vert (`npm run ci`), mais l'audit runtime des e-mails a révélé un **vrai trou** :

> La confirmation de réservation ne partait que depuis le flux de paiement en
> ligne (`payment-intents.ts` — webhook Stripe / Paiement). Quand l'hôte
> **confirme à la main** une réservation à payer sur place (scénario T-202/T-203),
> **aucun e-mail** n'était envoyé (outbox vide, `confirmation_email_sent_at` NULL).

**Cause.** `sendBookingConfirmationIfNeeded` exigeait `status:"confirmed"` **ET**
`paymentStatus:"paid"`. Or en paiement sur place, la confirmation hôte survient
avec `paymentStatus` encore `pending`. Et personne ne l'appelait depuis le PUT.

**Correctif.**
- `PUT /api/bookings/[id] {status:"confirmed"}` → appelle
  `sendBookingConfirmationIfNeeded(id)` (best-effort, post-commit).
- La fonction ne conditionne plus l'envoi à `paymentStatus:"paid"` : garde sur
  `status:"confirmed"` + `confirmationEmailSentAt` (idempotence) + toggle
  admin `notifications.bookingConfirmation` (désormais respecté).

**Appris.** Le plus dur n'était pas le code mais de **prouver** le manque :
le smoke ne teste pas la confirmation (POST → `pending`), donc un gap pouvait
traverser toute la CI. Seul le runtime (serveur + outbox) a montré le trou.
P3 en bonus : l'écran de confirmation disait « C'est confirmé ! / Total payé »
pour une résa manuelle encore `pending` — corrigé avec 3 clés i18n.

**Laissé pour plus tard.** R7 warn (STATE HEAD) tant que le commit de doc n'est
pas fait ; les toggles `bookingReminder*`/`reviewRequest`/`bookingConfirmation`
sont des clés schema mais pas toutes exposées en UI d'admin.


## 2026-09-07 — T-203 correction du scénario « paiement manuel »

**Fait.** La revue bout-en-bout du flux manual_confirm de T-202 a révélé 4
divergences qui cassaient le scénario ; toutes corrigées sans toucher au tunnel
Stripe/PSP ni au webhook.

- **1. Versements/revenus inertes** : une réservation manuelle restait
  `paymentStatus:"pending"` pour toujours et `paymentMethodOffline` n'était jamais
  `true` → le pipeline `payout` (filtre `paid`) ne produisait rien. Ajouté
  `PUT /api/bookings/[id] {markPaidOffline:true}` (hôte/admin) → `paid` + `offline`
  + audit `booking.pay.offline`. Résolution : **ne pas modifier** le filtre `paid`
  de `payout-service`/`dashboard` — rendre l'état `paid` atteignable.
- **2. Expiration abusive** : le cron annulait la demande manuelle après 15 min.
  → `paymentExpiresAt:null` sans `payOnline` ; cron limité aux `paymentIntentId`.
- **3/4. UI** : bouton/badge « Payé sur place » + masque « Payer maintenant ».
- **Leçon** : quand on désactive une automatisation (paiement auto), il faut
  fournir le **contre-équivalent manuel** complet (le "constater payé"), sinon le
  pipeline aval (payout/revenus) se retrouve en état mort. Et un cron d'expiration
  pensé pour un hold de paiement doit être re-borné quand le paiement devient optionnel.

## 2026-09-07 — T-202 validation hôte + paiement manuel

**Fait.** Ajout de la validation hôte à l'inscription (admin approuve + fixe un %
de commission) et bascule vers un paiement manuel (plus de paiement auto, statuts
gérés à la main par l'hôte).

- **Socle DB** : colonnes additives `users.approvalStatus`/`commissionRate`,
  `bookings.paymentMethodOffline`/`confirmedBy` (migration 0019, non destructrice).
- **Approbation** : helper `host-approval.ts` (gate), routes `/api/admin/hosts[/id]`,
  UI une `HostApproveActions`. Gate de publication : un hôte non approuvé ne peut
  pas passer `active` (`/validate` → 409).
- **Commission** : `commission.ts` avec priorité propriété > hôte > global ; les
  propriétés existantes gardent leur taux (zéro régression).
- **Paiement manuel** : `POST /api/bookings` → `payment:null`, `manualConfirmation:true`,
  `status:"pending"`. Le webhook ne force plus `confirmed`.
- **Statuts** : `booking-lifecycle` `host_all` (l'hôte confirme `pending→confirmed`),
  route `bookings/[id]` enregistre `confirmedBy`.

**Leçon.** La bascule "paiement auto → manuel" est délicate pour le parcours client.
En gardant la route `/api/bookings/[id]/payment` (back-office) et en ne désactivant que le
déclenchement automatique, on ne casse rien : la réservation se crée toujours (201),
juste `pending`. Le champ `payOnline` (optionnel) permet de réactiver le paiement en ligne.

**Gates.** tsc 0 · lint 0 · i18n 0 (catalogue **1477**) · vitest **546/546** ·
build 64 · smoke 95/95 · ai:check 19 OK · 0 fail.

---

## 2026-09-07 — Versements : correctifs P6–P9 (UX/sémantique)

Suite au rapport `analyse_gaps_restants_P6P9_2026-09-07.md`, j'ai bouclé les
écarts **UX/sémantique** laissés par P1–P4 (qui étaient des régressions internes
déjà corrigées) :

- **P6** — le bouton `PayoutRequestButton` prend désormais `currency`
  (optionnelle) et le `POST /api/host/payouts` filtre par devise (`currency` dans
  le body Zod) → un clic sur la ligne EUR ne déclenche plus le XAF. Un `currency`
  sans payout correspondant → 404 (testé runtime).
- **P7** — garde-fou devise **visible** : le bouton consomme `skipped[]`
  (`payouts.skippedCurrency`) et `hasAccount===false` (`payouts.accountMissing`)
  au lieu d'un simple `reload()` silencieux.
- **P8** — la carte « Factures » (versements) pointe ses exports vers
  `/api/dashboard/billing/export-payouts`, **plus** vers `/export` (bookings,
  réservé à la carte Réservations).
- **P9** — nouvelle route `GET /api/dashboard/billing/export-payouts` : CSV du
  ledger `payouts` (période, devise, brut, commission, net, réservations,
  statut, versé le, idempotence), host/admin, 500 max, en-têtes `billingCsv.*`.

**Leçon** : sur une fonctionnalité déjà validée, les écarts peuvent être purement
« le serveur sait mais l'UI ne le montre pas ». La clé est de rebrancher l'état
(`skipped`, `hasAccount`, `currency`) du contrat existant dans l'UI — les ajouts
restent **additifs** (aucun paramètre requis), zéro régression.

Gates : tsc 0 · lint 0 · i18n 0 (catalogue **1462**) · vitest **536/536** ·
build 63 · ai:check 19 OK · 0 fail.

---

## 2026-08-20 — Réécriture complète de `.ai/`

**Contexte.** Le dossier `.ai/` initial décrivait un tout autre projet
(« MobileCaisse », app Android Kotlin de caisse enregistreuse) et imposait un
cadre de gouvernance lourd (Docker obligatoire, §13/§14/§15/§16/§17/§22,
rôles multiples, `blocking_rules`, double-validation, `CURRENT_TASK.md` unique
et bloquante…).

**Ce qu'on a fait.** Suppression intégrale de l'ancien contenu et création
d'un nouveau `.ai/` :

- Aligné sur **MyBestBooking** (Next.js + PostgreSQL + Drizzle).
- **Sans gate** : aucun document ne bloque un commit, une PR ou un
  déploiement. Les checklists sont fournies à titre d'aide-mémoire.
- Structure allégée : `README`, `PROJECT`, `ARCHITECTURE`, `DATABASE`, `API`,
  `UI`, `SECURITY`, `CODING_STYLE`, `DEV_ENVIRONMENT`, `DEPENDENCIES`,
  `BUGS`, `BACKLOG`, `ROADMAP`, `DEVLOG` + dossiers `PROMPTS/`,
  `CHECKLISTS/`, `ADR/`, `REPORTS/`, `LOGS/`.

**Pour la suite.** Voir `BACKLOG.md` — les items 🔴 sont les prérequis
sécurité/exploitation avant tout déploiement réel.
