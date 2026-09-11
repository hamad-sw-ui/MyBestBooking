# Analyse runtime n°7 — fins de parcours : constats C1 → C6

> Demande du 2026-09-11 (après clôture complète de l'audit n°6, B1 → B12) :
> *« analyse profonde des scénarios et éléments fonctionnels du projet à
> l'exécution (pages, boutons, fonctionnalités…) inachevés et/ou mal pensés ;
> expliquer le problème et donner leurs solutions sans régression »*.
>
> **Cette passe n'a modifié aucune ligne de code applicatif** : constats,
> preuves d'exécution et solutions non régressives uniquement. Audits
> précédents : n°6 `docs/analyse_2026-09-11_audit_runtime_inacheves_mal_penses.md`
> (B1 → B12, soldé) et n°5 `docs/analyse_2026-09-11_audit_runtime_execution.md`
> (A1 → A8, soldé).
>
> Contexte : branche `arena/01a0913d-mybestbooking`, HEAD `1ad5f2d`
> (documentation d'audit n°6), CI de référence verte (148 fichiers / 803 tests,
> build 67 pages, smoke 95/95).

## 1. Objet et méthode

Objectif : après six passes, trouver ce qui reste **à l'exécution** inachevé ou
trompeur — en rejouant les parcours métier de bout en bout **avec des données
fraîchement seedées** (base neuve, seed complet, 3 rôles + 1 compte invité
créé pendant la passe) plutôt qu'en re-lecture statique seule.

| Moyen | Détail |
|---|---|
| Environnement | PostgreSQL embarqué neuf (55432) + `db:push` + `POST /api/seed` + `npm run dev` (Turbopack) |
| Rôles | `admin@` / `host@` / `customer@` (démo) + `sophie.petit@` + 1 **compte invité créé puis réclamé** pendant la passe |
| Balayage | 46 pages × 4 rôles (anonyme, admin, hôte, voyageur) avec routes dynamiques réelles ; **0 erreur applicative** ; 78 liens internes du dashboard sondés → **tous résolus** |
| Parcours rejoués | cycle de vie complet d'une demande (création → confirmation → paiement sur place → facture → annulation avec devis → clôture → avis), expiration par cron, alerte prix (création → notification → idempotence), avis (dépôt → agrégats → réponse hôte → modération admin → vote utile), 2FA (setup → login TOTP → code erroné → désactivation), claim invité (e-mail → mot de passe → token consommé), validation d'annonce (hôte 403 / admin → e-mail), suspension de compte (login bloqué → réactivation), favoris (création → partage → déplacement atomique → suppression), promotions (création → aperçu → application → compteur) |
| Scénario d'exception rejoué | **demande pending confirmée après suspension de l'annonce** (constat C1) ; **annulation d'un paiement sur place** (constat C2) |
| Confrontations | schéma `bookings` ↔ timeline dashboard ; `placeholder-property.jpg` ↔ fichiers du seed ; `email_verified` ↔ flux claim ; fenêtre de liste `/messages` (voyageur) ↔ contrat T-245/T-257 (9 écrans) |
| Hygiène | `npm run i18n:check` (warn-only, 6 candidats pré-existants) ; cookies de session (`httpOnly` + `secure` en prod + `sameSite=lax`) |
| État final | base rendue à l'état seed (`scripts/reset_test_db.mjs` + purge des artefacts de test), serveur de développement relancé |

## 2. Synthèse des constats

| # | Constat | Type | Sévérité | Vérifié |
|---|---|---|---|---|
| **C1** | Une demande `pending` peut être **confirmée après suspension de l'annonce** (ou désactivation de la chambre) : la transition ne re-vérifie ni le statut du bien, ni l'état du hôte, ni `rooms.isActive` — le voyageur finit avec un séjour confirmé sur une fiche publique en **404** | Mal pensé (intégrité) | **Haute** | runtime + code |
| **C2** | Annulation d'une réservation **payée hors plateforme** : `refundStatus` passe à `pending` et y reste **définitivement** — l'écran affiche « Remboursement : X € **en cours** » sans fin (aucun PSP, aucune action hôte pour le conclure) | Inachevé | Moyenne | runtime + code |
| **C3** | Une annonce **sans photo** sert `placeholder-property.jpg`, qui est une **copie réelle de `villa-azure-1.jpg`** : la fiche, la galerie (4 slots) et la carte montrent la photo **d'une autre propriété** comme la sienne | Mal pensé (confiance) | Moyenne | fichiers + code |
| **C4** | Le **claim invité** prouve la maîtrise de la boîte mail (lien reçu dedans), mais le compte reste `emailVerified = false` : le bouton « renvoyer la vérification » s'affiche dans /mon-compte juste après un claim réussi | Inachevé | Faible | runtime + code |
| **C5** | Timeline de la fiche réservation (dashboard) : l'étape « Réservation confirmée » porte la date de `updated_at` — la colonne **`confirmed_at` n'existe pas** ; après tout update suivant (paiement constaté, annulation…) la date affichée **dérive** | Inachevé (données) | Faible | schéma + code |
| **C6** | Boîte de réception voyageur `/messages` : **une requête par conversation** (dernier message, `Promise.all`) et **aucune fenêtre** `parsePageWindow`/`ShowMore` — alors que le contrat T-245/T-257 couvre les **9 autres** écrans de liste (dont `/dashboard/messages`) | Inachevé (cohérence/perf) | Faible | code |

Les 6 constats sont **des finitions de fin de parcours**, jamais des pannes :
aucun page ne renvoie d'erreur, aucun bouton n'est mort, aucun texte n'est en
dur (§ 4).

## 3. Constats détaillés et solutions non régressives

### C1 — Confirmer une demande sur une annonce suspendue (ou une chambre désactivée)

**Constat.** La transition `pending → confirmed` de `PUT /api/bookings/[id]`
n'est validée que par `transitionError()` (`src/lib/booking-lifecycle.ts` :
statut, acteur, date de départ) — puis le bloc « confirmed »
(`src/app/api/bookings/[id]/route.ts:227`) ne nettoie que les champs paiement.
**Aucune relecture** de `properties.status`, de `users.suspendedAt/deletedAt` ni
de `rooms.isActive` n'a lieu au moment de la confirmation, alors que
`POST /api/bookings` les vérifie à la **création** (route.ts : « hébergement
non disponible » / « chambre non disponible », T-233).

**Preuve d'exécution (base seed, rejoué).**
1. Demande `pending` créée sur `riad-jardin-secret` (MBB-2026-6V8I7T) ;
2. `POST /api/properties/…/validate {action:"suspend"}` (admin) → bien `suspended`, **fiche publique en 404** (vérifié : `GET /hebergement/riad-jardin-secret` → 404) ;
3. `PUT /api/bookings/… {status:"confirmed"}` (hôte) → **200, `status: "confirmed"`**.

Le voyageur reçoit l'e-mail « Réservation confirmée » et conserve le lien
« Voir l'hébergement » vers une page morte. Le même vide s'applique à
`rooms.isActive = false` entre la demande et la confirmation, et de façon
défensive aux clôtures `completed`/`no_show` (qui ne re-vérifient que paiement
et date).

**Impact.** (a) la sanction admin est contournable par les demandes antérieures
— un séjour peut être confirmé et **réalisé** sur un bien retiré (motif sécurité
ou infraction) ; (b) incohérence d'affichage durable (fiche 404 vs réservation
confirmée) sur `/mes-reservations` et `/dashboard/bookings` ; (c) e-mail de
confirmation émis pour un bien que la plateforme a sanctionné.

**Solution non régressive.**

| Étape | Changement | Non-régression |
|---|---|---|
| 1 | Dans la branche « confirmed » (avant le commit), re-lire le bien + hôte + chambre (mêmes prédicats que `POST /api/bookings` : `status='active'`, pas de `suspendedAt`/`deletedAt`, `rooms.isActive`) ; au moindre écart → **409** avec message explicite | N'ajoute qu'un refus d'un état que la création refuse déjà ; une demande sur un bien sain se confirme exactement comme avant |
| 2 | Appliquer la même garde défensive aux transitions `completed`/`no_show` (bien toujours actif) | Additif ; aucune clôture saine n'est affectée |
| 3 | (option, décision produit) À la suspension par l'admin : notifier hôte **+** voyageurs des demandes `pending` (ou les annuler avec motif « annonce suspendue ») | Nécessite 1 gabarit FR/EN + un choix produit ; sans cela, les demandes survivent à la suspension sans être confirmables (étape 1) |
| 4 | Tests : demande pending + suspension → confirm 409 ; chambre désactivée → confirm 409 ; cas sain inchangé (200) | Interdit la réouverture |

### C2 — Remboursement hors plateforme « en cours » indéfiniment

**Constat.** `cancelBooking()` (`src/lib/booking-cancellation.ts:63,70`) pose
`refundStatus = "pending"` chaque fois que `paymentStatus === "paid"` et
`refundAmount > 0` — **y compris** pour un paiement constaté sur place
(`paymentMethodOffline = true`, aucun `paymentIntentId`). La réconciliation
`refundLateCapturedPayment()` (`src/lib/payment-events.ts:28`) est un **no-op**
sans intent PSP, et rien d'autre ne fait jamais passer `refundStatus` à
`"refunded"` : il n'y a ni PSP, ni action hôte « remboursement constaté ».
Le seul rendu de cet état est `/mes-reservations`
(`src/app/(main)/mes-reservations/page.tsx:299`) : « Remboursement : X €
**en cours** » (`bookings.refundPending`), à vie.

**Preuve d'exécution.** Réservation MBB-2026-MBWQ4R : confirmée →
`markPaidOffline` (314,07 €) → annulée par le voyageur → base :
`payment_status='paid'`, `payment_method='offline'`, `refund_status='pending'`,
`refund_amount='314.07'`. L'écran affiche depuis « Remboursement : 314,07 € en
cours ». L'e-mail d'annulation ne mentionne ni le montant ni la modalité de
remboursement (seuls les frais, `mail/strings.ts:186`).

**Impact.** État trompeur permanent pour le voyageur (aucun remboursement ne
« s'effectue » — c'est l'hôte qui doit le faire hors plateforme, sans aucune
indication à l'écran ni par e-mail) ; aucun suivi « à rembourser » côté hôte
non plus. Le cas PSP (quand il reviendra) fonctionne déjà : `pending` →
`refunded` via le cron — c'est le seul chemin hors plateforme qui est orphelin.

**Solution non régressive.**

| Étape | Changement | Non-régression |
|---|---|---|
| 1 | Dans `/mes-reservations` : quand `paymentMethodOffline` et `refundStatus='pending'`, afficher « Remboursement : X € — à traiter par l'hébergeur » au lieu de « en cours » (1-2 clés FR/EN) ; la base n'est pas touchée (`pending` reste le juste état : dû, non constaté) | Affichage seul ; le futur chemin PSP conserve « en cours » → « effectué » via le cron |
| 2 | E-mail d'annulation voyageur : ajouter une ligne montant + modalité (« sera traitée directement par l'hébergeur » en cas de paiement sur place) — variable conditionnelle dans le gabarit | Gabarit admin éditable ; défaut FR/EN mis à jour, rendu idem ailleurs |
| 3 | (option) Dashboard hôte : badge « Remboursement à traiter X » sur les lignes annulées `refundStatus='pending'` + `paymentMethodOffline` | Additif, zéro contrat modifié |
| 4 | (option, plus lourde, décision produit) Action hôte « Conserver le remboursement » → `refunded` + `refundedAt` + e-mail voyageur, fermant l'état de bout en bout | Aucune migration nécessaire (colonnes existantes) ; à n'ajouter que si le suivi des remboursements hors plateforme devient un critère produit |

### C3 — L'annonce sans photo emprunte la photo d'une autre propriété

**Constat.** `public/seed-images/placeholder-property.jpg` est **documentée
comme copie de `villa-azure-1.jpg`** (`src/lib/seed-images.ts:27` : «
placeholder d'attente — pourra être remplacé par un visuel dédié neutre »).
Elle est servie partout où une annonce n'a pas d'image : visuel principal et
**4 slots de galerie** de la fiche (`(main)/hebergement/[slug]/page.tsx:372,382`)
et carte de liste (`components/property-card-client.tsx:154`).

**Preuve.** `cmp`/registre : le fichier existe et l'alias est déclaré ; une
annonce créée sans photo (rejoué pendant la passe : « Audit N7 Test ») sert
cette image. Résultat : un voyageur voit **5 photographies de la Villa Azur**
présentées comme celles d'un autre hébergement — sur la fiche **et** dans les
résultats de recherche.

**Impact.** Faux visuel de confiance (photos « du bien » qui n'en sont pas),
risque de réclamation croisée entre hôtes, et incohérence avec le reste du
produit (tout le reste est conditionné aux vraies données : `mainImage &&`,
`images.length > 0 &&`).

**Solution non régressive (deux paliers, indépendants).**

| Étape | Changement | Non-régression |
|---|---|---|
| 1 | Remplacer le fichier par un **visuel neutre** (motif + logo, sans photo de bien réel) — simple swap de `public/seed-images/placeholder-property.jpg`, zéro code | Aucun consommateur modifié ; les 8 annonces seed ont leurs propres photos (aucun changement visible existant) |
| 2 | (recommandé) Fiche publique : si l'annonce n'a **aucune** image, ne pas servir les 4 slots de substitution — état vide « pas de photos » à la place | Condition purement additive (`images.length === 0` est déjà le cas du placeholder) ; la galerie existante n'est pas touchée |
| 3 | (option) Idem sur `PropertyCardClient` : garder le fallback image unique (c'est acceptable en carte) mais jamais la galerie | — |

### C4 — Le claim invité laisse le compte « email non vérifié »

**Constat.** La chaîne du profil invité prouve la maîtrise de la boîte mail :
l'e-mail de réclamation est **livré à l'adresse en question** et c'est le
destinataire qui clique. Pourtant la branche `claimGuest` de
`POST /api/auth/reset-password` (`src/app/api/auth/reset-password/route.ts:33`)
ne pose que `passwordHash` (+ session) — `emailVerified` reste `false`
(vérifié en base après claim : `email_verified = false`). Conséquence visible :
`ResendVerificationButton` s'affiche dans `/mon-compte`
(`account-client.tsx:190`) juste après un claim réussi, et renvoie un e-mail de
vérification dont le lien — cliqué — ne ferait que poser `emailVerified = true`
(`api/auth/verify/route.ts`), en consommant au passage le quota 5/h.

**Preuve d'exécution.** Réservation invité (`guest.audit7@example.com`) → e-mail
de claim → mot de passe posé via le lien → login OK — `email_verified` toujours
`false`, bouton « renvoyer la vérification » affiché.

**Impact.** Petit, mais réel : un état qui ne peut pas avoir de sens pour ce
compte (la preuve a été faite par définition du flux), un e-mail redondant
possible, et une incohérence avec le reste du produit où « vérifié » =
« la plateforme a prouvé que l'utilisateur contrôle la boîte ».

**Solution non régressive.**

| Étape | Changement | Non-régression |
|---|---|---|
| 1 | Dans la branche `claimGuest` : poser aussi `emailVerified: true` (avec `updatedAt`), même transaction que le mot de passe | Ne touche que le flux claim ; l'inscription classique reste `false` jusqu'au lien de vérification ; la garde `POST /api/bookings` (profil invité sans mot de passe) est inchangée |
| 2 | Test : claim → `emailVerified = true` ; ré-assertion du flux registration (reste `false` avant le lien) | Interdit la régression dans les deux sens |

### C5 — La date de confirmation de la timeline dérive

**Constat.** L'étape « Réservation confirmée » de la timeline
(`src/app/dashboard/bookings/[id]/page.tsx:114`) porte
`booking.updatedAt ?? booking.createdAt`. La table `bookings` a `confirmed_by`
mais **pas `confirmed_at`** (`src/db/schema.ts:382` — alors que `cancelledAt`,
`loyaltyAwardedAt`, `refundedAt` existent). Après **tout** update postérieur
(« paiement sur place », annulation, même un `touch`), la timeline affiche la
dernière mise à jour comme date de confirmation.

**Preuve.** Code + schéma (aucune colonne de date de confirmation) ; scénario
rejoué : confirmation 16:24 → `markPaidOffline` 16:24:44 → la timeline
afficherait la date du mark-paid.

**Impact.** Histoire exacte de la réservation dégradée (l'admin/hôte lit une
date fausse dans l'outil de suivi) ; le reste de la timeline (« créée »,
« arrivée », « départ ») est fiable.

**Solution non régressive.**

| Étape | Changement | Non-régression |
|---|---|---|
| 1 | Migration **additive** : `bookings.confirmed_at timestamp null` | Lignes existantes `null` = comportement d'affichage actuel via le repli |
| 2 | La poser dans la branche « confirmed » de `PUT /api/bookings/[id]` (même transaction), et dans `completeEligibleBookings` du cron si le séjour était toujours non daté | Additif ; aucun appelant n'est modifié |
| 3 | Timeline : `confirmedAt ?? updatedAt ?? createdAt` (repli = comportement actuel) | Aucune ligne ancienne ne change d'affichage |

### C6 — `/messages` (voyageur) : 1 + N requêtes et pas de fenêtre

**Constat.** `getConversations()` (`src/app/(main)/messages/page.tsx:59`) lance
**une requête par conversation** pour le dernier message (`Promise.all`), et la
page n'applique ni `parsePageWindow` ni `<ShowMore>` — alors que le contrat de
fenêtre T-245 couvre 7 écrans et que T-257 a rattrapé les deux derniers
(`/dashboard/rooms`, `/dashboard/messages`), qui partagent d'ailleurs le même
filtre de visibilité (`conversationScope()`). La recherche, elle, filtre
côté JavaScript sur le jeu complet chargé.

**Impact.** Coût 1 + N à chaque rendu de la boîte de réception ; incohérence
visible du contrat (« 9 écrans de liste fenêtres, 1 pas ») ; sur un compte
ancien, la page charge et filtre inutilement des centaines de lignes.

**Solution non régressive.**

| Étape | Changement | Non-régression |
|---|---|---|
| 1 | Remplacer la 1 + N par **une** requête (dernier message par conversation en join/LATERAL, ou `lastMessageAt` + compte déjà portés par `conversations`) | Sortie identique (même tri `lastMessageAt desc`, même filtre T-217/P7 des fils vides) |
| 2 | Appliquer `parsePageWindow` + `<ShowMore>` avec les clés `list.window.*` déjà existantes (même usage que les 9 autres écrans) | Sans paramètre, la fenêtre par défaut s'applique **comme ailleurs** ; le bandeau indique le périmètre et permet de tout afficher ; les liens internes vers `/messages/[id]` sont intouchés |
| 3 | Conserver la recherche côté JS **sur la fenêtre affichée** (comportement T-245 des autres écrans) | — |

## 4. Vérifications saines (hypothèses infirmées — à ne pas rouvrir)

| Hypothèse | Résultat |
|---|---|
| Des pages exploseraient à l'exécution | **Faux** : 46 pages × 4 rôles balayées avec routes dynamiques réelles → **0 « Application error »** ; hors 200 : redirections d'auth (307) et 404 volontaires (slug/token/ID inconnus) |
| Liens morts internes | **Aucun** : 78 liens extraits du rendu dashboard (hôte) → tous 200/307/302 |
| Cycle de vie de la réservation cassé | **Sain** : création (201, e-mails voyageur + hôte) → confirmation (e-mails ×2) → paiement sur place (idempotent, `paymentExpiresAt`/`requestExpiresAt` vidés) → facture 200 (statut « Annulée » bien imprimé après annulation) → annulation avec devis (frais 0,00 / remboursement 314,07, e-mails ×2) ; clôture **refusée avant paiement** (409 « … qu'après paiement ») puis acceptée après ; compteur BestRewards 7 → 8, cashback 0,00 (correct : le 5 % n'existe qu'au niveau 3, `lib/loyalty.ts`) |
| Expiration des demandes pending | **Saine** : demande dont `requestExpiresAt` a été rétrodatée → cron : `expiredManualBookingRequests: 1`, statut `cancelled` + motif explicite + e-mails voyageur **et** hôte |
| Avis de bout en bout | **Sains** : dépôt (auto-approuvé, modération off) → agrégats recalculés (7,8 → 8,0 ; 3 → 4) → e-mail hôte → réponse hôte → modération admin `hidden` + motif (requis, 400 sinon) → agrégats recalculés + e-mail auteur → vote utile : **auto-vote 400 explicite**, double vote **409** |
| 2FA | **Saine** : setup (secret base32) → login avec `totpCode` OK → code erroné 401 « Code 2FA invalide » → désactivation (mot de passe + code) → `two_factor_enabled = false` |
| Claim invité | **Sain** (hors C4) : e-mail avec lien, page 200, mot de passe posé, **token consommé** (seconde utilisation 400), login avec le nouveau mot de passe OK |
| Alerte prix | **Saine** : seuil 50 € < prix 118,67 → **pas** de notification (sémantique « prix ≤ seuil » correcte) ; seuil 150 € → notification + e-mail ; **idempotent** (2ᵉ run : `notified: 0`) |
| Validation d'annonce | **Saine** : hôte → **403** « Accès admin requis » ; admin `approve` → `active` + e-mail hôte ; annonce suspendue → fiche publique **404** (pas de fuite d'existence) |
| Suspension de compte | **Saine** : login 401 « Ce compte est suspendu » → réactivation → login OK |
| Favoris | **Sains** : création, ajout (déjà présent → 400), partage public (page 200 anonyme, noindex), **déplacement atomique** entre listes (T-246), suppression ; IDOR liste tiers → 404 identique |
| Promotions | **Saines** : création (schéma strict), aperçu (`apply` : 37,84 € sur 378,40), réservation avec le code (total 282,66 € remise promo **et** BestRewards combinées, `current_uses` +1) |
| i18n | **Sain** : `npm run i18n:check` warn-only, 6 candidats **pré-existants** (commentaires + valeur par défaut `closeLabel` de `ui/dialog.tsx`) ; 0 texte en dur dans les nœuds JSX |
| Sécurité | **Saine** : cookie session `httpOnly` + `secure` (prod) + `sameSite=lax` ; 404 (non 403) sur réservation d'autrui (pas de fuite d'existence) ; rate-limit sur auth/wishlist/bookings (déjà documenté en B12 n°6) |

## 5. Décisions à trancher (réponse oui / non)

| Lot | Constats | Nature | Risque | Effort |
|---|---|---|---|---|
| **A** | C1, C2 | Intégrité du cycle de réservation + état de remboursement trompeur | **Très faible** (C1 ajoute un refus d'un état déjà refusé à la création ; C2 est de l'affichage + du gabarit) | ~1 session |
| **B** | C3, C4 | Visuels honnêtes + fin de parcours du claim | **Très faible** (swap de fichier / 1 colonne dans 1 transaction) | ~0,5 session |
| **C** | C5, C6 | Précision de la timeline + cohérence du contrat de fenêtre | Faible (C5 = migration additive) | ~1 session |

Ordre recommandé si plusieurs lots sont retenus : **A** (C1 d'abord — c'est le
seul qui laisse un séjour **réalisable** sur un bien sanctionné) → **B** → **C**.
Chaque lot reste livrable seul, avec tests, i18n FR/EN et CI verte ; aucun lot ne
modifie de contrat existant (transitions, états de réservation, contrat de
fenêtre, journal du wallet gelé T-248 §3).

## 6. État de la base après la passe

| Contrôle | Valeur |
|---|---|
| `users` / `properties` / `bookings` / `reviews` | rendues à l'état seed (le compte invité de test, l'annonce archivée, les réservations/avis/promo d'essai et l'alerte prix purgeés ; `reset_test_db.mjs` + purges ciblées) |
| `email_outbox` | rendue à l'état seed (les e-mails de la passe purgeés) |
| Code | **aucune modification** : analyse uniquement (rejeu HTTP + SQL lecture/écriture de test purgés) |
| Serveur de développement | relancé après la passe (`:3000`, accessible) |
