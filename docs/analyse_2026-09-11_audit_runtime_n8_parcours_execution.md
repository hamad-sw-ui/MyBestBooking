# Analyse runtime n°8 — parcours exécutés client, hôte, admin : constats F1 → F5

> Demande du 2026-09-11 (après clôture complète de l'audit n°7, C1 → C6,
> HEAD `2e3185c`) : *« faites encore une analyse profonde des scénarios et
> éléments fonctionnels du projet à l'exécution (pages, boutons,
> fonctionnalités…) inachevés et/ou mal pensés ; expliquer les problèmes et
> donner leurs solutions sans régression pour ne pas casser tout ce qui
> fonctionne déjà bien »*.
>
> **Cette passe n'a modifié aucune ligne de code applicatif** : constats,
> preuves d'exécution et solutions non régressives uniquement. Audits
> précédents : n°7 `docs/analyse_2026-09-11_audit_runtime_n7_fins_de_parcours.md`
> (C1 → C6, soldé), n°6 `docs/analyse_2026-09-11_audit_runtime_inacheves_mal_penses.md`
> (B1 → B12, soldé), n°5 `docs/analyse_2026-09-11_audit_runtime_execution.md`
> (A1 → A8, soldé).
>
> Contexte : branche `arena/01a0913d-mybestbooking`, HEAD `2e3185c`
> (purge outbox tests), CI de référence verte. App `:3000` (Next dev),
> base = seed + fixtures créés pendant la passe (purgés à la fin, § 6).
> Constats déjà soldés aux audits n°1 → n°7 : A1 → A11, N1 → N3,
> commission (n°1 → n°4), A1 → A8 (n°5), B1 → B12 (n°6), C1 → C6 (n°7,
> T-265 → T-270) — aucun n'est repris ici.

## 1. Objet et méthode

Objectif : après sept passes, rejouer **à l'exécution** les parcours encore
intacts — client (mes réservations, messages, factures, promo, alertes
prix, suppression de compte), invité (claim), hôte (no-show, finalisation
remboursement), admin (cron) — avec des données fraîches (fixtures dédiés
MBB-T8-*, comptes créés pendant la passe) plutôt qu'en re-lecture statique.

| Moyen | Détail |
| --- | --- |
| App | `next dev` sur `:3000`, 3 sessions (hôte, client, admin) + 2 comptes invités créés pendant la passe |
| Données | fixtures dédiés : réservations `MBB-2026-504FFQ`, `MBB-T8-NOSHOW`, `MBB-T8-COMPLETE`, `MBB-T8-REVIEW`, `MBB-T8-GUEST`, promo `T8PROMO2`, 2 alertes prix, 30 fils de messages |
| Vérification | HTTP (statuts + corps), base (état avant/après), `email_outbox` (ce qui est réellement envoyé), UI (HTML rendu) |
| Règle | aucun code modifié ; chaque constat = preuve d'exécution + solution non régressive |

## 2. Synthèse des constats

| N° | Gravité | Parcouru | Constat |
| --- | --- | --- | --- |
| F1 | **Majeur** | `/mes-reservations` | 500 pour tout client possédant une demande `pending` (le champ `requestExpiresAt`, toujours posé à la création, déclenche un `RangeError` Intl) — **préexistant** au premier commit audité (`1ad5f2d`) |
| F2 | Mineur | No-show (hôte) | Bilatéral en défaut : le voyageur n'est jamais prévenu d'un no-show et n'a aucun recours |
| F3 | Report produit | Remboursement hors plateforme | La finalisation `refunded` est Stripe-only : aucun action hôte/admin pour clore un remboursement manuel |
| F4 | Mineur | Suppression de compte | Les **alertes prix d'un compte supprimé** continuent d'être notifiées : e-mails « sent » vers l'adresse anonymisée (preuve runtime, § 3.4) |
| F5 | Mineur | Claim invité | E-mail de claim unique, jeton 24 h, **aucun renvoi auto-service** : e-mail perdu ou fenêtre dépassée = réservation inatteignable sans support |

**Vérifié sain** (hypothèses infirmées, à ne pas rouvrir) : § 4 —
facture client (API + lien UI), compteur de non-lus, cycle promo
(incrémentation/décrémentation/réutilisabilité), i18n EN des nouveaux
labels (T-265 → T-270 + alertes prix), cashback/loyalty, review requests,
traces cron, double-booking, lifecycle, suppression de compte (hors F4).

## 3. Constats détaillés et solutions non régressives

### F1 — 500 sur `/mes-reservations` : demande `pending` + `requestExpiresAt`

**Gravité : majeure** — la page centrale du client est cassée pour tout
utilisateur qui a au moins une demande en attente d'approbation de l'hôte.
Or `requestExpiresAt` est posé **sur 100 % des réservations** à la création
(`src/app/api/bookings/route.ts:472` puis `:510`), et la majorité des
réservations passe par `pending` (T-207 : pas de paiement en ligne).
En production, c'est un 500 de grande surface dès la première demande
envoyée.

**Preuve d'exécution** :

1. Fixture `6fe8386c` (réf. `MBB-2026-504FFQ`) créé via
   `POST /api/bookings` → 201, `status: pending`,
   `requestExpiresAt` posé automatiquement.
2. `GET /mes-reservations` connecté client → **500**, log serveur :
   `RangeError: Invalid time zone` / `Invalid option` levée par
   `Intl.DateTimeFormat` pendant le rendu de la page.
3. Chaîne exacte (code) :
   - `src/app/(main)/mes-reservations/page.tsx:229` :
     `formatDate(booking.requestExpiresAt, { dateStyle: "medium", timeStyle: "short" }, locale)` ;
   - `src/lib/utils.ts:45` (`formatDate`, branche non-calendaire) :
     `formatTimestamp(date, { day: "numeric", month: "long", year: "numeric", ...options }, locale)`
     — les `dateStyle`/`timeStyle` du call site transitent dans `options` ;
   - `src/lib/dates.ts:137` (`formatTimestamp`) :
     `new Intl.DateTimeFormat(locale, { day, month, year, hour, minute, ...rest, timeZone })`
     où `rest` contient `dateStyle`/`timeStyle` → **combinaison
     interdite par la spec ECMA-402** (les options de style ne peuvent pas
     être mélangées à des composants de format explicites) → `RangeError`.

**Pourquoi préexistant** : les trois fichiers sont intacts depuis
`1ad5f2d` ; aucun des audits n°1 → n°7 n'a touché ce call site. La page
n'avait simplement jamais été rendue avec une `pending` +
`requestExpiresAt` non nulle (le seed n'en contient pas).

**Solution non régressive** — corriger dans `formatTimestamp`
(`src/lib/dates.ts`), au point d'origine :

```ts
export function formatTimestamp(value, options = {}, locale = "fr-FR") {
  if (value === null || value === undefined) return "—";
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return "—";
  const { timeZone = DEFAULT_TIME_ZONE, ...rest } = options;
  // ECMA-402 : dateStyle/timeStyle sont exclusifs des composants explicites.
  const usesStyles = "dateStyle" in rest || "timeStyle" in rest;
  const intlOptions = usesStyles
    ? { ...rest, timeZone }                       // styles seuls (conduite du call site)
    : { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", ...rest, timeZone };
  return new Intl.DateTimeFormat(intlLocale(locale), intlOptions).format(instant);
}
```

**Pourquoi sans régression** :
- les call sites qui passent des composants explicites (l'immense majorité,
  y compris la branche par défaut de `formatDate`) prennent exactement le
  même chemin et les mêmes options qu'avant — rendu identique ;
- seuls les call sites qui passent des styles (aujourd'hui en
  `RangeError` → 500) sont réparés, avec le rendu que le call site a
  demandé (`dateStyle`/`timeStyle` + `timeZone` explicite, déterministe) ;
- aucune signature, aucun autre module, aucun e-mail touché ;
- test à ajouter : `formatDate("2027-04-05T12:00:00.000Z", { dateStyle: "medium", timeStyle: "short" })`
  retourne une chaîne (pas d'exception) + test de non-régression sur un
  call avec composants seuls (rendu inchangé).

### F2 — No-show : le voyageur n'est jamais prévenu, aucun recours

**Gravité : mineur** (monnaie de l'hôte, pas de perte d'argent immédiate —
le no-show ne verse pas de cashback, `book.noShowConfirm` l'annonce à
l'hôte).

**Preuve d'exécution** : fixture `dd370535` (réf. `MBB-T8-NOSHOW`, `paid`,
séjour 2026-08-01 → 03) → hôte « Marquer no-show » (PUT
`status: "no_show"`) → 200. `email_outbox` : **aucun e-mail au voyageur**
(zéro ligne pour cette réservation) ; rien dans `cron_runs` ni le
lifecycle (`src/lib/booking-lifecycle.ts`) ne produit de notification
`no_show` côté client. Le voyageur découvre le no-show (et la perte
d'éventuels crédits) en consultant l'application, sans raison ni recours.

**Solution non régressive** :
1. **E-mail voyageur au passage `no_show`** (best-effort, comme les autres
   transitions du lifecycle) : template `noShowNotification`
   (réf. réservation, dates, « aucun remboursement, aucun cashback »),
   `eventKey: no-show:<bookingId>` (idempotent), respect des préférences
   email du compte (T-261, déjà en place pour les review requests) et de sa
   langue. Côté guest (compte non claimé) : envoi à `guestEmail` si
   `passwordHash` est nul — le claim ne bloque pas l'information.
2. **Recours minimal (optionnel, décision produit)** : un lien de contestation
   dans l'e-mail renvoyant vers `/mes-reservations` ; le traitement reste
   humain (support), pas d'automatisation.

**Pourquoi sans régression** : ajout best-effort post-commit sur une
transition existante (même motif que `sendBookingRequestCreatedIfNeeded`) ;
un échec d'e-mail ne modifie pas le statut ; aucun chemin hôte/modifié ;
les préférences opt-out déjà honorées pour d'autres e-mails le seront par le
même mécanisme.

### F3 — Finalisation du remboursement hors plateforme : Stripe-only

**Gravité : report produit** (aucun bug : c'est une capacité absente,
consciemment bornée au PSP).

**Preuve d'exécution** : `refundStatus` ne passe à `refunded` que dans
`src/lib/payment-events.ts` (événement Stripe). Hors plateforme, le label
`bookings.refundManual` (« à traiter par l'hébergeur » / « to be handled by
the host ») existe dans l'UI mais **aucun bouton hôte ou admin ne finalise**
le remboursement : une réservation `paid` remboursée manuellement reste
définitivement dans l'état intermédiaire. Aucun endpoint ne permet à
l'hôte/admin de poser `refunded` + note manuelle.

**Solution non régressive (si le produit valide la capacité)** :
1. `POST /api/bookings/[id]/refund` réservé **hôte ou admin**, réservable
   uniquement si `paymentStatus: "paid"` et `refundStatus: "none"` (409
   sinon) ;
2. dans la même transaction : `refundStatus: "refunded"`,
   `refundAt: now()`, note manuelle (champ `refundNote`), **jamais**
   d'écriture PSP (pas de refund Stripe : la réservation est hors
   plateforme ou déjà soldée côté PSP) ;
3. audit log (`bookings.refund.manual`) + e-mail voyageur best-effort
   (même motif que F2.1, `eventKey: refund-finalized:<bookingId>`).

**Pourquoi sans régression** : endpoint additif ; la voie Stripe reste la
seule à pouvoir poser `refunded` pour un paiement PSP (pas de double
source de vérité) ; garde d'état stricte (paid + none) qui ne peut ni
dupliquer un refund Stripe ni rouvrir une réservation non payée.

### F4 — Alertes prix d'un compte supprimé : notifications post-mortem

**Gravité : mineur** (fuite de volume d'e-mails vers des adresses mortes,
pas de fuite de données — l'e-mail ne contient que le prix d'une
properté publique — mais c'est un défaut de la chaîne de suppression que
l'audit n°7 a par ailleurs validée).

**Preuve d'exécution (enchaînement complet)** :
1. Compte invité `b81d6052` (`t8-guest@test.local`) créé pendant la passe,
   réservation `53306f3d` (`MBB-T8-GUEST`, completed), fil de message
   `3c11661d`, alerte prix `c9509c78` (`active: true`,
   `lastNotifiedPrice: 100.00`) ;
2. `DELETE /api/users/me` → 200 : anonymisation complète validée par
   l'audit n°7 (users, bookings, outbox, audit log, sessions) ;
3. `price_alerts` : **l'alerte reste `active: true`** —
   `anonymizeUserAccount` (`src/lib/account-anonymization.ts`) ne la touche
   pas, ni `users.priceAlertEnabled` ;
4. flag `priceAlertEnabled` remis à `true` (simulate un utilisateur
   existant qui avait opt-in — rappel : à l'inscription le flag est
   `false` par défaut, ce qui masque le bug pour les comptes qui
   n'activent jamais les alertes) ;
5. `GET /api/cron/price-alerts` (Bearer `CRON_SECRET`) →
   `notified: 1` ;
6. `email_outbox` : ligne `price-alert:c9509c78…:base:100.00`, destinataire
   `deleted-fb8d8ffc6728af9f@anonymized.local`, statut **`sent`**.

L'alerte d'un compte mort sera donc notifiée à chaque baisse de prix,
perpétuellement, vers une adresse qui ne recevra jamais rien — et
consomera des envois outbox/SMTP inutiles.

**Solution non régressive** (2 nœuds, l'un suffit à boucher, les deux
défendent en profondeur) :
1. **À l'anonymisation** (`src/lib/account-anonymization.ts`, même
   transaction que le reste) :
   `UPDATE price_alerts SET active = false WHERE user_id = ?` et
   `UPDATE users SET priceAlertEnabled = false` ;
2. **Garde de défense dans la requête du cron**
   (`src/app/api/cron/price-alerts/route.ts`, ~L362) : ajouter
   `isNull(users.deletedAt)` à la jointure du scan — même si un futur
   chemin de suppression oublie l'étape 1, le cron ignore les comptes
   supprimés.

**Pourquoi sans régression** : l'étape 1 ne s'exécute que pour un compte
en cours de suppression (aucun compte actif n'est touché) ; l'étape 2
n'change l'ensemble scanné que d'un compte déjà inerte (désactivé par
l'étape 1) — pour les comptes sains, `deletedAt` est nul et la condition
est trivialement vraie. Pas d'impact sur l'idempotence
(`lastNotifiedPrice`) ni sur les alertes actives des comptes vivants
(vérifié pendant la passe : alerte `c0bc03e2` du client, `notified: 1`
puis `notified: 0` au 2e run).

### F5 — Claim invité : e-mail unique, aucun renvoi, pas de recours

**Gravité : mineur** (parcours rarement en défaut, mais sans issue
auto-service quand il l'est).

**Preuve d'exécution / code** :
1. `POST /api/bookings` en guest crée l'utilisateur avec
   `passwordHash: null`, `emailVerified: false`
   (`src/app/api/bookings/route.ts:454`) — le voyageur **ne peut pas se
   connecter** avant de cliquer sur le lien de claim ;
2. l'e-mail de claim part **une seule fois** : `eventKey: guest-claim:<id>`
   (idempotent) + jeton `guest_claim` de **24 h**
   (`src/lib/tokens.ts:27`) ; la demande elle-même expire aussi après
   `BOOKING_REQUEST_TTL_HOURS` (défaut **24 h**,
   `src/lib/booking-request-expiration.ts:13`) — les deux fenêtres
   convergent ;
3. le lien est **à usage unique** (`consumeToken`, `src/lib/tokens.ts:52`,
   UPDATE atomique `isNull(usedAt)`) — comportement correct ;
4. `POST /api/auth/resend-verification` ne renvoie que des e-mails
   `email_verification` **pour un utilisateur connecté** — hors d'atteinte
   d'un guest (sans session, sans mot de passe) ;
5. aucune autre route (admin, support, client) n'émet un nouveau jeton
   `guest_claim` : grep exhaustif, 2 fichiers seulement touchent ce
   purpose (émission + consommation). Le commentaire du code le dit
   explicitement : *« l'outbox ou le support pourra reprendre le claim
   sans jamais exposer le token dans la réponse API »* — c'est-à-dire un
   traitement manuel.

**Impact** : e-mail perdu (spam) ou 24 h dépassées → le voyageur ne peut
plus jamais récupérer sa réservation, et la demande expire ; seule une
action manuelle (base/outil support) peut sauver le cas.

**Solution non régressive** :
1. `POST /api/auth/resend-guest-claim` avec
   `{ bookingReference, guestEmail }` :
   - cherche une réservation `pending` dont `guestEmail` correspond ET
     dont le compte associé n'est pas encore claimé
     (`passwordHash IS NULL`) ;
   - sinon : réponse **générique succès** (pas de fuite d'existance) ;
   - sinon : nouveau jeton `guest_claim` (24 h) + même template
     `guestAccountClaim`, `eventKey: guest-claim-resend:<id>:<ts>` ;
   - rate-limit strict (ex. 3 / h / email) comme `resend-verification`.
2. UI : un lien « Renvoyer l'e-mail d'activation » sur la page publique
   de réservation (après soumission guest) et/ou sur la page d'erreur du
   claim expiré.

**Pourquoi sans régression** : endpoint additif (ne touche ni le jeton
existant ni sa consommation à usage unique — un lien valide continue de
marcher normalement) ; double identification (réf. + email) + réponse
générique + rate-limit = pas de vecteur d'énumération ni de spam ; le flux
happy-path (lien reçu → cliqué) est strictement inchangé.

## 4. Vérifications saines (hypothèses infirmées — à ne pas rouvrir)

| Scénario | Résultat | Preuve |
| --- | --- | --- |
| Facture client (API + UI) | OK | `GET /api/bookings/[id]/invoice` = 200 HTML « Reçu / Confirmation de réservation » ; le lien « Facture / Reçu » est rendu dans `booking-row-actions.tsx:294` (page `/mes-reservations`), label FR+EN |
| Compteur de non-lus conversations | OK | `unread_by_user = 2` forcé sur un fil → rendu de `/messages/[id]` (client) → `unread_by_user = 0` (reset RSC `messages/[id]/page.tsx:68`, aussi API `messages/route.ts:126`) |
| Cycle promo (création, usage, annulation, réutilisation) | OK | `T8PROMO2` (10 %, `maxUses=1`) : booking → 201 + `current_uses=1` ; annulation (PUT `status: cancelled`) → `current_uses` **re-décrémenté** à 0 (`booking-benefits.ts:18`, `GREATEST(x-1,0)` ; aussi `booking-request-expiration.ts:86` et cron `:168`) ; rebooking avec le code → 201. Types gérés : `percentage` / `fixed_amount` (`applyPromoToTotal`) ; `free_night` legacy = erreur propre « calcul par nuit pas encore disponible » (comportement documenté, pas un bug) |
| i18n EN des labels nouveaux (T-265 → T-270, alertes prix) | OK | `status.no_show`, `book.noShowConfirm`, `book.invoiceReceipt`, `bookings.refundManual` (« à traiter par l'hébergeur » / « to be handled by the host ») : clés FR+EN présentes et symétriques (0 clé orpheline dans les deux blocs) ; rendu EN vérifié au runtime (bannière T-270 « 25 results shown out of 30 » / « Show all (30) » quand `users.language = "en"`) |
| Priorité de langue (profil > header) | OK (by design) | `getServerLocale` : `users.language` d'abord, header `x-ui-language` en secours — le test au header seul sur un compte FR reste en FR, **intentionnel** |
| Cashback niveau 2 = 0.00 | OK (by design) | `calculateLoyaltyAward` (`src/lib/loyalty.ts`) : 5 % seulement si `level ≥ 3` **avant** le séjour — fixture completed `d32750d9` : loyalty 7 → 8, cashback 0.00, `loyaltyAwardedAt` posé |
| Review requests | OK | `sendReviewRequests` (cron, fenêtre 14 j, `eventKey: review-request:<id>` idempotent, préférences T-261) : fixture `aecf0c15` (checkout ≤ 14 j) → `reviewRequestsSent: 1` → outbox `sent` ; séjour vieux → 0 (fenêtre, pas un bug) |
| Traces cron | OK | `cron_runs` : lignes price-alerts complètes (T-250) ; cron = **GET** + Bearer `CRON_SECRET` (POST = 405, contrat Vercel) |
| Double-booking | OK | 201 puis 409 sur la même chambre qty=1 (T-270 / garde stock) |
| Lifecycle + completed + loyalty | OK | transitions hôte validées (pending → confirmed → completed), compteurs bestrewards cohérents |
| Suppression de compte (hors F4) | OK | gardes 409 (pending/confirmed, propriétés hôte), anonymisation users/bookings/outbox/audit/sessions, wallet gelé journalisé (T-262), conversations côté hôte = « Supprimé » (by design), wishlist partagée sans nom owner (pas de fuite) |
| Claim : lien à usage unique | OK | `consumeToken` atomique (`isNull(usedAt)`) — 2e clic = échec propre (le constat F5 porte sur l'absence de **renvoi**, pas sur la consommation) |

## 5. Décisions à trancher (réponse oui / non)

1. **F1** : appliquer le fix de `formatTimestamp` (styles seuls) + 2 tests —
   recommandé sans débat (500 de grande surface) ?
2. **F2** : e-mail voyageur au no-show (best-effort, préférences T-261) ?
   Le recours (contestation) reste-t-il humain ou faut-il un champ de
   motif visible côté client ?
3. **F3** : la plateforme veut-elle la capacité « finaliser le
   remboursement manuel » (endpoint hôte/admin, § 3.3) ? Si non, documenter
   le process support à la place ?
4. **F4** : appliquer la double garde (anonymisation + `isNull(deletedAt)`
   dans le cron) — recommandé sans débat ?
5. **F5** : endpoint de renvoi du claim guest (réf. + email, rate-limit,
   réponse générique) + lien UI ? Ou garder le recours support-only
   (documenté) ?

## 6. État de la base après la passe

**Exécuté** : base ramenée à l'état seed, purge de l'ensemble des fixtures
n°8 (contrôlé après coup : 0 ligne résiduelle sur chaque table) :

- chambre `eb6589ee` (« T8 Unique », qty=1) supprimée (1 ligne) ;
- 7 réservations supprimées : `6fe8386c`, `dd370535`, `d32750d9`,
  `aecf0c15`, `53306f3d` + les 2 réservations promo de la passe
  (`267ae9de` annulée, `aa83e3e5` pending) ;
- compte invité `b81d6052` (anonymisé) : ligne user (1), jeton
  `verification_tokens` (1), fil `3c11661d` + message supprimés ;
- alertes prix `c0bc03e2` (client) et `c9509c78` (invité) supprimées
  (2) ; promo `T8PROMO2` supprimée (1) ;
- 31 fils `t8c-*` + `t8-guest-conv` supprimés (31) + 31 messages ;
- `cron_runs` price-alerts de la passe supprimés (6) ; `email_outbox`
  purgée (12 lignes, toutes issues de la passe) ;
- `bestrewards_bookings_count` du client revenue de 8 → 7 ;
- `language` du client revenue à `fr` (test i18n) ;
- `CRON_SECRET` retiré de `.env.local` (ajouté pendant la passe pour
  invoquer le cron).

Aucune ligne de code applicatif modifiée pendant cette passe.
