# Analyse de conception — T-235 → T-239 (audit n°3, findings F4 → F8)

- **Date** : 2026-09-11
- **Source** : `docs/analyse_2026-09-10_audit_runtime_scenarios.md`
- **Objectif** : corriger cinq findings d'audit sans régression, en réutilisant les briques
  existantes du dépôt (rate-limit, outbox, réglages, i18n, templates) plutôt qu'en introduisant
  de nouveaux mécanismes.

## F4 — « une erreur de saisie consommait le quota de réservation »

**Décision : deux compteurs aux responsabilités distinctes.**

| Compteur | Position | Fenêtre | Rôle |
|---|---|---|---|
| `bookings:guard:<clé>` | **avant** lecture du corps | 60/h | anti-abus : borne le coût de traitement d'une requête (body parsing, zod) |
| `bookings:user:<id>` ou `bookings:guest:<clé>` | **après** validation du payload | 10/h | quota **produit** : ce que l'utilisateur obtient réellement |

Alternatives écartées : (a) un compteur unique déplacé après validation — laisse la route
dépenser du CPU sur des requêtes rejetées ; (b) compteur par IP seule — punit une IP d'école ou
d'hôtel partagée. La clé invité est donc un **cookie signé** `mbb_guest` (180 j, httpOnly, lax)
avec repli IP assumé et documenté (« effacer le cookie repart de zéro » — c'est un quota produit,
pas un contrôle de sécurité ; le garde-fou 60/h reste).

Le message de refus porte désormais le délai réel : `429` + `Retry-After` +
« Trop de tentatives, réessayez dans N minute(s) », traduit en anglais par la table de patterns
d'`api-error.ts` (nouvelle règle, pour que la localisation ne se perde pas à l'ajout du délai).

## F5 — « l'heure d'arrivée estimée n'était jamais restituée »

**Décision : valider à l'entrée, restituer partout où le séjour est décrit.**
- Le tunnel accepte `HH:MM` (regex) ; l'API ne peut plus produire d'erreur PostgreSQL sur la
  colonne `time`.
- La restitution suit le fil métier existant : fiche réservation **hôte**, espace **voyageur**
  (`mes-reservations`), et les **4 e-mails** (demande + confirmation, côté voyageur et côté hôte)
  via un paramètre optionnel `estimatedArrival` — une ligne n'apparaît que si l'information
  existe, ce qui évite d'afficher « Heure d'arrivée estimée : — » dans les messages des séjours
  sans heure saisie.

## F6 — « validation/rejet d'annonce non notifié, motif invisible »

**Décision : rendre la décision lisible sans créer de nouveau flux.**
- **Persistance** : colonne additive `properties.review_reason` (varchar 500), effacée à
  l'approbation — l'état de l'annonce redevient propre une fois en ligne.
- **Notification** : `notifyHostOfDecision` réutilise l'**outbox** existante (pas d'envoi direct),
  avec un `eventKey` déterministe intégrant l'admin : un rejeu de la même décision reste
  idempotent, mais deux admins produisant la même décision restent traçables séparément.
  L'envoi est **best-effort** : un incident SMTP ne doit pas faire échouer la décision
  d'administration (l'annonce change d'état dans tous les cas).
- **Interrupteurs** : deux réglages dédiés (`notifications.propertyApproved` /
  `propertyRejected`, défaut `true`) plutôt qu'une réutilisation détournée des interrupteurs de
  réservation — la coupure est réversible depuis l'admin sans redéploiement.
- **Suspension** : aucun gabarit dédié (hors périmètre F6) — la décision est appliquée, le motif
  est conservé, l'envoi est simplement omis. Documenté en commentaire de la route.
- **i18n** : le motif est une donnée rédigée par l'admin ; seule l'étiquette qui l'introduit est
  traduite (`prop.reviewReason`), conformément à la règle déjà appliquée aux contenus en base.

## F7 — « wishlist partagée indexable, lien sans rotation »

**Décision : aligner sur les 14 autres surfaces privées, et prouver la rotation plutôt que la
recoder.** La rotation (`rotateShareToken`) existait déjà dans `PATCH /api/wishlists` ; le
livrable était l'absence de garantie. Le test vérifie donc le **comportement attendu de
l'utilisateur** : après rotation, l'ancien lien renvoie **404** et le nouveau **200** ; une
wishlist repassée privée renvoie **404**. L'UI porte la promesse (« générer un nouveau lien
invalide immédiatement l'ancien ») sous forme de notice et d'infobulle.

## F8 — « désabonnement promis mais inexistant »

**Décision : un jeton signé plutôt qu'une page nécessitant une connexion.**
- Un lien reçu par e-mail ne peut pas exiger une session (le destinataire n'est pas
  nécessairement connecté) : la preuve d'identité est donc portée par le lien lui-même.
  HMAC-SHA256 sur `userId|catégorie` (secret `JWT_SECRET`), comparaison à **temps constant**,
  catégorie restreinte par whitelist → un jeton ne peut ni désinscrire un tiers, ni dépasser sa
  catégorie.
- Page `/desabonnement` : `GET` (c'est un lien d'e-mail), `noindex`, **idempotente**, message
  identique qu'un compte existe ou non en cas de jeton invalide.
- Périmètre assumé : seules les **alertes prix** (aucune valeur contractuelle) sont refusables.
  Les e-mails de réservation, de sécurité et de contenu continuent d'être envoyés ; la page de
  confidentialité FR/EN a été réécrite pour dire exactement cela au lieu d'une promesse floue.
- Pas de table de préférences pour une catégorie unique ; le registre
  `UNSUBSCRIBE_CATEGORIES` isole l'extension future.

## Tests ajoutés

| Fichier | Cas couverts |
|---|---|
| `src/lib/rate-limit.test.ts` (+5) | clés séparées guard/user/invité, fenêtres, message avec délai |
| `src/app/api/bookings/route.t235.test.ts` (3) | 10 essais invalides → 0 consommation puis 201 ; 11ᵉ demande → 429 + `Retry-After` ; clés distinctes |
| `src/lib/booking-arrival-time.test.ts` (3) | `HH:MM` accepté, `25:99` refusé, valeur absente tolérée |
| `src/lib/mail/templates.t236.test.ts` (4) | ligne d'arrivée présente FR/EN (demande + confirmation) et absente si non renseignée |
| `src/app/api/properties/[id]/validate/route.t237.test.ts` (3) | rejet → draft + motif + 1 envoi (rejeu sans doublon) ; approbation → motif `null` + 1 envoi ; interrupteur coupé → 0 envoi |
| `src/app/api/wishlists/route.t238.test.ts` (2) | rotation → ancien 404 / nouveau 200 ; privé → 404 |
| `src/lib/unsubscribe.test.ts` (4) | jeton altéré / autre user / autre clé / absent refusés, catégorie inconnue refusée |
| `src/app/(main)/desabonnement/page.t239.test.ts` (2) | désabonnement réel sur base, idempotence, jeton invalide ou d'autrui sans effet, `noindex` vérifié |
| `src/lib/ui-strings.test.ts` (verrou) | catalogue **1655** clés FR = EN |
