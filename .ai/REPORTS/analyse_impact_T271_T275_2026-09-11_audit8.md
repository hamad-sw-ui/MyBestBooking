# Analyse d'impact — audit n°8, constats F1 → F5 (T-271 → T-275)

- **Date** : 2026-09-11 · **Branche** : `arena/01a0913d-mybestbooking`
- **Tâche** : implémentation des 5 constats de l'audit runtime n°8
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_n8_parcours_execution.md`
  (copie `.ai/REPORTS/analyse_2026-09-11_audit_runtime_n8_parcours_execution.md`)
- **Preuve d'exécution source** : chaque constat a été rejoué en runtime pendant
  l'audit (fixtues MBB-T8-*, purgés après coup) — voir § 3 de l'analyse.

## Niveaux (§15.0)

| Tâche | Constat | Niveau | Justification |
|---|---|---|---|
| **T-271** | F1 — 500 `/mes-reservations` (styles Intl + composants) | **S** | changement de comportement d'une fonction publique (`formatTimestamp`) lue par 5 modules et ~10 écrans |
| **T-272** | F2 — no-show sans e-mail voyageur | **S** | nouveau gabarit d'e-mail + interrupteur de réglage + hook de transition (aucune migration) |
| **T-273** | F3 — finalisation du remboursement hors plateforme | **C** | logique financière (état `refunded` persisté), nouvelle route API, action UI hôte/admin — débat §15.2 obligatoire |
| **T-274** | F4 — alertes prix d'un compte supprimé | **S** | extension de la transaction d'anonymisation + garde SQL dans le scan cron (aucune migration) |
| **T-275** | F5 — renvoi du claim invité | **C** | sécurité : nouveau jeton émis par une route publique, anti-énumération, rate-limit — débat §15.2 obligatoire |

---

## T-271 — `formatTimestamp` : styles Intl exclusifs des composants

**Commandes exécutées** (§14.2) :

```bash
grep -rln "formatTimestamp" src/ | grep -v test
# → src/components/bulk/bookings-manager.tsx, src/components/bulk/reviews-manager.tsx,
#   src/components/bulk/users-manager.tsx, src/lib/utils.ts, src/lib/dates.ts
grep -rln "from \"@/lib/utils\"" src/app | head -8
# → hebergement/[slug] (+ /avis), mes-reservations, messages (+ [id]), mon-compte,
#   recherche, reservation — 8+ écrans transitent par formatDate/formatDateShort
```

1. **Appelants directs** : `src/lib/utils.ts` (`formatDate:45`, `formatDateShort:52`),
   `bulk/bookings-manager.tsx`, `bulk/reviews-manager.tsx`, `bulk/users-manager.tsx`.
2. **Appelants indirects** : tous les écrans qui importent `@/lib/utils`
   (8 pages RSC listées ci-dessus + composants client) — le chemin
   `formatDate` non-calendaire est le seul qui atteint `formatTimestamp`.
3. **ViewModel** : aucun (pas de couche MVVM) ; le helper est importé par les
   pages RSC et les managers bulk.
4. **Écrans impactés** : aucun **rendu** ne change (seul le call site en
   `RangeError` est réparé : `mes-reservations/page.tsx:229` avec
   `requestExpiresAt` + `{ dateStyle, timeStyle }`).
5. **Workers/Services** : aucun (fonction pure, pas de cron ni webhook).
6. **Tests existants** : `src/lib/dates.test.ts` (couvre `formatCivilDate` /
   `formatTimestamp`), `src/lib/utils.test.ts`.
7. **Nouveaux tests** : `src/lib/dates.t271.test.ts` — (a) timestamp +
   `{ dateStyle, timeStyle }` → chaîne, pas d'exception ; (b) timestamp +
   composants seuls → rendu **identique** à l'avant (non-régression verrouillée) ;
   (c) civil + styles → inchangé (branche `formatCivilDate` pas touchée).
8. **Risques de régression** : **faible** — la branche « styles seuls » ne peut
   être atteinte que par des options contenant `dateStyle`/`timeStyle`, qui
   lèvent aujourd'hui `RangeError` partout (aucun call site sain ne passe par
   là) ; la branche par défaut (composants) garde les options exactement
   identiques, ordre de spread inclus.
9. **À revérifier après** : `/mes-reservations` (500 → 200 avec une demande
   pending + `requestExpiresAt`), `/recherche`, `/messages` (dates des fils),
   fiche `/hebergement/[slug]` (dates de disponibilité) — rendus inchangés.

---

## T-272 — no-show : e-mail voyageur

**Commandes exécutées** :

```bash
grep -rln "sendBookingConfirmationIfNeeded" src/ | grep -v test
# → src/app/api/bookings/[id]/route.ts, src/lib/booking-confirmation.ts,
#   src/lib/booking-request-notification.ts, src/lib/payment-intents.ts
grep -n "no_show" src/app/api/bookings/[id]/route.ts
# → 23 (schéma), 179 (garde markPaidOffline) : la transition est traitée dans
#   le flux générique de la transaction (aucun hook post-commit aujourd'hui)
```

1. **Appelants directs** : `PUT /api/bookings/[id]` (route.ts) — la transition
   `→ no_show` est appliquée dans la transaction générique ; seul ce point est
   hooké (le bulk admin n'applique pas `no_show` : vérifié, `availableTransitions`
   hôte/admin seulement).
2. **Indirects** : aucun autre émetteur de `no_show` (le cron T-222 ne produit
   que `completed`/`cancelled` : `booking-request-expiration.ts`).
3. **ViewModel** : `src/lib/mail/templates.ts` (+ gabarit), `src/lib/mail/strings.ts`
   (chaînes FR/EN), nouveau `src/lib/no-show-notification.ts` (ou fonction
   locale — voir conception), `src/lib/settings.ts` (clé `bookingNoShow`).
4. **Écrans** : aucun écran modifié (l'état `no_show` est déjà rendu partout).
5. **Workers/Services** : l'outbox (`deliverEmail`) et son retry existant ;
   l'envoi est best-effort post-commit (même motif que la confirmation T-203).
6. **Tests existants** : `booking-cancellation-mail` (T-150),
   `booking-lifecycle-emails.t261` (préférences), `route.t203`
   (markPaidOffline), `route.t216` (transitions + audit).
7. **Nouveaux tests** : `no-show-notification.t272.test.ts` — (a) transition
   `→ no_show` → ligne outbox `no-show:<id>` `sent` avec le montant ;
   (b) idempotence : 2e appel → aucune 2e ligne ; (c) interrupteur
   `notifications.bookingNoShow=false` → aucun envoi ; (d) e-mail strictement
   absent pour une transition non no-show (non-régression du silence).
8. **Risques** : **faible** — ajout best-effort post-commit (un échec e-mail ne
   touche pas la transition committée) ; le gabarit est un **ajout** de template
   (les gabarits existants ne sont pas modifiés) ; la clé de réglage est
   additive avec défaut `true` (`mergeDefaults` complète les payloads stockés —
   pattern T-221 documenté).
9. **À revérifier** : l'e-mail d'annulation voyageur (T-266, ligne remboursement)
   reste inchangé ; le badge `no_show` hôte ; la timeline ; le cashback
   (le no-show ne verse rien — invariant T-222).

---

## T-273 — finalisation du remboursement hors plateforme (route `POST /api/bookings/[id]/refund`)

**Commandes exécutées** :

```bash
grep -rn "refundStatus" src/app/api/ --include="route.ts" | grep -v test
# → (VIDE) : aucune route n'écrit refundStatus ; seul payment-events.ts (webhook
#   Stripe) pose refundedAt/refunded — confirmé pendant l'audit n°8.
grep -n "refundStatus\|refundedAt\|refundAmount" src/db/schema.ts
# → 372-374 : refundAmount decimal(10,2) default 0 · refundStatus varchar(20)
#   default 'none' · refundedAt timestamp — tout existe, aucune migration.
```

1. **Appelants directs** : nouveau (route `POST /api/bookings/[id]/refund` +
   bouton `BookingRowActions` hôte/admin). La FSM `booking-lifecycle.ts` n'est
   **pas** modifiée (le refund n'est pas une transition de statut).
2. **Indirects** : `invoice.ts` (déjà lit `refundStatus` pour le label reçu),
   `mes-reservations` (déjà lit `refundStatus` pour le label T-266 — le label
   « à traiter par l'hébergeur » devient « Remboursé » via les clés existantes
   `host.refunded`).
3. **ViewModel** : `recordAudit` (nouvelle action `booking.refund.manual`),
   e-mail voyageur best-effort (gabarit `bookingRefundFinalized`,
   `eventKey: refund-finalized:<id>`).
4. **Écrans** : `/dashboard/bookings` (liste, bouton) ; la fiche
   `/dashboard/bookings/[id]` (badge `refunded` déjà rendu — `page.tsx:101-102`).
5. **Workers/Services** : aucun (pas de cron, pas de PSP — la route ne touche
   **jamais** l'intent Stripe : la réservation cible est `paymentMethodOffline`
   ou sans intent).
6. **Tests existants** : `route.t203` (markPaidOffline), `route.t216`
   (transitions), `booking-cancellation` (refunds), `payment-events`
   (refunds Stripe — la voie PSP doit rester inchangée).
7. **Nouveaux tests** : `refund/route.t273.test.ts` — (a) paid + `refundStatus
   = 'none'` + hôte → 200 + `refundedAt` posé + audit `booking.refund.manual`
   + e-mail outbox ; (b) `refundStatus = 'pending'` → 409 (l'état intermédiaire
   existe déjà, on ne le double pas) ; (c) non payé → 409 ; (d) voyageur →
   403 ; (e) tiers → 403 ; (f) admin → 200 ; (g) idempotence : 2e appel → 409
   (déjà refunded) ; (h) réservation avec `paymentIntentId` PSP (payée en
   ligne) → 409 « remboursement PSP » (la voie Stripe reste exclusive — jamais
   de double refund).
8. **Risques** : **moyen** (finance) — mitigé par : gardes d'état strictes en
   SQL (`paymentStatus = 'paid' AND refundStatus IN ('none') AND
   paymentIntentId IS NULL`), transaction `FOR UPDATE`, audit log, zéro contact
   PSP. Un refund « manuel » ne peut jamais masquer un refund Stripe : la voie
   `paymentIntentId IS NULL` exclut les paiements en ligne.
9. **À revérifier** : le webhook Stripe (inchangé — test `payment-events`
   rejoué), l'annulation (les refunds d'annulation passent par
   `booking-cancellation.ts`, pas par la nouvelle route), la facture (le label
   « Remboursé » existant s'affiche), le badge dashboard.

---

## T-274 — alertes prix d'un compte supprimé

**Commandes exécutées** :

```bash
grep -rln "anonymizeUserAccount" src/ | grep -v test
# → src/app/api/users/me/route.ts (appel dans la tx de DELETE /api/users/me)
grep -n "priceAlerts.active\|priceAlertEnabled" src/app/api/cron/price-alerts/route.ts
# → 364 : .where(and(eq(priceAlerts.active, true), eq(users.priceAlertEnabled, true)))
```

1. **Appelants directs** : `DELETE /api/users/me` (`users/me/route.ts`) via
   `anonymizeUserAccount(executor, …)` ; le cron `price-alerts` (requête de
   scan, route.ts:360-364).
2. **Indirects** : `POST /api/price-alerts` (création — pas touchée),
   `GET/DELETE /api/price-alerts/[id]` (pas touchés).
3. **ViewModel** : `src/lib/account-anonymization.ts` (2 updates ajoutés dans
   la même transaction) ; `src/app/api/cron/price-alerts/route.ts` (1
   prédicat ajouté).
4. **Écrans** : aucun (les alertes supprimées n'étaient pas de toute façon
   accessibles au compte supprimé).
5. **Workers/Services** : le cron price-alerts (3 × 24 h) — son ensemble
   scanné se réduit d'un compte déjà inerte.
6. **Tests existants** : `users/me/route.t262.test.ts` (suppression de compte,
   wallet gelé), `cron/price-alerts/route.test.ts`, `route.t248.test.ts`.
7. **Nouveaux tests** : (a) `account-anonymization.t274.test.ts` — après
   `anonymizeUserAccount` : `price_alerts.active = false` +
   `users.priceAlertEnabled = false` (même tx) ; (b) `price-alerts/route.t274.test.ts`
   — alerte active d'un user `deletedAt != null` + flag true → **0 notifié**
   (garde `isNull(users.deletedAt)`), alerte d'un user vivant → notifiée
   (non-régression).
8. **Risques** : **faible** — l'étape 1 ne s'exécute que pour un compte en
   cours de suppression ; l'étape 2 ne change l'ensemble scanné que d'un
   compte déjà désactivé par l'étape 1 (défense en profondeur). Aucune
   idempotence ni prix n'est touchée (`lastNotifiedPrice` intact).
9. **À revérifier** : le flux alerte prix complet (création → notification →
   idempotence → désabonnement T-239) sur un compte vivant ; la suppression de
   compte (toutes les assertions t262 rejouées).

---

## T-275 — renvoi du claim invité (route `POST /api/auth/resend-guest-claim`)

**Commandes exécutées** :

```bash
grep -rln "guest_claim" src/app/api/ | grep -v test
# → src/app/api/auth/reset-password/route.ts (consommation),
#   src/app/api/bookings/route.ts (émission initiale) — aucune autre émission.
grep -n "resend" src/app/api/auth/ -r
# → resend-verification (email_verification uniquement, auth requise)
```

1. **Appelants directs** : nouveau (route publique + bouton de la page de
   confirmation du tunnel guest, `reservation-form.tsx` étape 4, quand
   `guestAccessPending`).
2. **Indirects** : `POST /api/bookings` (l'émission initiale reste la première
   et seule source du claim « premier envoi ») ; `/activer-compte` (consomme le
   lien — pas modifié).
3. **ViewModel** : `issueToken` (reuse du purpose `guest_claim`, TTL 24 h
   inchangé), `templates.guestAccountClaim` (gabarit existant, pas modifié),
   `rateLimit` (+ clé `guest-claim-resend:<email>` 3/h et `:ip` 10/h).
4. **Écrans** : `reservation-form.tsx` étape 4 (bouton « Renvoyer l'e-mail
   d'activation » + état envoyé) ; la page `/activer-compte` (état « lien
   expiré » gagne une mention renvoi — option, voir conception).
5. **Workers/Services** : outbox (`deliverEmail`) — `eventKey:
   guest-claim-resend:<bookingId>:<ts>` (distinct de l'initiale
   `guest-claim:<bookingId>` : plusieurs renvois possibles).
6. **Tests existants** : `reset-password` (claim), `bookings/route.t234`
   (claim initial), `resend-verification` (pattern rate-limit/réponse).
7. **Nouveaux tests** : `resend-guest-claim/route.t275.test.ts` — (a) booking
   pending + guestEmail exact + compte non claimé (`passwordHash NULL`) → 200
   générique + jeton émis + e-mail outbox vers le bon destinataire ; (b)
   compte déjà claimé (`passwordHash` posé) → 200 générique **sans** e-mail ;
   (c) email inconnu → 200 générique (anti-énumération) ; (d) booking déjà
   confirmé → 200 générique sans e-mail ; (e) rate-limit 3e+ appel → 429 ;
   (f) le lien initial reste consommable (non-régression du flux happy-path) ;
   (g) corps malformé → 400.
8. **Risques** : **moyen** (sécurité) — mitigé par : double identification
   (référence + email exact, l'un sans l'autre = rien), réponse générique
   identique dans tous les cas, rate-limit email + IP, jeton à usage unique
   inchangé (un renvoi n'annule pas le lien en cours — le `consumeToken`
   atomique protège), jamais de jeton dans la réponse.
9. **À revérifier** : le flux claim complet (T-109/T-268 : émission → lien →
   claim → `emailVerified=true` → session), l'expiration des demandes (T-209),
   `resend-verification` (inchangé).

---

## Synthèse non-régression (plan global)

| Invariant | Preuve de non-régression |
|---|---|
| Aucun contrat d'API existant modifié | les 2 routes sont **nouvelles** ; `PUT /api/bookings/[id]` n'est touché que par l'ajout best-effort post-commit (T-272) |
| FSM de statuts intacte | `booking-lifecycle.ts` non modifié ; le refund est un sous-état, pas une transition |
| Voie PSP exclusive et intacte | T-273 : garde `paymentIntentId IS NULL` ; tests `payment-events` rejoués |
| i18n | clés FR/EN appariées (verrou `ui-strings.test.ts` incrémenté) + entrées `api-error.ts` FR→EN pour les nouveaux messages |
| Réglages | clé `bookingNoShow` additive défaut `true` (`mergeDefaults` — pattern T-221) |
| E-mails existants | aucun gabarit modifié : T-272 et T-273 **ajoutent** des gabarits ; T-275 **réutilise** `guestAccountClaim` |
| Base | **aucune migration** : toutes les colonnes existent déjà (`refund_status`, `refunded_at`, `price_alerts.active`, `users.priceAlertEnabled`, `verification_tokens`) |

**Preuves attendues** : `npm run ci` complète (typecheck · lint 0/0 · i18n ·
ai:check · vitest intégral · build · smoke) + runtime réel des 5 scénarios
(500 → 200 ; e-mail no-show ; refund hôte 200/409/403 ; cron 0 notifié sur
compte supprimé ; renvoi claim → e-mail → lien consommable).
