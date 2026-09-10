# Analyse runtime n°2 — fonctionnalités inachevées ou mal pensées

**Date** : 2026-09-10 · **Périmètre** : application complète (3 rôles + visiteur), base démo
seedée (8 users / 8 hébergements / 33 réservations / 24 avis) · **Nature** : analyse
seule — aucune ligne de code produit modifiée.

Suite de l'audit P1–P10 (`docs/analyse_2026-09-10_audit_runtime_fonctionnalites.md`,
livré en T-217). Cette seconde passe cherche ce que les correctifs précédents n'ont pas
couverte : les **parcours à moitié branchés**, les **promesses d'interface que rien ne
tient**, les **impasses de support** et les **décisions produit jamais exposées**.

---

## 1. Méthode

| Moyen | Détail |
|---|---|
| Rôles | visiteur, voyageur (`customer@`), hôte (`host@`), admin (`admin@`) — jetons frais `/api/auth/login` |
| Pages | les 43 `page.tsx` recensées ; crawl des tableaux de bord par rôle (dashboard admin, hôte, espace voyageur) |
| Liens | **261 liens internes** suivis (admin 122 · hôte 113 · voyageur 26) → **0 lien cassé** (200/307) |
| Routes API | les 67 `route.ts` confrontées à leurs appelants réels (`grep` des `fetch(`) |
| Réglages | registre `src/lib/settings.ts` vs sections réellement rendues par `settings-panel.tsx` |
| E-mails | inventaire des `enqueueEmail` par événement métier vs réglages `notifications.*` |
| Sondes | création/annulation de réservation, fil de conversation par rôle, suspension/réactivation, suppression de compte, confirmation de paiement, expiration de demande |
| Crawl final | `npm run site:audit:prod` (build + serveur de production) : **262 pages visitées, 0 issue** |
| État final | base remise à l'état seed, artefacts de sonde supprimés |

Ce qui est **hors périmètre** : P1–P10 (livrés), surfaces volontairement inactives
(`KNOWN_LIMITATIONS.md` § « Surfaces inactives »), limites assumées (Stripe réel, rate-limit
mémoire, cache 60 s, etc.).

**Résultat d'ensemble** : 11 constats (A1→A11), dont 4 bloquants pour des parcours métier
réels, 5 incohérences d'interface/données, 2 impasses de support. Aucun lien mort, aucune
route cassée, aucune erreur 500 rencontrée (262 pages crawlées en production, 0 issue) :
les problèmes sont dans ce qui *existe mais ne se termine pas*.

---

## 2. Synthèse

| # | Constat | Gravité | Effort | Tâche proposée |
|---|---|---|---|---|
| A1 | Échéance des demandes de réservation invisible et non notifiée | 🔴 haute | M | T-221 |
| A2 | Séjours échus non réglés : plus aucune surface ne les signale | 🔴 haute | M | T-222 |
| A3 | Réglages d'e-mails (`notifications`) sans UI admin (7 interrupteurs) | 🟠 moyenne | S | T-223 |
| A4 | Parrainage non réglable alors qu'il est affiché aux utilisateurs | 🟠 moyenne | S | T-224 |
| A5 | Avis : aucun e-mail (hôte à la publication, auteur après modération) | 🟠 moyenne | M | T-225 |
| A6 | Chambre : description, type, lits, surface, devise, équipements, photos figés | 🟠 moyenne | M | T-226 |
| A7 | Horaires d'arrivée/départ affichés mais non éditables (+ fuseau) | 🟠 moyenne | S | T-227 |
| A8 | Badges non administrables ; badge « Éco » inatteignable | 🟠 moyenne | M | T-228 |
| A9 | « Écrire à l'hébergeur » dans le back-office : libellé faux, bouton en échec pour l'admin | 🟡 faible | S | T-229 |
| A10 | Suspension et suppression partagent `deleted_at` → compte « zombie » réactivable | 🟠 moyenne | M | T-230 |
| A11 | 2FA sans issue de secours (ni codes, ni geste support) | 🔴 haute | M | T-231 |

*(S = ≤ ½ journée, M = 1–2 journées de travail agent incluant tests/docs.)*

---

## 3. Constats détaillés

### A1 — Une demande de réservation peut expirer sans que personne ne le sache

**Constat.** Depuis T-207/T-209, réserver = envoyer une **demande** à l'hôte. Cette demande
porte une échéance (`requestExpiresAt`) et un TTL par défaut de **24 h**
(`src/lib/booking-request-expiration.ts:8`). Passé ce délai, le cron annule la réservation.
Or cette échéance n'est affichée **nulle part** et l'annulation n'émet **aucun e-mail**.

**Preuves.**
- Sonde : `POST /api/bookings` → `201 { status: "pending", requestExpiresAt: "2026-09-11T16:44:41Z" }`
  puis `GET /mes-reservations` → aucune occurrence de « expire / expiration / délai » dans la page.
- `grep -rn requestExpiresAt src/app src/components` → **0 résultat** : le champ existe côté
  API, jamais côté UI.
- `expireManualBookingRequests()` (`src/app/api/cron/price-alerts/route.ts:153-217`) écrit
  `status:"cancelled"`, `cancellationReason:"Demande de réservation expirée automatiquement…"`
  **sans** `enqueueEmail` (le seul envoi du cron est l'alerte de prix, l. 306-320).
- Le tableau de bord calcule déjà le bon indicateur et ne l'affiche pas :
  `src/app/dashboard/page.tsx:84` (`pending: allBookings.filter(...)`) n'est lu nulle part
  (seule la carte « hébergements à valider » existe, réservée à l'admin, l. 299-322).

**Impact.** Le voyageur croit sa demande en cours ; l'hôte peut ne pas voir qu'un délai court ;
au bout de 24 h la réservation disparaît de son onglet « En cours » sans explication. Pendant
ce temps la chambre reste bloquée (comportement anti-surbooking voulu) — donc un hôte inattentif
perd la vente **et** bloque son calendrier. C'est le trou le plus coûteux du parcours actuel.

**Solution non régressive.**
1. **Affichage de l'échéance** (aucune route nouvelle) : `/mes-reservations` (carte de la demande)
   et la colonne Statut + fiche de `/dashboard/bookings` reçoivent déjà le champ par l'API ;
   afficher « Expire le JJ/MM à HH:mm » (ou « dans X h »).
2. **Carte « Demandes à traiter »** sur `/dashboard` (hôte et admin) alimentée par
   `stats.bookings.pending` déjà calculé, avec lien `/dashboard/bookings?status=pending`.
3. **E-mail d'expiration** au voyageur (et une copie informative à l'hôte) dans
   `expireManualBookingRequests()`, `eventKey` déterministe
   (`booking-request-expired:<bookingId>` → idempotent, cron relançable), en respectant le
   réglage `notifications` (voir A3) avec repli `true`.
4. Option (second temps) : relance à mi-délai (`booking-request-reminder:<id>`) — même patron.

**Garde-fous.** Ne pas toucher au TTL, au calcul d'occupation ni à `transactionError` :
`pending` continue de bloquer le stock et l'annulation automatique reste `system`.
Tests : extension de `src/app/api/cron/price-alerts/route.test.ts` (existant) pour l'e-mail
idempotent, test unitaire du texte d'échéance (pattern « sans DOM » comme
`booking-status-select.test.tsx`), i18n FR/EN (≈8 clés).

---

### A2 — Les séjours échus non réglés sortent du radar

**Constat.** Sans paiement plateforme, la seule façon d'enregistrer un règlement est le geste
manuel de l'hôte (« Constater le paiement sur place », `markPaidOffline`). Ce geste conditionne
l'ensemble de la chaîne : clôture du séjour, fidélité, invitation d'avis, facture, chiffre
d'affaires. Or rien ne signale les séjours terminés qui attendent ce geste.

**Preuves.**
- La clôture est explicitement refusée sans règlement : `PUT /api/bookings/[id]` →
  `409` si `paymentStatus !== "paid"` (`src/app/api/bookings/[id]/route.ts:211, 230, 255, 260`).
- Le bouton de constatation n'existe que sur la **fiche** réservation
  (`src/components/booking-row-actions.tsx:220-250`, rendu par
  `src/app/dashboard/bookings/[id]/page.tsx:387-396`) : la liste `/dashboard/bookings` n'a ni
  colonne « Règlement » ni filtre correspondant (`src/components/bulk/bookings-manager.tsx:210-217` ;
  la l. 344 n'affiche qu'un marqueur quand c'est déjà payé).
- Aucune vue de rattrapage : `grep -in "unpaid|à régler|encaiss"` ne remonte que des textes
  explicatifs (`src/app/dashboard/billing/page.tsx:342`, `inv.unpaidNote`) — aucun écran, aucun compteur.
- Conséquences en cascade vérifiées dans le code : analytics et billing ne comptent que
  `paymentStatus = "paid"` (`src/app/dashboard/analytics/page.tsx:88`,
  `src/app/dashboard/billing/page.tsx:39`), les invitations d'avis ne visent que les séjours
  `completed` (`sendReviewRequests`, cron), la facture fiscale est bloquée sur `unpaid`
  (`src/lib/invoice.ts:123-126`), la fidélité n'est versée qu'à la clôture
  (`loyaltyAwardedAt`, `route.ts:264-291`).

**Impact.** Un hôte qui oublie de constater un règlement gèle : son CA affiché (0 € pour ce
séjour), les points du voyageur, l'invitation d'avis, la facture et les statistiques. Rien dans
l'interface ne lui dit qu'il a « une action en attente », et l'admin n'a aucun contre-regard.

**Solution non régressive.**
1. **Filtre/vue « À constater »** dans `/dashboard/bookings` : `paymentStatus = pending` **et**
   date de départ ≤ aujourd'hui (les données sont déjà chargées par la page serveur — zéro route
   nouvelle), plus une colonne « Règlement » (payé / à constater).
2. **Action de ligne** : réutiliser `BookingRowActions` (`canManageStay` existe déjà) dans la
   liste, plutôt que d'obliger à ouvrir chaque fiche.
3. **Rappel à l'hôte** J+1 après le départ (`booking-payment-reminder:<id>`, idempotent,
   conditionné par `notifications`), et compteur d'anomalies pour l'admin sur `/dashboard`.
4. Aucune modification de la règle métier : le `409` reste, la constatation reste manuelle,
   tracée et auditée.

**Garde-fous.** Les transitions restent dérivées de `transitionError()` ; ne pas compter les
séjours non constatés dans le CA (pas de fausse promesse de revenu). Tests : intégration du
filtre (2 cas : départ passé/futur), e-mail idempotent, rendu de la colonne.

---

### A3 — Les interrupteurs d'e-mails existent en base mais pas dans l'interface

**Constat.** Le réglage `notifications` comporte 7 booléens consommés par du code réel
(accueil, confirmation de réservation, rappels J3/J1, demande d'avis, alertes de prix,
newsletter) — mais **aucune section** du panneau admin ne les expose.

**Preuves.**
- Schéma et défauts : `src/lib/settings.ts:128-136` (`welcomeEmail`, `bookingConfirmation`,
  `bookingReminderJ3`, `bookingReminderJ1`, `reviewRequest`, `priceAlerts`, `newsletter` —
  tous `true` sauf `newsletter`).
- Consommateurs réels : `src/app/api/auth/verify/route.ts:36` (bienvenue),
  `src/lib/booking-confirmation.ts:23` (confirmation), `src/lib/booking-lifecycle-emails.ts:40-43`
  (rappels), cron (demandes d'avis + alertes de prix).
- `grep -c "notifications" src/components/admin/settings-panel.tsx` → **0**. Le panneau rend
  `general, billing, bestrewards, cancellation, security, reviews, emailTemplates, providers`
  uniquement.
- `newsletter` n'est lu par **aucun** fichier de `src/` (hors schéma) : flag mort.

**Impact.** Impossible de désactiver un envoi (ex. rappels pendant une migration, période de
calme) sans SQL ; à l'inverse, `newsletter` laisse croire qu'une fonctionnalité marketing existe.
Ces réglages ont été pensés, codés, testés côté lecture… mais jamais exposés.

**Solution non régressive.** Ajouter une section `NotificationsSection` sur le modèle exact de
`ReviewsSection` (`saveSection("notifications", v, …)`, `StatusPill`), avec une phrase
explicative par envoi. Pour `newsletter` : soit la retirer du schéma (les valeurs stockées
restent tolérées par `mergeDefaults`), soit l'assumer « sans effet » ; ne pas laisser un
interrupteur qui ne pilote rien. Rappeler dans l'aide que `getSetting` est mis en cache 60 s
(`src/lib/settings.ts`, TTL) : l'effet n'est pas instantané, ce qui doit être écrit noir sur blanc.

**Garde-fous.** Défauts inchangés, aucun envoi modifié, aucune migration. Tests : `settings.test.ts`
(déjà présent) + un test de rendu de la section ; i18n FR/EN (≈14 clés).

---

### A4 — Le parrainage se règle en base, pas dans l'interface

**Constat.** Le programme de parrainage est visible côté utilisateur (`ReferralCard` dans
l'onglet BestRewards de `/mon-compte`, `GET /api/users/me/referral`) et crédite effectivement le
portefeuille, mais ses paramètres (`enabled`, `referrerAmount`, `refereeAmount`) n'ont **aucune
surface d'administration**.

**Preuves.**
- `src/lib/settings.ts:85-105` : `referralSchema` est imbriqué dans `bestrewards` (clé de
  réglage `bestrewards`), donc modifiable par API… mais `BestrewardsSection`
  (`src/components/admin/settings-panel.tsx:289-375`) ne rend que les seuils et les remises ;
  les libellés `settings.*` du parrainage n'existent pas dans le catalogue i18n.
- Le BACKLOG (T-125) annonce pourtant « réglable `bestrewards.referral` ».

**Impact.** Impossible de désactiver le programme ou d'ajuster les montants (10 € / 5 € par
défaut) sans SQL : engagement financier non pilotable, écart entre la documentation et le
produit.

**Solution non régressive.** Ajouter à la section BestRewards : interrupteur « Programme de
parrainage actif » + deux champs numériques (bornes 0-1000 déjà portées par le zod), envoyés
avec le reste de l'objet `bestrewards` (donc aucune régression sur les seuils/remises), et une
phrase d'effet (« crédité au parrain et au filleul au premier séjour terminé »). Vérifier que la
`ReferralCard` reflète immédiatement les montants (elle lit `/api/users/me/referral`).

**Garde-fous.** `mergeDefaults` tolère l'absence des champs ⇒ pas de migration ; un programme
désactivé doit continuer à ne rien créditer (`calculateReferralReward` renvoie 0, test existant).
Tests : PATCH intégration + affichage.

---

### A5 — Les avis ne préviennent personne

**Constat.** Le cycle de vie d'un avis est complet (dépôt, modération, réponse de l'hôte,
votes « utile ») mais **aucun e-mail** n'en accompagne les étapes : ni l'hôte à la publication,
ni l'auteur quand son avis est approuvé ou rejeté.

**Preuves.** `grep -rn enqueueEmail src/app/api/reviews` → **0**. Le seul envoi lié aux avis est
l'**invitation** (`sendReviewRequests`, appelé par le cron). `PATCH /api/reviews/[id]/moderate`
change le statut sans notification ; avec `reviews.requireModeration = true` (section admin
livrée en T-217/P3), un avis rejeté disparaît sans que son auteur le sache.

**Impact.** L'hôte découvre les avis par hasard (ou jamais) ; l'auteur d'un avis modéré vit une
censure silencieuse ; la modération peut dégrader la confiance faute d'explication.

**Solution non régressive.** Deux envois optionnels, même patron outbox que les autres
(`eventKey` déterministe, `best-effort`, non bloquant) :
`review-published:<reviewId>` vers l'hôte, `review-moderated:<reviewId>:<status>` vers l'auteur.
Les brancher sur deux nouveaux booléens `notifications.reviewPublished` / `reviewModerated`
(exposés par A3) et laisser le silence par défaut si faux. Aucun changement de statut, de
visibilité ou d'agrégat (`review-aggregates.ts` inchangé).

**Garde-fous.** Ne jamais bloquer la transaction de modération (envoi après commit, comme
`booking-request-notification.ts`). Tests : fichier `review-mail.test.ts` calqué sur
`price-alert-mail.test.ts`. i18n (≈10 clés).

---

### A6 — Une chambre créée riche peut ne plus jamais être corrigée

**Constat.** Le formulaire de création d'une chambre demande type, description, surface,
devise, alors que l'édition se limite au nom, au prix, aux quantités/capacités et à
l'activation. Une fois créée, une chambre ne peut plus être corrigée sur ces champs.

**Preuves.**
- API : `PUT /api/rooms/[id]` accepte `name, description, roomType, bedConfiguration,
  maxOccupancy, maxAdults, maxChildren, sizeSqm, quantity, basePrice, currency, amenities,
  images, isActive` (`src/app/api/rooms/[id]/route.ts:14-30`).
- UI : `src/components/room-edit-section.tsx:18` n'envoie que
  `name, basePrice, quantity, maxOccupancy, maxAdults, maxChildren, isActive` ; le composant fait
  42 lignes contre 208 pour `new-room-form.tsx`.

**Impact.** Une description erronée, un type mal choisi, une mauvaise devise ou une
configuration de lits inadaptée sont **définitifs** — le voyageur lit des informations fausses
et l'hôte n'a aucun recours à part supprimer/recréer la chambre (avec le risque de perdre
l'historique de réservations attaché).

**Solution non régressive.** Compléter `RoomEditSection` avec les champs manquants, en
réutilisant les contrôles de `new-room-form.tsx` ; devise verrouillée (lecture seule) dès qu'une
réservation existe sur la chambre, avec message explicite ; ne rien changer aux valeurs par
défaut ni au PUT partiel (tous les champs restent `.optional()`, un formulaire qui n'envoie pas
un champ ne l'écrase pas).

**Garde-fous.** Test d'intégration « PUT partiel ne vide pas les champs absents » (existant ou à
ajouter), test de rendu de la section, i18n (≈10 clés déjà présentes pour la création).

---

### A7 — Les horaires d'arrivée/départ sont annoncés mais pas modifiables

**Constat.** La fiche publique affiche « Arrivée : 14:00 - 23:00 » et « Départ avant 11:00 ».
Ces trois valeurs existent en base avec ces défauts, mais **aucune** interface ni route ne
permet à l'hôte de les changer ; le fusesau horaire de l'hébergement n'est pas exposé non plus.

**Preuves.**
- `src/db/schema.ts:214-216` (`check_in_from`, `check_in_until`, `check_out_until`, défauts
  14:00 / 23:00 / 11:00).
- Affichage : `src/app/(main)/hebergement/[slug]/page.tsx:603-607`, avec repli codé en dur.
- API : `propertySchema` (`src/app/api/properties/route.ts:16-33`) et le PUT
  (`src/app/api/properties/[id]/route.ts:19-39`) n'acceptent pas ces champs ; les formulaires de
  création/édition ne les proposent pas.

**Impact.** L'hôte annonce des horaires qu'il n'a pas choisis (nettoyage, gardien, remise de
clés, arrivée tardive) : source directe de litiges sur place, et obligation pour lui de
contredire sa propre fiche.

**Solution non régressive.** Ajouter les trois champs (`HH:MM`, validation
`checkInFrom < checkInUntil`, plage 00:00-23:59) à `POST /api/properties` et
`PUT /api/properties/[id]`, les afficher dans l'onglet « Infos générales » de
`property-edit-client.tsx` et dans `properties/new` ; conserver les replis actuels quand les
valeurs sont nulles. `timezone` peut être ajouté dans le même lot (liste fermée + affichage).
**Aucune migration** : les colonnes existent.

**Garde-fous.** Champs `.optional()` (un client existant qui ne les envoie pas continue de
passer), aucun impact sur la recherche ni le tunnel. Tests : zod (format + ordre), intégration
PUT, rendu.

---

### A8 — Des badges de confiance que personne ne peut administrer (dont un inatteignable)

**Constat.** Trois drapeaux d'hébergement ont un effet visible — voire commercial — mais aucun
n'est écrit par une API ou une UI.

**Preuves.**
- `isEcoCertified` (`src/db/schema.ts:222`) est **lu** par la fiche
  (`(main)/hebergement/[slug]/page.tsx:301` → badge « 🌱 Éco », libellé `badge.eco`) et par la
  carte (`src/components/property-card-client.tsx:169`), mais n'est **écrit nulle part** dans
  `src/` (hors schéma) : le badge est inatteignable par construction.
- `isBestrewards` et `isPreferred` ne sont écrits que par le **seed**, aléatoirement
  (`src/app/api/seed/route.ts:293-294` : `Math.random()`), alors que `isBestrewards` change le
  prix (remise BestRewards majorée de 2 points à partir du niveau 2 :
  `src/app/api/bookings/route.ts:312`, `src/app/api/bookings/quote/route.ts:171`).
- `PUT /api/properties/[id]` n'accepte pas ces champs (`route.ts:19-39`).

**Impact.** Une décision commerciale (remise supplémentaire, mise en avant) dépend d'un tirage
aléatoire de données de démonstration ; un badge de confiance peut être affiché sans aucun
contrôle — et « Éco » est une promesse que le produit ne peut pas tenir.

**Solution non régressive.** Décider explicitement, puis :
1. exposer dans `/dashboard/properties/[id]` (admin) un bloc « Mise en avant & labels » pour
   `isBestrewards` / `isPreferred` / `isEcoCertified`, avec `recordAudit("property.label.update")`
   et envoi de l'e-mail/notification interne si un label change la remise ;
2. tant que « Éco » n'a pas de critère vérifiable, retirer le badge de la fiche et de la carte
   (le champ reste en base, `false` par défaut) ;
3. garder l'aléatoire du seed strictement en dev (déjà le cas — à confirmer par un test).

**Garde-fous.** Ne pas toucher au calcul de remise (le flag le pilote déjà) ; tout changement de
label doit être tracé. Tests : `properties/[id]/route.test.ts` (existant) étendu, rendu conditionnel.

---

### A9 — « Écrire à l'hébergeur » depuis le back-office : mauvais libellé, action impossible pour l'admin

**Constat.** La fiche réservation du tableau de bord rend le même composant d'actions que
l'espace voyageur, avec le libellé du voyageur. Pour l'hôte, le bouton écrit en réalité **au
voyageur** ; pour l'admin, il échoue systématiquement.

**Preuves.**
- `src/components/booking-row-actions.tsx:190-206` : libellé `book.writeHost`
  (« Écrire à l'hébergeur » / « Message the host », `ui-strings.ts:1328`) ; rendu côté
  back-office par `src/app/dashboard/bookings/[id]/page.tsx:387-396` (`canManageStay`).
- `POST /api/conversations` (`src/app/api/conversations/route.ts:53-60`) : l'hôte devient
  participant à la place du voyageur ; un admin qui n'est ni l'hôte ni le voyageur reçoit
  **403 « Réservation invalide »**. Vérifié en direct : admin **403**, hôte **201**,
  voyageur **201**.

**Impact.** L'hôte croit s'écrire à lui-même ; l'admin voit un bouton qui échoue avec un message
qui ressemble à une donnée corrompue (faux bug remonté au support).

**Solution non régressive.** Libellé dépendant de l'acteur (`book.writeGuest` pour hôte/admin,
`book.writeHost` pour le voyageur — le composant connaît déjà `messageArea`/`canManageStay`) ;
puis décision explicite sur l'admin : soit l'autoriser (rôle support, en le traitant comme
l'hôte dans la résolution du participant), soit masquer le bouton. Dans les deux cas, écrire la
règle dans le code (commentaire + test) plutôt que de la laisser implicite.

**Garde-fous.** Le contrôle d'accès actuel (un voyageur ne peut pas ouvrir le fil d'un autre)
reste inchangé ; test API 403/201 pour les trois rôles ; i18n (1-2 clés).

---

### A10 — Suspension et suppression partagent la même colonne : un compte effacé peut être « réactivé »

**Constat.** La suspension écrit `deleted_at` (exactement comme une suppression), la
suppression y ajoute une anonymisation RGPD. L'interface admin ne connaît qu'un état
(« Suspendu ») avec un bouton « Réactiver » — y compris sur les comptes supprimés.

**Preuves.**
- Suspension : `src/app/api/users/[id]/suspend/route.ts:47-52`
  (`deletedAt: suspended ? new Date() : null`).
- Suppression (anonymisation) : `src/app/api/users/me/route.ts:169-186`
  (`email → deleted-<sha256>@anonymized.local`, `firstName "Supprimé"`, sessions détruites).
- UI : `src/components/bulk/users-manager.tsx:85-87, 250-260, 357-360` (filtre « Suspendu » =
  `deletedAt`, badge) et `src/components/admin/user-suspend-actions.tsx` (« Réactiver »).
- **Sonde de bout en bout** : compte créé → auto-suppression → ligne
  `deleted-a24b8b10ff4403f2@anonymized.local` / « Supprimé Compte » → clic admin « Réactiver »
  → **200**, `deleted_at = null`, email anonymisé conservé : la personne ne peut plus se
  connecter et l'effacement est annulé de fait.

**Impact.** (1) Une demande d'effacement peut être « défaite » par un clic non averti ;
(2) l'admin ne distingue pas supprimé / suspendu, donc ne sait pas ce que fait son bouton ;
(3) la suspension n'est notifiée à personne : l'utilisateur est déconnecté et ne l'apprend
qu'en tentant de se reconnecter (401 « Ce compte est désactivé. Contactez le support », message
correct, mais aucune information proactive).

**Solution non régressive.** Colonne dédiée `suspended_at` (+ `suspension_reason` optionnel) —
migration additive, `deleted_at` restant réservé à la suppression :
- suspension : `suspended_at = now`, `deleted_at` **inchangé** ; connexion refusée si
  `suspended_at` ou `deleted_at` est non nul (même protection qu'aujourd'hui) ;
- UI : deux états distincts (« Supprimé — irréversible » sans bouton, « Suspendu » avec
  « Réactiver ») ;
- API : `PATCH …/suspend { suspended:false }` sur un compte anonymisé → **409** explicite ;
- e-mail facultatif « votre compte est suspendu » (respectant A3) et e-mail
  « réinitialisation » si la réactivation est un jour outillée sur un compte actif.
Compatibilité : les comptes déjà suspendus (aujourd'hui `deleted_at` seul) doivent être migrés
vers `suspended_at` par la même migration, avec un critère non ambigu (email non anonymisé).

**Garde-fous.** Ne pas modifier les requêtes d'authentification sans test : suite d'intégration
« suspend → 401 avec message », « delete → réactivation 409 », « compte suspendu antérieur →
traité comme suspendu ». Le bulk admin (anonymize) reste inchangé. i18n (≈6 clés).

---

### A11 — Perdre son téléphone avec la 2FA active = compte définitivement perdu

**Constat.** La 2FA TOTP est complète (activation, QR, vérification, désactivation) mais la
désactivation exige un **code TOTP courant**, et il n'existe ni codes de secours, ni action
administrateur pour réinitialiser la 2FA d'un compte actif.

**Preuves.**
- `src/components/two-factor-section.tsx:64-68` : `disable()` refuse sans mot de passe **et**
  code à 6 chiffres.
- `grep -rni "recovery|backupCode|codes de secours"` → aucun résultat côté 2FA (seul un
  « payment-intents recovery » sans rapport).
- Le seul endroit qui remet `twoFactorEnabled = false` est l'action bulk **anonymize**
  (`src/app/api/admin/bulk/route.ts:139-148`) : aucune aide possible sans supprimer le compte.
- Les endpoints admin existants (`PATCH /api/users/[id]/suspend`, bulk `users` : suspend /
  reactivate / anonymize) n'offrent pas ce geste.

**Impact.** Impasses réelles : le voyageur ne peut plus accéder à ses réservations, l'hôte à
son tableau de bord, et le support n'a aucune action sûre et traçable — la seule issue est
l'anonymisation (perte de compte).

**Solution non régressive.**
1. **Codes de secours** à l'activation : 10 codes à usage unique, stockés hachés
   (`two_factor_recovery_codes`), affichés une seule fois, vérifiables à la place du TOTP.
2. **Action admin « Réinitialiser la 2FA »** : bouton sur la fiche utilisateur
   (ou à défaut l'action bulk `users`), confirmation par saisie de l'e-mail cible,
   `recordAudit("user.2fa.reset")`, révocation des sessions et e-mail d'information à
   l'utilisateur (« votre 2FA a été réinitialisée, reconnectez-vous »).
3. Rappel d'aide à l'activation (« si vous perdez votre téléphone, utilisez un code de secours
   ou contactez le support »).

**Garde-fous.** La connexion reste impossible sans mot de passe ; la réinitialisation est
refusée pour un compte anonymisé ; les codes de secours sont à usage unique
(consommation transactionnelle). Tests : unitaires (génération/format/consommation unique),
intégration (login via code de secours, reset admin → login mot de passe), i18n (≈10 clés).

---

## 4. Observations secondaires (à trancher mais non bloquantes)

| # | Observation | Recommandation |
|---|---|---|
| O1 | **Portefeuille sans journal** : `users.wallet_balance` est un solde mutable alimenté par la fidélité, le parrainage et les remboursements, sans table de transactions ; aucun moyen de le débiter ni de l'ajuster manuellement (aucun écran admin). Les libellés sont aujourd'hui honnêtes (« aucune déduction »). | Trancher : soit réintroduire une consommation (avoir à déduire lors du règlement sur place) avec un journal `wallet_transactions`, soit geler le programme explicitement. Dans les deux cas, un historique par utilisateur est nécessaire au support. |
| O2 | **Calendrier sans réservations** : `availability-calendar.tsx` gère stock, prix, min-stay et stop-sell, mais n'affiche jamais les séjours déjà réservés sur les dates. | Ajouter une colonne informative (lecture seule) avec les références des réservations couvrant la date. |
| O3 | **Aucune vue des e-mails sortants** (`email_outbox`) alors que le cron les retente : statuts `pending` / `failed` / `sent` invisibles. | Onglet « E-mails » en lecture seule (filtre statut, `lastError`), sans action de renvoi dans un premier temps. |
| O4 | **Un avis publié n'est ni modifiable ni supprimable par son auteur** (aucune route) ; seul l'admin peut masquer. | Décider : fenêtre d'édition de 48 h, ou « signaler », ou statu quo documenté. |
| O5 | **Pas de fiche utilisateur admin** : `/dashboard/users` n'offre ni vue 360° (réservations, portefeuille, audit) ni recherche par référence de réservation. | Fiche `/dashboard/users/[id]` en lecture seule, alimentée par les données existantes. |
| O6 | `/dashboard/analytics` n'a pas d'export alors que `/dashboard/billing` en a deux. | Export CSV analytics (mêmes garde-fous que `billingCsv.*`, 500 lignes max). |

---

## 5. Ce qui a été vérifié et va bien (pour éviter de « corriger » l'existant)

- **Liens et routes** : 261 liens internes suivis par rôle, **0 cassé** ; aucune page fantôme ;
  aucune action de bouton sans endpoint (règle R15 du framework `ai:check` le vérifie aussi).
- **Cycle de vie des réservations** : transitions dérivées d'une source unique
  (`transitionError`) côté API **et** UI, verrous transactionnels, audit, remboursements et
  cumul fidélité cohérents ; le tunnel est passé à un flux « demande → confirmation → règlement
  sur place » de façon homogène (T-207).
- **Annulation** : l'aperçu (`GET /api/bookings/[id]/cancellation`) et l'application
  (`booking-cancellation.ts`) utilisent la même fonction de calcul — pas d'écart possible entre
  le devis annoncé et les frais appliqués.
- **Recherche** : filtres ville/dates/voyageurs/type/pays/équipement/tri, pagination, bandeau
  d'avertissement sur paramètres incohérents, état vide — complet.
- **Réglages** : général, facturation (mentions légales + préfixe de facture), BestRewards
  (seuils/remises), grille d'annulation, sécurité, avis, modèles d'e-mails, fournisseurs :
  chaque section enregistre réellement (PATCH vérifié).
- **Modération, messagerie, wishlists, alertes de prix, 2FA (hors secours), facture HTML** :
  surface et API alignées ; la fenêtre de 7 jours des fils sans message (P7/T-217) fonctionne.

---

## 6. Ordre de mise en œuvre proposé (sans régression)

1. **A1 + A2** (parcours demande → règlement) : le plus visible pour hôte et voyageur, purement
   additif (affichage + filtres + e-mails idempotents).
2. **A6 + A7 + A8** (cohérence fiche ↔ chambre ↔ labels) : l'information publiée redevient
   contrôlable par son propriétaire.
3. **A3 + A4** (pilotage) : rend éditables des réglages déjà lus par le code ; débloque les
   interrupteurs utilisés par A1/A2/A5/A10.
4. **A5 + A9 + A10 + A11** (confiance et support) : notifications d'avis, libellé du fil,
   distinction supprimé/suspendu, secours 2FA — les quatre touchent la relation de confiance
   avec les utilisateurs.
5. **Observations O1–O6** sur les créneaux suivants.

Chaque tâche : une migration additive maximum, aucune modification de règle métier existante,
tests unitaires + intégration, i18n FR/EN, mise à jour `.ai/*` et passage complet des portes
(`typecheck`, `lint`, `i18n:check`, `vitest`, `build`, `smoke`, `ai:check`).
