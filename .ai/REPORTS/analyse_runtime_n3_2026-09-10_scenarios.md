# Analyse runtime n°3 — scénarios et éléments fonctionnels inachevés ou mal pensés

**Date** : 2026-09-10 · **Périmètre** : application complète (visiteur + 3 rôles), base démo
seedée (8 users / 8 hébergements / 33 réservations / 24 avis) · **Nature** : analyse seule —
aucune ligne de code produit modifiée par cette passe.

Troisième passe, après l'audit P1–P10 (`docs/analyse_2026-09-10_audit_runtime_fonctionnalites.md`,
livré en T-217) et l'audit A1→A11 (`docs/analyse_2026-09-10_audit_runtime_inacheves.md`,
tâches T-221→T-231). Là où les deux premières listaient **ce qui n'est pas branché**, celle-ci
suit les **scénarios de bout en bout** (ce que l'utilisateur vit réellement) et cherche les
**décisions produit qui se contredisent**, les **informations collectées mais jamais restituées**
et les **états de données que le produit ne sait plus distinguer**.

Aucun constat de cette passe n'est déjà couvert par T-221→T-231 : les intersections
(F3 avec T-221, F11 avec T-230, F9 avec T-227) sont signalées explicitement.

---

## 1. Méthode

| Moyen | Détail |
|---|---|
| Rôles | visiteur, voyageur (`customer@`), hôte (`host@`), admin (`admin@`) — jetons frais `/api/auth/login` |
| Pages | les 43 `page.tsx` ; crawl par rôle (HTML + liens) ; crawl final des liens internes (124 liens distincts, admin 122, hôte 113, voyageur 26) |
| Boutons / contrôles | analyse statique de tous les `<Button>` TSX (détection « sans `onClick`/`href`/`type=submit`/`disabled` hors `<Link>`/`<form>` ») → **0 bouton mort** |
| API | 67 `route.ts` ; campagne de sondes HTTP (payloads incomplets, invalides, extrêmes, rôles croisés, ressources d'autrui) |
| Données | lecture directe PostgreSQL pour confirmer les effets réels (statuts, colonnes, `email_outbox`, `audit_log`) |
| Fuseaux | exécutions `TZ=UTC`, `TZ=Africa/Douala`, `TZ=America/Los_Angeles`, `TZ=Pacific/Kiritimati` pour reproduire les décalages |
| Crons | exécution réelle de `GET /api/cron/price-alerts` (dev) + lecture `vercel.json` / `scripts/cron-runner.mjs` |
| État final | base remise à l'état seed exact (8/8/33/24, compteurs à 0, 1 `app_settings`), scripts de sonde supprimés |

**Résultat d'ensemble** : 13 constats (F1→F13), dont **2 bloquants** (dates de séjour décalées d'un
jour selon le fuseau du navigateur ; hôte suspendu dont les annonces restent réservables),
**8 gênes métier réelles** et **3 finitions**. Aucun 500 rencontré, aucun lien mort : comme lors de
la passe précédente, les problèmes sont dans *ce qui existe et ne se termine pas correctement*.

---

## 2. Synthèse

| # | Constat | Gravité | Effort | Tâche proposée |
|---|---|---|---|---|
| F1 | Dates de séjour affichées dans le fuseau du navigateur → jour décalé (et écart SSR/client) | 🔴 haute | M | T-232 |
| F2 | Hôte suspendu : ses annonces restent actives, visibles, réservables | 🔴 haute | M | T-233 |
| F3 | Une demande en attente bloque les dates sans expiration « paresseuse » (dépend du cron) | 🟠 moyenne | M | T-234 |
| F4 | Rate-limit réservation 10/h **compté avant validation** → voyageur bloqué 1 h | 🟠 moyenne | S | T-235 |
| F5 | Heure d'arrivée estimée collectée… et jamais transmise à personne (+ API non validée) | 🟠 moyenne | S | T-236 |
| F6 | Validation / rejet d'annonce : hôte non notifié, motif invisible | 🟠 moyenne | S | T-237 |
| F7 | Wishlist partagée indexable et sans expiration (toutes les autres pages privées sont `noindex`) | 🟠 moyenne | XS | T-238 |
| F8 | « Désabonnement depuis l'onglet Notifications » promis par la page Confidentialité : seul le prix-alerte est désabonnable | 🟠 moyenne | S | T-239 |
| F9 | `users.timezone` / `properties.timezone` : réglages décoratifs, et PATCH accepte n'importe quelle valeur | 🟠 moyenne | S | T-240 |
| F10 | « Aujourd'hui » en UTC + `toDate()` sensible au fuseau serveur → clôture/avis décalables d'un jour | 🟠 moyenne | S | T-240 |
| F11 | Suppression (anonymisée) et suspension confondues : « Réactiver » fabrique un compte zombie | 🟡 faible | S | *(à fusionner avec T-230)* |
| F12 | Analytics figé sur 30 jours glissants : ni période choisie, ni export | 🟡 faible | S | T-241 |
| F13 | Erreurs API : première erreur seulement ; `PUT` accepte en 200 des champs inconnus | 🟡 faible | XS | T-241 |

*(XS = < 2 h, S = ≤ ½ journée, M = 1–2 journées de travail agent, tests et docs inclus.)*

---

## 3. Constats détaillés

### F1 🔴 — Les dates de séjour peuvent s'afficher un jour plus tôt selon le fuseau du navigateur

**Problème.** `bookings.check_in` / `check_out` sont des colonnes SQL `date`. Elles sont lues par
`node-pg` sous forme d'objets `Date` **à minuit local du serveur**, puis formatées côté React avec
`Intl.DateTimeFormat` **sans `timeZone`** (`formatDate()`, `src/lib/utils.ts:28-40`) : le rendu suit
donc le fuseau du navigateur du lecteur. Résultat : le même séjour ne s'affiche pas au même jour
pour deux personnes, et le HTML rendu par le serveur (SSR) peut différer du rendu client
(hydratation).

**Preuves runtime.**

| Vérification | Résultat |
|---|---|
| `TZ=UTC` + `new Intl.DateTimeFormat("fr-FR",{day,month})` sur `2026-09-24T00:00:00Z` | « 24 septembre » |
| `TZ=America/Los_Angeles` (même instant) | **« 23 septembre »** |
| `TZ=Pacific/Kiritimati` | « 24 septembre » |
| Lecture `pg` de `check_in = '2026-09-24'` avec `TZ=Africa/Douala` | `2026-09-23T23:00:00.000Z` (déjà J-1 à la source) |
| Lecture identique avec `TZ=UTC` | `2026-09-24T00:00:00.000Z` |

Les e-mails, eux, forcent `timeZone: "UTC"` (`src/lib/mail/templates.ts:72-78`) : un voyageur peut
donc lire **« arrivée le 24 »** dans son e-mail et **« arrivée le 23 »** sur son écran de
réservation, selon son navigateur et le fuseau du serveur de l'instance.

**Impact.** Réservations passées/reçues au mauvais jour, reçus et factures incohérents, calendriers
d'hôte décalés, avertissement d'hydratation React. Les colonnes `date` étant manipulées partout
comme des chaînes (`stayNights()`, requêtes SQL), seul l'affichage est fautif — mais il l'est
*silencieusement*.

**Correctif non régressif.**
1. Centraliser l'affichage des dates civiles : `formatStayDate(value)` → `timeZone: "UTC"` (les
   colonnes `date` sont sémantiquement des jours civils, pas des instants) ; l'utiliser dans
   `formatDate`/`formatDateShort` **uniquement** pour les valeurs `date` de séjour
   (`checkIn`/`checkOut`/`availability.date`), sans toucher aux horodatages (`createdAt`…).
2. À terme (non bloquant) : lire les colonnes `date` en `mode: "string"` Drizzle pour supprimer la
   dépendance au fuseau serveur à la source ; le helper d'affichage accepte alors `YYYY-MM-DD`.
3. Verrou de test : un test unitaire qui formate la même valeur sous `TZ=UTC`,
   `America/Los_Angeles`, `Pacific/Kiritimati` et `Africa/Douala` et exige le **même jour**.
   Aucune migration, aucun changement d'API.

**Reproduction.**
```bash
TZ=America/Los_Angeles node -e "console.log(new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long'}).format(new Date('2026-09-24T00:00:00.000Z')))"
```

---

### F2 🔴 — Suspendre un hôte ne retire ni ne protège ses annonces

**Problème.** `PATCH /api/users/[id]/suspend` (`src/app/api/users/[id]/suspend/route.ts:35-48`)
positionne `deleted_at` et supprime les sessions : l'hôte ne peut plus se connecter. Mais rien ne
touche ses annonces, et les requêtes publiques ne filtrent pas `users.deleted_at` : la liste
`/api/properties` ne teste que `properties.status = 'active'`
(`src/app/api/properties/route.ts:132`), et la fiche publique passe par `getPublicProperty()`
(`src/lib/public-property.ts`, `src/app/(main)/hebergement/[slug]/page.tsx:120-147`) sans jointure
sur l'état de l'hôte.

**Preuve runtime (sonde admin → hôte → visiteur).**

```
host@mybestbooking.com suspendu  → 200
/connexion hôte                  → 401 « Ce compte est désactivé. Contactez le support pour le réactiver. »
/hebergement/appartement-montmartre (visiteur) → 200
/recherche?city=Paris            → le bien est toujours présent dans les résultats
réactivation                     → session hôte restaurée (200)
```

**Impact.** Un administrateur qui suspend un hôte (fraude, indisponibilité, litige) laisse ses
annonces en ligne : les voyageurs envoient des demandes qui **expireront 24 h plus tard** (F3)
sans qu'aucun humain ne puisse répondre — exactement le scénario que la suspension cherche à
éviter. Inversement, un hôte suspendu par erreur n'a aucune visibilité sur ce que deviennent ses
annonces.

**Correctif non régressif.**
1. Dans la transaction de suspension : basculer ses annonces `active → suspended` (le statut
   existe déjà et est déjà honoré par la recherche et la fiche), en conservant le statut
   antérieur pour une réactivation fidèle (`suspended_from` ou journal d'audit déjà présent).
2. Défense en profondeur : filtrer `users.deleted_at IS NULL` dans les requêtes publiques
   (liste + fiche) — un bien actif d'un hôte supprimé ne doit jamais être réservable.
3. Traiter les demandes en cours : les annuler (ou les signaler) avec e-mail aux voyageurs
   concernés ; à défaut, l'expiration (F3/T-221) couvre le cas dégradé.
4. Réactivation : restaurer le statut des annonces dans la même transaction, avec un test
   « suspension → recherche fermée → réactivation → recherche rouverte ».
Aucune migration de données n'est nécessaire (colonnes existantes) ; les biens d'autres hôtes ne
sont pas touchés.

---

### F3 🟠 — Une demande en attente bloque les dates jusqu'à ce que le cron passe

**Problème.** Le contrôle de chevauchement d'une nouvelle réservation ignore les demandes non
confirmées : `ne(bookings.status, "cancelled")` (`src/app/api/bookings/route.ts:220-232`). Une
demande `pending` (sans paiement plateforme, TTL 24 h,
`src/lib/booking-request-expiration.ts:8-12`) occupe donc la chambre. Sa libération dépend
entièrement de `expireManualBookingRequests()`, exécuté par le cron **quotidien**
(`vercel.json` → `0 8 * * *` ; en local `npm run cron:local`). Si le cron n'est pas configuré
(auto-hébergement), tombe ou prend du retard, **les dates restent bloquées indéfiniment**.

**Preuve runtime.** Deux demandes successives sur les mêmes dates (2027-06-10 → 06-12), la
première laissée `pending` : la seconde est refusée en **409 « Cette chambre n'est plus disponible
pour ces dates »**, alors que rien n'est confirmé ni payé. Les résultats de recherche, eux,
masquent bien le bien pour ces dates (même règle) : le voyageur suivant ne voit plus l'annonce,
sans savoir qu'il suffirait d'attendre une décision d'hôte.

**Impact.** Perte sèche de réservations (la vitrine se ferme sur un simple espoir), impression de
disponibilité fantôme, support obligé d'expliquer un mécanisme invisible.

**Correctif non régressif.**
1. **Expiration paresseuse** : extraire la logique existante de `expireManualBookingRequests()`
   en une fonction réutilisable, et l'appeler **dans la transaction** de création de réservation
   (et du devis) avant l'évaluation des chevauchements — périmètre limité à la chambre et à la
   fenêtre demandée. Le cron reste la ceinture, la transaction devient les bretelles.
2. Le code d'expiration existant est déjà transactionnel, idempotent et testé : le réutiliser
   évite toute divergence ; les e-mails d'expiration (T-221) restent déclenchés par le cron et/ou
   par la purge paresseuse, avec `eventKey` déterministe (aucun doublon).
3. Verrou : test d'intégration « demande expirée non purgée → nouvelle réservation acceptée et
   ancienne passage `cancelled` ».

**Intersection connue** : T-221 (audit n°2) rend l'échéance visible et notifiée ; F3 traite le
*stock*, pas l'affichage.

---

### F4 🟠 — Le quota de réservation punit les erreurs de saisie (10 essais/heure, comptés avant validation)

**Problème.** Dans `POST /api/bookings`, le rate-limit est appliqué **avant** toute validation
(`src/app/api/bookings/route.ts:158-162`) : 10 tentatives par heure et par utilisateur, 10 par IP
pour les invités. Chaque refus (date passée, capacité dépassée, mauvaise promo, double clic…)
consomme une tentative, y compris quand **aucune** écriture n'a lieu.

**Preuve runtime (reproduite deux fois).** Après 6 essais invalides (date passée, dates inversées,
capacité, chambre inconnue), la **tentative valide** sur des dates libres a reçu
`429 {"error":"Trop de tentatives, réessayez plus tard"}`, sans indication de délai — alors que le
payload était correct. Les appels suivants (promo, wallet) ont subi le même sort : l'utilisateur
est exclu du tunnel pour une heure sans jamais avoir réservé.

**Impact.** Un voyageur qui hésite, se trompe de dates ou réessaie après une indisponibilité est
bloqué une heure, avec un message qui ne dit ni pourquoi ni combien de temps. Les invités
partagent la clé IP (`bookings:guest-ip`) : un foyer, un hôtel ou une entreprise peut épuiser le
quota d'un autre.

**Correctif non régressif.**
1. Déplacer le `rateLimit` **après** la validation d'entrée (schéma Zod + règles métier) et avant
   l'écriture, ou comptabiliser séparément les refus de validation (compteur « essais invalides »
   beaucoup plus permissif, ex. 30/h).
2. Enrichir le message : « Vous avez atteint la limite de réservations. Réessayez dans {n} min. »
   en réutilisant l'en-tête `Retry-After` déjà calculé.
3. Pour les invités, dériver la clé d'un cookie posé par la page de réservation plutôt que de la
   seule IP (comportement inchangé pour les cas normaux, meilleur pour les IP partagées).
4. Documenter la règle dans `KNOWN_LIMITATIONS.md` (déjà le lieu des limites assumées).

---

### F5 🟠 — L'heure d'arrivée estimée est collectée… puis jetée

**Problème.** Le tunnel de réservation demande l'heure d'arrivée estimée
(`src/app/(main)/reservation/reservation-form.tsx:656-670`, choix limité aux heures pleines), la
persiste dans `bookings.estimated_arrival` (`src/db/schema.ts:320`, colonne `time`) — et **rien ne
la relit** : ni la fiche réservation de l'hôte (`/dashboard/bookings/[id]` affiche pourtant le
téléphone, le motif de voyage et les demandes spéciales), ni les e-mails de demande/confirmation,
ni la fiche voyageur. De plus, l'API accepte n'importe quelle chaîne
(`estimatedArrival: z.string().optional()`, `src/app/api/bookings/route.ts:45`) alors que la
colonne est un `time` : une valeur libre provoque une erreur PostgreSQL (l'UI masque le cas, une
intégration API non).

**Preuve.**
```
grep -rn "estimatedArrival" src  →  formulaire (3), API (2), schéma (1) ; aucune lecture d'affichage
SELECT 'vers 18h'::time          →  ERREUR invalid input syntax for type time
```

**Impact.** Le voyageur fournit une information opérationnelle (heure d'arrivée) que l'hôte ne
recevra jamais — source d'attente, d'appels et de no-shows évitables ; l'API reste exposée à une
500 sur une valeur hors format.

**Correctif non régressif.** Afficher `estimatedArrival` sur la fiche hôte (à côté du téléphone et
des demandes spéciales) et dans les e-mails de demande/confirmation (variable déjà disponible, aucun
schéma à changer) ; valider côté API (`z.string().regex(/^\d{2}:\d{2}$/)` ou énumération des
créneaux proposés) avec message explicite ; conserver la colonne telle quelle.

---

### F6 🟠 — Validation et rejet d'une annonce : l'hôte n'est ni notifié ni informé du motif

**Problème.** `POST /api/properties/[id]/validate` (admin) accepte un `reason`
(`src/app/api/properties/[id]/validate/route.ts:13-22`), le journalise dans `audit_log`, puis :
`approve → active`, `reject → draft`. **Aucun e-mail n'est envoyé** (aucun `enqueueEmail`/gabarit
dans la route ni dans `templates`), et **aucune colonne ne porte le motif** : côté hôte, l'écran
d'édition affiche seulement un statut générique (`prop.draftRejected`) et sa propre raison de
revenir en brouillon. L'hôte ne peut pas lire l'audit (403 admin).

**Preuve.** `grep -n "enqueueEmail|templates\." src/app/api/properties/[id]/validate/route.ts` →
aucun résultat ; schéma `properties` sans colonne de motif ; page d'édition : statut + bouton
« soumettre » uniquement.

**Impact.** L'hôte attends sans savoir s'il sera publié, découvre un rejet sans explication,
resoumet à l'identique et boucle. Les équipes support absorbent la question.

**Correctif non régressif.**
1. Deux gabarits localisés (`propertyApproved`, `propertyRejected`) déclenchés par la route via
   `enqueueEmail` (idempotents par `eventKey`, comme le reste de la plateforme) ; interrupteurs
   dans `notifications` (déjà en cours côté T-223).
2. Persister le motif : `properties.review_reason` (+ `reviewed_at`), affiché dans l'éditeur hôte
   en cas de rejet/suspension ; colonne additive, l'audit reste inchangé.
3. Verrou : test de la route qui vérifie l'envoi + la persistance du motif.

---

### F7 🟠 — La page de wishlist partagée est indexable et sans expiration

**Problème.** `/wishlists/share/[token]` expose un titre et une description via
`generateMetadata` (`src/app/(main)/wishlists/share/[token]/page.tsx:58-63`) **sans
`robots: { index: false }`**, alors que toutes les surfaces privées du site le déclarent
(`/mes-favoris`, `/reservations`, `/messages`, `/mon-compte`, `/dashboard/*`… voir la liste des 14
occurrences). Le `share_token` (`src/db/schema.ts:417`) n'a ni échéance ni rotation prévue : le
partage est révocable (`isPublic = false`) mais un lien copié reste valable indéfiniment, et rien
n'avertit le propriétaire que la page peut se retrouver dans un moteur de recherche.

**Impact.** Un utilisateur partage une sélection de logements (avec son nom de liste, ses
préférences de voyage) dans une messagerie ou un réseau social : le lien peut être indexé,
archivé, et rester accessible après le voyage. Écart de traitement par rapport à `/mes-favoris`
(noindex) pour un contenu plus sensible (partage par lien).

**Correctif non régressif.** Ajouter `robots: { index: false, follow: false }` à la page partagée
(une ligne) ; proposer dans `WishlistActions` la régénération du token (« invalider l'ancien
lien ») et une mention « toute personne ayant le lien peut voir cette liste ». Aucune migration :
la régénération réécrit `share_token`.

---

### F8 🟠 — La page Confidentialité promet un désabonnement que l'interface n'offre pas

**Problème.** La politique publiée affirme, au titre du droit d'opposition :
« **désabonnement possible depuis l'onglet Notifications** »
(`src/app/(main)/confidentialite/page.tsx:32`, idem :78). Or l'onglet Notifications de
`/mon-compte` n'expose **qu'une seule préférence** : les alertes prix
(`src/components/notification-prefs-section.tsx:12-17`, commentaire explicite : « pour un vrai
contrôle par user il faudrait une table user_notification_prefs — hors périmètre V1 »). Les
e-mails de rappel de séjour, de demande d'avis et les notifications d'avis ne sont pas
désabonnables par le destinataire, et aucun e-mail ne contient de lien d'opposition (le pied de
gabarit ne comporte que le slogan, `src/lib/mail/templates.ts:39-53`).

**Impact.** Contradiction entre un document public (RGPD) et le produit ; un utilisateur qui
cherche le désabonnement promis ne le trouve pas ; envois non désactivables à requalifier
(messages de service vs prospection).

**Correctif non régressif.**
1. Court terme : corriger la formulation (préciser que seules les alertes prix sont désactivables
   depuis le compte, l'opposition des autres envois passant par le support).
2. Cible : table `user_notification_prefs` (ou colonnes JSONB sur `users`) alimentant les
   `getSetting("notifications")` au niveau destinataire, + lien d'opposition dans le pied des
   e-mails non transactionnels (`unsubscribe` → page `/mon-compte?tab=notifications`) ; le
   comportement par défaut (tout activé) reste identique, aucun envoi existant ne change tant que
   l'utilisateur n'a rien modifié.

---

### F9 🟠 — Les préférences de fuseau horaire sont décoratives (et non validées)

**Problème.** Le profil propose un fuseau horaire (`src/components/profile-form.tsx:202-206`,
alimenté par `users.timezone`), `PATCH /api/users/me` l'accepte — sans autre validation qu'une
longueur maximale (`timezone: z.string().max(50).optional()`,
`src/app/api/users/me/route.ts:35`) — et **aucun code ne le relit** : ni l'affichage des dates
(F1), ni les crons, ni les e-mails (qui forcent UTC). `properties.timezone` suit le même chemin
(présent au schéma, exposé publiquement, jamais utilisé pour un affichage ou un calcul).

**Preuve runtime.**
```
PATCH /api/users/me { "timezone": "Pas/Un-Fuseau" }  →  200 OK (valeur stockée telle quelle)
grep -rn "timezone" src (hors formulaire / API / schéma)  →  aucun consommateur
```

**Impact.** L'utilisateur règle un paramètre qui n'a aucun effet observable (perte de confiance) ;
la base peut contenir des valeurs invalides ; l'hôte croit que ses horaires d'arrivée/départ sont
exprimés dans son fuseau alors qu'ils sont affichés tels quels.

**Correctif non régressif.**
1. Valider la valeur (`z.enum` d'une liste IANA restreinte ou `Intl.supportedValuesOf("timeZone")`)
   avec message explicite ; côté UI, le `<select>` liste déjà des valeurs valides, l'API doit
   suivre.
2. Rendre le réglage utile : l'utiliser pour l'affichage des **heures** (heure d'arrivée estimée,
   horaires d'arrivée/départ de l'annonce — T-227) et pour les rappels du cron ; à défaut,
   retirer le champ du formulaire et documenter la limite.
3. Verrou : test « fuseau invalide → 400 ; fuseau valide → affichage décalé en conséquence ».

**Intersection connue** : T-227 (audit n°2) ajoute l'édition des horaires + `timezone` côté
annonce ; F9 traite la cohérence du réglage côté utilisateur.

---

### F10 🟠 — Clôture de séjour et dépôt d'avis : un « aujourd'hui » UTC croisé avec un fuseau serveur

**Problème.** `src/lib/booking-lifecycle.ts` décide de la légalité d'une clôture
(`completed`/`no_show`) et de l'éligibilité d'un avis en comparant la date de départ à
`new Date().toISOString().slice(0, 10)` (**UTC**), après conversion de la valeur par
`toDate()` → `value.toISOString().slice(0, 10)`. Or la valeur reçue est un `Date` **à minuit local
du serveur** (F1) : sur une instance déployée en `Africa/Douala` (UTC+1), une réservation dont le
départ est `2026-09-24` est lue `2026-09-23T23:00Z`, donc `toDate()` renvoie **« 2026-09-23 »**.
Sur une instance UTC, la même donnée renvoie « 2026-09-24 ». Le verdict dépend donc du fuseau du
serveur — et, en journée, de l'heure du clic (l'UTC est en retard/avance par rapport au jour local
de l'hôte et du voyageur).

**Preuve runtime.**
```
TZ=Africa/Douala : check_in '2026-09-24' lu par pg → 2026-09-23T23:00Z → toDate() = "2026-09-23"
TZ=UTC           : même ligne                          → 2026-09-24T00:00Z → toDate() = "2026-09-24"
```

**Impact.** Un hôte en UTC+X peut clôturer (et rendre un avis possible) la veille du départ réel
selon l'instance ; à l'inverse, un hôte en UTC−X peut voir sa clôture refusée pendant plusieurs
heures après la fin du séjour, avec un message (« Le séjour ne peut être clôturé qu'après la date
de départ ») qui semble faux.

**Correctif non régressif.** Normaliser les dates civiles en chaînes `YYYY-MM-DD` dès la lecture
(`mode: "string"` Drizzle) et comparer des chaînes, comme le fait déjà `stayNights()` ; à défaut,
n'utiliser que des fonctions de conversion UTC explicites (`toIsoDateUtc`) et bannir
`new Date().toISOString()` comme « aujourd'hui » métier au profit d'une date d'horizon
configurable (celle de l'hôte, cf. F9). Tests unitaires existants (`booking-lifecycle.test.ts`) à
compléter par des cas multi-fuseaux (`TZ=Africa/Douala`, `TZ=Pacific/Kiritimati`).

---

### F11 🟡 — « Supprimé » et « suspendu » restent indiscernables dans l'administration

**Problème (confirmation de T-230 + angle nouveau).** La suppression de compte anonymise
réellement l'identité : `DELETE /api/users/me` remplace l'e-mail par
`deleted-<sha256[:16]>@anonymized.local` et les noms par « Supprimé »
(`src/app/api/users/me/route.ts:154-175`). Comme la suspension, elle s'appuie sur `deleted_at`.
La liste admin en déduit un simple état « suspendu » (`src/components/bulk/users-manager.tsx:85-86,250`)
et affiche le bouton **Réactiver** pour les deux cas : réactiver un compte anonymisé remet un
compte « actif » dont l'e-mail de connexion n'existe plus — un zombie que personne ne peut
utiliser ni contacter.

**Impact.** Un administrateur croit restaurer un accès ; l'utilisateur supprimé qui revient ne
peut plus jamais se connecter (son e-mail a changé) et aucune trace d'interface ne l'explique.

**Correctif non régressif.** Faire partie du correctif T-230 : séparer `suspended_at` (avec
motif, réversible) et `deleted_at` (suppression/anonymisation, non réversible) ; masquer
« Réactiver » sur un compte supprimé (afficher « Compte supprimé (anonymisé) ») ; conserver les
journaux. Migration additive, aucun changement pour les comptes actifs.

---

### F12 🟡 — Analytics : période figée et aucun export

**Problème.** `/dashboard/analytics` calcule tout sur « 30 derniers jours glissants vs 30-60
jours » en dur (`src/app/dashboard/analytics/page.tsx:24-25,48-55`) : pas de sélecteur de période,
pas d'export CSV, pas de comparaison annuelle, alors que le reste du back-office en propose
(export factures/versements, export réservations). Les indicateurs (revenus, panier moyen,
occupation, sources) sont corrects mais l'utilisateur ne peut pas répondre à « et le mois
dernier ? ».

**Impact.** Les décisions d'hôte reposent sur une fenêtre unique, non partageable (aucun export
pour un comptable ou un partenaire).

**Correctif non régressif.** Ajouter `?from&to` (défaut = 30 derniers jours → comportement
actuel inchangé) avec deux champs de date et un bouton d'export CSV réutilisant le style des
exports existants ; les agrégats restent calculés côté serveur, aucune migration.

---

### F13 🟡 — Erreurs d'API : la première seulement, et des champs inconnus acceptés en 200

**Problème.** `frenchZodMessage()` (`src/lib/http.ts:145-158`) ne retourne **que la première**
erreur de validation : un formulaire qui envoie trois champs invalides ne reçoit qu'un message,
et l'UI ne peut pas annoter les champs. Par ailleurs les schémas de mutation ne sont pas
`strict()` : `PUT /api/bookings/[id]` avec `{ "paymentStatus": "paid" }` répond **200 OK** en
ignorant silencieusement le champ (vérifié : statut de paiement inchangé en base), de même qu'un
client qui enverrait `{ "statut": "cancelled" }`.

**Impact.** Effet de serrage : l'utilisateur corrige une erreur, en découvre une autre ; une
intégration mal écrite croit avoir changé un état qui n'a pas bougé (faux sentiment de succès,
support).

**Correctif non régressif.** Retourner un tableau `issues` **en plus** du message (champ additif
`details`/`fieldErrors`), et passer les schémas de mutation en `.strict()` là où un champ inconnu
signale une erreur d'appel (le refus explicite en 400 est plus sûr qu'un succès trompeur) — en
conservant l'acceptation des champs legacy documentés (ex. `payOnline`).

---

## 4. Vérifié OK (fausses pistes écartées, pour éviter de refaire le travail)

| Vérification | Résultat |
|---|---|
| Boutons morts (`<Button>` sans action hors lien/formulaire) | **0** sur tous les TSX |
| Liens internes (crawl par rôle : 124 liens distincts) | **0 cassé** (200/307 attendus) |
| `TODO` / `FIXME` / « bientôt » dans le code produit | 0 (hors libellés marketing assumés) |
| Cohérence recherche ↔ réservation | la recherche applique la même règle de chevauchement que la réservation (`room_availability` + `bookings`, pending inclus) : aucune disponibilité fantôme |
| Messages d'erreur de réservation (dates passées, inversées, capacité, chambre inconnue) | explicites et en français (« La date de départ doit être postérieure… », « Cette chambre accepte au maximum 2 adultes ») |
| Tunnel invité vs connecté | champs d'identité pré-remplis et **verrouillés** quand un compte est connecté (`readOnly`) : pas de confirmation envoyée à un tiers |
| « Écrire à l'hébergeur » | ouvre bien une conversation interne (`POST /api/conversations`), pas un `mailto` |
| `/reservation` sans paramètres | message clair + bouton « Rechercher un hébergement » (pas d'impasse) |
| Permission croisée | 403 homogènes (audit/hosts admin, export facturation hôte, `PUT` chambre par voyageur) |
| Suspension : message de connexion | explicite (« Ce compte est désactivé… »), sessions révoquées |
| Rate-limits sensibles | présents (login, register, mot de passe, avis, uploads, providers, audit…) — seul `bookings` pose problème (F4) |
| Livraison d'e-mails | le cron réel livre les `email_outbox` (`sent`, `attempts=1`) ; les gabarits forcent UTC (dates d'e-mail justes) |
| Wishlists / favoris / avis utiles / 2FA / factures de séjour | branchés et fonctionnels (aucun `href="#"`, aucune action fantôme) |
| Base après sondes | remise à l'état seed exact (8 users / 8 biens / 33 réservations / 24 avis ; compteurs 0 ; 1 `app_settings`) |

---

## 5. Ordre d'implémentation proposé

1. **Lot « dates & fuseaux »** — F1 + F10 + F9 (même correctif de fond : dates civiles normalisées,
   helpers uniques, tests multi-fuseaux). Aucune migration.
2. **Lot « disponibilité & annonces »** — F2 (cascade de suspension) + F6 (notifications de
   validation) : les deux touchent les annonces et le même parcours hôte.
3. **Lot « tunnel de réservation »** — F3 (expiration paresseuse) + F4 (quota) + F5 (heure
   d'arrivée) : cœur métier, un seul fichier de route principalement.
4. **Lot « confiance & conformité »** — F7 (noindex/expiration wishlist) + F8 (désabonnement) +
   F11 (fusion T-230).
5. **Lot « finitions »** — F12 (période/export analytics) + F13 (erreurs d'API).

Chaque lot est indépendant, testable seul et sans régression : aucune migration destructive,
aucun changement de contrat d'API existant (uniquement des champs additifs), i18n fr/en pour tout
nouveau libellé.

---

## 6. Annexe — commandes de reproduction

```bash
# F1 — décalage de date selon le fuseau du navigateur
TZ=America/Los_Angeles node -e "console.log(new Intl.DateTimeFormat('fr-FR',{day:'numeric',month:'long'}).format(new Date('2026-09-24T00:00:00.000Z')))"   # → 23 septembre
TZ=UTC                node -e "…"                                                                                                                     # → 24 septembre

# F1/F10 — dépendance au fuseau serveur à la lecture d'une colonne date
TZ=Africa/Douala node -e "const {Client}=require('pg'); …"   # check_in '2026-09-24' → 2026-09-23T23:00Z

# F2 — suspension d'hôte : annonce toujours servie
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/hebergement/appartement-montmartre   # 200 après suspension

# F3 — demande en attente bloque les mêmes dates (2e appel) → 409 « n'est plus disponible »

# F4 — quota : 6 essais invalides puis une demande valide → 429 (Retry-After non affiché)

# F5 — champ jamais relu
grep -rn "estimatedArrival" src | grep -v "reservation-form\|api/bookings\|schema.ts"   # → rien

# F7 — page partagée sans noindex
grep -n "robots" "src/app/(main)/wishlists/share/[token]/page.tsx"                       # → rien

# F8 — promesse vs réalité
grep -n "Opposition" "src/app/(main)/confidentialite/page.tsx"                           # → « depuis l'onglet Notifications »
grep -n "priceAlertEnabled" src/components/notification-prefs-section.tsx                # → seule préférence

# F13 — champ inconnu accepté
curl -s -X PUT -H 'content-type: application/json' -b <cookie-hôte> \
  -d '{"paymentStatus":"paid"}' http://127.0.0.1:3000/api/bookings/<id>                  # → 200, base inchangée
```
