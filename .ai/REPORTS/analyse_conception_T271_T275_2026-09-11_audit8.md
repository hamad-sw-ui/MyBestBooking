# Analyse de conception — audit n°8, T-271 → T-275

- **Date** : 2026-09-11 · **Branche** : `arena/01a0913d-mybestbooking`
- **Après** : `analyse_impact_T271_T275_2026-09-11_audit8.md` (§14, faits à l'appui)
- **Avant** : toute écriture de code (§15.1)

---

## 1. T-271 — `formatTimestamp` (F1, niveau S)

**Objectif** : réparer le 500 de `/mes-reservations` (et tout call site à venir
passant des styles) sans changer aucun rendu existant.

**Problème actuel** : `formatTimestamp` fusionne des composants explicites
(`day/month/year/hour/minute`) avec `...rest` — si `rest` contient
`dateStyle`/`timeStyle`, ECMA-402 lève `RangeError: Invalid option`. Le call
site `mes-reservations/page.tsx:229` est le premier touché (champ
`requestExpiresAt`, toujours posé par `POST /api/bookings`).

**Solutions possibles** :
1. **Corriger dans `formatTimestamp`** (détection styles → options = styles +
   `timeZone` seuls, sinon chemin historique). Av. : répare **tous** les call
   sites présents et futurs au point d'origine ; contrat du helper honnête
   (« options Intl valides »). In. : la fonction gagne une branche. Complexité
   minime, perf neutre, sécurité neutre, architecture inchangée.
2. **Corriger dans `formatDate`** (`utils.ts`) avant d'appeler
   `formatTimestamp`. Av. : un seul fichier. In. : `formatTimestamp` reste un
   piège pour tout appelant direct (et il y en a : 3 managers bulk) ; deux
   niveaux de helpers dupliqueraient la détection.
3. **Corriger le call site** (`mes-reservations/page.tsx:229` → composants
   explicites). Av. : diff minimal. In. : ne répare rien d'autre ; chaque futur
   écran « dateStyle » recréera le bug ; le helper continuera de lever sur des
   options valides par spec.
4. Ne rien faire. Défendable seulement si le champ était rare — il ne l'est
   pas (100 % des réservations), écarté.

**Retenue** : **1** — la correction au point d'origine est la seule qui couvre
les appelants directs existants ; la branche « styles seuls » n'est atteignable
que par des options qui lèvent aujourd'hui (zéro risque de rendre différemment
un call site sain).

**Risques** : Faible (voir impact § T-271.8). **Compatibilité** : aucune
migration, aucun contrat modifié, données/perf inchangées.

**Plan de développement** :
- étape 1 : `dates.ts` — détection `"dateStyle" in rest || "timeStyle" in
  rest` → options styles seuls + `timeZone` (test vert) ;
- étape 2 : tests `dates.t271.test.ts` (3 cas) + rejouer `/mes-reservations`
  runtime (pending + `requestExpiresAt` → 200).

**Retour arrière** : rétablir l'ancienne expression d'options (1 revert de
`dates.ts`) — aucun état persisté n'est créé.

---

## 2. T-272 — e-mail no-show voyageur (F2, niveau S)

**Objectif** : informer le voyageur quand l'hôte déclare un no-show, sans
toucher la transition ni les e-mails existants.

**Problème actuel** : la transition `→ no_show` (bouton hôte, `PUT
/api/bookings/[id]`) ne produit **aucun** e-mail au voyageur (preuve outbox
vide, audit n°8 § 3.2) ; le voyageur découvre l'état et la perte de cashback
seul, sans modalité.

**Solutions possibles** :
1. **Hook best-effort post-commit** dans la route `PUT` (modèle exact de
   `sendBookingConfirmationIfNeeded` T-203) : lecture verrouillée, insertion
   outbox `onConflictDoNothing(eventKey)` + `deliverEmail` best-effort ;
   interrupteur admin `notifications.bookingNoShow` (défaut `true`). Av. :
   zéro régression (l'envoi est hors transaction, un échec ne remet pas en
   cause le statut), idempotent par eventKey, coupable à distance par un
   admin, localisé (langue du voyageur). In. : une fonction lib de plus.
2. **Emission par cron** (scan des `no_show` récents). Av. : découplé. In. :
   latence (jusqu'à 3 × 24 h — le voyageur doit être informé à l'acte),
   complexité de fenêtre/idempotence, et le pattern house pour les e-mails
   d'acte est post-commit (confirmation, annulation) — incohérent.
3. **Aucun e-mail, lien de contestation UI uniquement**. Av. : aucun envoi.
   In. : ne résout pas le constat (le voyageur ne voit rien s'il ne consulte
   pas l'app) ; l'UI seule est un demi-parcours, rejeté.

**Retenue** : **1** — le pattern house (T-203/T-150) appliqué tel quel.
L'e-mail est **transactionnel** (état terminal, conséquences pécuniaires) :
hors préférences utilisateur T-261 (conformément au périmètre T-261 : seules
les catégories « confort » sont réglables), sous l'interrupteur admin global.

**Contenu du gabarit** (FR/EN, `mail/strings.ts`) : référence, dates du séjour,
« le séjour a été marqué non-présentation : aucun remboursement ni cashback »
+ montant dû (contexte) + lien `/mes-reservations`. Jamais de contenu de
contestation automatique (le recours reste humain — décision d'audit n°8 F2).

**Risques** : Faible. **Compatibilité** : clé de réglage additive défaut
`true` (payloads stockés complétés par `mergeDefaults`, pattern T-221) ;
gabarit ajouté (les 8 existants non modifiés) ; 0 migration.

**Plan de développement** :
- étape 1 : clé `bookingNoShow` (schéma + DEFAULTS, défaut `true`) ;
- étape 2 : gabarit `noShow` + chaînes FR/EN ;
- étape 3 : `sendNoShowNotificationIfNeeded(bookingId)` (lib, idempotent,
  interrupteur) + hook `data.status === "no_show"` post-commit dans la route ;
- étape 4 : tests (4 cas) + runtime (bouton hôte → outbox `sent`).

**Retour arrière** : désactiver `notifications.bookingNoShow` (effet immédiat,
aucune donnée créée) ; code : revert du hook + lib (l'outbox conserve au plus
des lignes inertes, purgées par la rétention existante).

---

## 3. T-273 — finalisation du remboursement hors plateforme (F3, niveau C)

**Objectif** : donner à l'hôte/admin un acte idempotent et audité pour clore
un remboursement déjà effectué **hors plateforme**, sans jamais toucher la
voie PSP.

**Problème actuel** : `refundStatus` ne devient `refunded` que par le webhook
Stripe (`payment-events.ts`) ; un paiement sur place remboursé manuellement
reste `pending`/`none` à vie (« à traiter par l'hébergeur », T-266) — l'état
comptable ne converge pas (preuve : aucune route n'écrit `refundStatus`,
audit n°8 § 3.3).

**Solutions possibles** :
1. **Nouvelle route dédiée `POST /api/bookings/[id]/refund`** (hôte/admin) :
   gardes d'état strictes (`paymentStatus='paid'`, `refundStatus='none'`,
   `paymentIntentId IS NULL`), transaction `FOR UPDATE`, pose
   `refundStatus='refunded'` + `refundedAt` (+ `refundAmount` = `total` −
   frais d'annulation déjà posés), audit `booking.refund.manual`, e-mail
   voyageur best-effort idempotent. Av. : sémantique explicite, RBAC propre,
   testable isolément, ne surcharge pas la FSM de statuts (le refund est un
   sous-état orthogonal au statut de réservation). In. : une route de plus.
2. **Action dans `PUT /api/bookings/[id]`** (champ `finalizeRefund`). Av. :
   pas de route. In. : la route porte déjà 5 comportements (statut,
   markPaidOffline, …) — mélanger un acte financier au flux de transitions
   alourdit le schéma et l'audit ; le pattern house pour les actes money est
   des routes dédiées (`/cancellation`, `/invoice`) — incohérent.
3. **Cron de réconciliation** (déduire le refund d'un e-mail/mot clé). Av. :
   sans UI. In. : infaisable honnêtement (aucune source de vérité du
   remboursement manuel), écarté.
4. Ne rien faire + process support documenté. Défendable (c'était l'état) —
   l'utilisateur a demandé l'implémentation des remarques, écarté.

**Retenue** : **1** — route dédiée, sous-état orthogonal, zéro contact PSP.

**Règles d'or (sécurité/finance)** :
- jamais d'écriture pour une réservation avec `paymentIntentId` (le refund
  PSP reste l'unique fait par le webhook Stripe — pas de double refund) ;
- `refundAmount` = `total` (le cas `cancellationFee` existe déjà :
  `refundStatus='pending'` → 409, la finalisation ne recalcule rien) ;
- RBAC : hôte du bien ou admin (même règle que `markPaidOffline`), jamais le
  voyageur ;
- idempotence : 2e appel sur un `refunded` → 409 explicite ;
- l'acte est **irréversible** (pas de bouton « annuler le refund ») — c'est un
  constat comptable, comme `markPaidOffline` ; le retour arrière est un
  ajustement admin manuel tracé (documenté dans `KNOWN_LIMITATIONS.md`).

**Risques** : Moyen (finance) — gardes SQL + lock + audit + tests 8 cas
(impact § T-273.7). **Compatibilité** : 0 migration (colonnes existantes) ;
badge/labels déjà rendus (`host.refunded`) ; webhook Stripe inchangé.

**Plan de développement** :
- étape 1 : route + gardes + audit + e-mail (tests verts) ;
- étape 2 : bouton UI hôte/admin dans `BookingRowActions` (visible si
  `paymentStatus='paid'` && `refundStatus='none'` && offline) + confirmation
  (motif `ReasonDialog` existant, pattern T-247) ;
- étape 3 : i18n FR/EN (bouton, confirmation, message de succès, erreurs
  `api-error.ts`) ;
- étape 4 : runtime (hôte 200, 2e 409, voyageur 403, PSP 409).

**Retour arrière** : retirer le bouton + la route (le sous-état reste lisible
— `refundStatus='refunded'` posé par la route est un fait comptable valide,
comme le serait un refund Stripe) ; aucune migration à revenir.

---

## 4. T-274 — alertes prix d'un compte supprimé (F4, niveau S)

**Objectif** : qu'aucune alerte d'un compte supprimé ne soit jamais notifiée
(défense en profondeur : à l'anonymisation **et** au scan).

**Problème actuel** : `anonymizeUserAccount` ne touche ni `price_alerts` ni
`users.priceAlertEnabled` ; le scan cron (`price-alerts/route.ts:364`) ne
filtre pas `deletedAt` → e-mails « sent » vers `deleted-…@anonymized.local`
(prove runtime, audit n°8 § 3.4).

**Solutions possibles** :
1. **Double garde** : (a) dans la tx d'anonymisation —
   `UPDATE price_alerts SET active=false WHERE user_id=…` +
   `users.priceAlertEnabled=false` ; (b) dans la requête cron —
   `isNull(users.deletedAt)`. Av. : l'étape (a) est l'invariant sémantique
   (un compte supprimé n'a pas d'alertes) ; l'étape (b) est le filet contre
   tout futur chemin de suppression ; les deux sont trivialement sûres pour
   les comptes vivants. In. : deux points de code.
2. **Garde cron seule** (`isNull(deletedAt)`). Av. : un seul point. In. :
   l'état incohérent reste en base (une alerte `active` rattachée à un compte
   mort) — les exports/admins voient un état faux ; si un futur lecteur
   d'alertes (autre que le cron) apparaît, il hérite du bug.
3. **Anonymisation seule** (désactiver à la suppression). Av. : un seul
   point. In. : les lignes existantes (comptes supprimés **avant** le
   correctif) restent notifiées — le bug observé persiste pour eux.

**Retenue** : **1** — la double garde est le minimum qui couvre à la fois les
comptes supprimés **avant** le correctif (b) et ceux supprimés **après**
(a+b).

**Risques** : Faible. **Compatibilité** : 0 migration ; aucune alerte de
compte vivant n'est touchée (`deletedAt` nul ⇒ condition vraie ;
`active`/`priceAlertEnabled` des comptes vivants non modifiés).

**Plan de développement** :
- étape 1 : `account-anonymization.ts` — 2 updates dans la tx (test : état
  après anonymisation) ;
- étape 2 : cron — prédicat `isNull(users.deletedAt)` (test : compte supprimé
  flag true → 0 notifié ; compte vivant → notifié) ;
- étape 3 : rejouer la suppression de compte complète (t262) — 0 régression.

**Retour arrière** : revert des 2 fichiers ; les lignes `active=false` posées
sur des comptes supprimés sont sémantiquement correctes même si le code
revient (pas de donnée à réparer).

---

## 5. T-275 — renvoi du claim invité (F5, niveau C)

**Objectif** : que l'échec du 1er e-mail de claim (spam, perte, 24 h) ne soit
plus une impasse auto-service, sans affaiblir le lien à usage unique.

**Problème actuel** : le claim = 1 e-mail (eventKey unique) + jeton 24 h ; le
compte guest a `passwordHash=null` (pas de connexion) ; `resend-verification`
n'accepte que `email_verification` **authentifié** ; aucune autre émission
(grep : 2 fichiers seulement) → impasse sans support (audit n°8 § 3.5).

**Solutions possibles** :
1. **`POST /api/auth/resend-guest-claim`** public, `{ bookingReference,
   guestEmail }` : garde (booking `pending` + `guestEmail` exact + user
   `passwordHash IS NULL` + `deletedAt IS NULL`) ; sinon réponse **générique
   succès** (anti-énumération) ; sinon jeton `guest_claim` neuf (24 h) +
   `guestAccountClaim` (gabarit existant) `eventKey:
   guest-claim-resend:<bookingId>:<ts>` ; rate-limit 3/h par email + 10/h par
   IP ; bouton UI sur l'écran de confirmation du tunnel guest. Av. : parcours
   bouclé, sécurité conservée (double identification + réponse générique +
   rate-limit), jeton initial **restant valide** (le renvoi ne casse pas un
   lien en cours — `consumeToken` atomique). In. : une route publique de plus.
2. **Renvoi depuis l'e-mail initial** (lien « n'avez-vous rien reçu ? » dans
   le e-mail de claim). Av. : pas de route. In. : si l'e-mail est **perdu**,
   le lien n'existe pas — ne résout pas le cas principal ; écarté.
3. **Émission par le support** (admin, manuellement). Av. : aucun surface
   publique. In. : impasse auto-service maintenue (le constat), charge support,
   et l'admin a déjà les outils d'outbox ; écarté comme **seul** recours (il
   reste le filet).

**Retenue** : **1** — seul à boucler le parcours auto-service sans affaiblir
le lien unique.

**Règles de sécurité** :
- la référence **seule** ne suffit pas (8 caractères, dans l'e-mail) :
  `guestEmail` exact exigé — l'attaquant connaît la référence pas l'email ;
  l'attaquant qui connaît l'email pas la référence ne déclenche rien ;
- réponse **identique** `{ message: générique }` dans tous les cas de garde
  (aucune fuite d'existance), e-mail seulement si les 4 gardes passent ;
- le renvoi **n'annule pas** le jeton en cours (usage unique conservé, pas de
  race « le lien dans la boîte mail ne marche plus après le renvoi ») ;
- rate-limit double (email 3/h — borne anti-spam de victimes ; IP 10/h —
  borne brute-force de références) ;
- jamais de jeton dans la réponse (le token n'est que dans l'e-mail).

**Risques** : Moyen (sécurité) — vus ci-dessus ; tests 7 cas (impact
§ T-275.7). **Compatibilité** : 0 migration (table
`verification_tokens` existante, purpose `guest_claim` existant) ; le flux
happy-path est strictement inchangé ; `resend-verification` intact.

**Plan de développement** :
- étape 1 : route + gardes + rate-limit + e-mail (tests verts) ;
- étape 2 : UI — bouton sur l'écran de confirmation (guest uniquement,
  `guestAccessPending`) + état « envoyé » ; i18n FR/EN ;
- étape 3 : runtime complet (renvoi → e-mail → lien → claim → login).

**Retour arrière** : retirer bouton + route ; les jetons émis par les renvois
restent valables 24 h max (bornes existantes) — aucun état à réparer.

---

## 6. Synthèse — aucun schéma, aucun contrat modifié

| Aspect | T-271 | T-272 | T-273 | T-274 | T-275 |
|---|---|---|---|---|---|
| Migration | non | non | non | non | non |
| Contrat API existant modifié | non | non | non | non | non |
| Route nouvelle | non | non | **oui** | non | **oui** |
| Réglage nouveau | non | **oui** (défaut `true`) | non | non | non |
| Gabarit e-mail nouveau | non | **oui** | **oui** | non | non (réutilisé) |
| i18n UI | non | non | **oui** | non | **oui** |
| FSM statuts | non | non | non (sous-état) | non | non |
