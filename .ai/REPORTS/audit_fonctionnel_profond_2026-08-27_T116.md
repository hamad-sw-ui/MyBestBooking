# 🔍 Audit fonctionnel profond — scénarios & éléments inachevés / mal pensés

> Date : 2026-08-27 · Méthode : **exécution réelle** (Postgres + serveur Next +
> seed, 3 rôles customer/host/admin) + lecture de code. Chaque constat est
> vérifié par un appel HTTP ou un test de rendu, jamais supposé depuis la doc.
> Principe directeur : **ne rien casser** — toutes les solutions proposées sont
> additives ou restrictives, sans changement de contrat pour ce qui marche.

## Méthode & couverture

- Crawl HTTP des **35 pages** (publiques, client, host, admin) avec les 3
  sessions → toutes répondent.
- Tests RBAC : client sur `/dashboard/*`, host sur routes admin-only.
- Tests de cas limites API : recherche, réservation, messages, factures.
- Scan statique : liens morts (`href="#"`), boutons sans handler, `TODO`,
  `console`, états `disabled/loading`.

## Ce qui est déjà solide (à NE PAS toucher)

| Domaine | Constat vérifié |
|---|---|
| RBAC | Layout dashboard redirige les clients (server-side) ; pages `/dashboard/users` & `/dashboard/audit` réservées admin (redirect) ; API admin → **403 pour host** ; messages protégés IDOR (`checkParticipant`) ; pièces jointes vérifiées par propriétaire. |
| Validation booking | Dates passées → 400 ; `checkOut < checkIn` → 400 ; `numAdults=0` → 400 ; surcapacité → **409** ; chambre d'une autre propriété → `rooms.propertyId` imposé (l.125) ; chambre inexistante → 400. |
| États « introuvable » | Hébergement, conversation, réservation, chambre, wishlist inexistants → message 404 explicite rendu (HTTP 200 + contenu 404 correct). |
| Checkout | Capacité adultes/enfants **bornée** par `room.maxAdults/maxOccupancy` ; params manquants → écran de repli ; promo + wallet branchés. |
| États de chargement | **Tous** les boutons qui font un `fetch` ont un état `disabled/loading/busy` (scan : 0 manquant). |
| Footer / liens | Aucun lien mort (R19 respectée) ; liens non implémentés volontairement en texte grisé. |
| Settings admin | Chaque section envoie son objet complet et valide via Zod ; la section billing expose bien les 7 champs légaux (T-116). |

---

## 🟠 DÉFONCTIONNELS (comportement faux) — à corriger en priorité

### A1 — L'API `/api/properties?guests=N` ignore le filtre de capacité
**Sévérité : haute (résultats de recherche trompeurs)**

**Preuve d'exécution**
```
GET /api/properties?guests=2  → 8 propriétés (8 avec chambre compatible)
GET /api/properties?guests=6  → 8 propriétés dont 0 avec chambre compatible  ❌
GET /api/properties?guests=99 → 8 propriétés, toutes minPrice=null, roomCount=0 ❌
```
En base, les chambres ont `max_occupancy` de 2 (×16), 3 (×4), 4 (×2). Aucune
ne loge 6 personnes, pourtant l'API renvoie quand même les 8 hébergements.

**Cause racine** (`src/app/api/properties/route.ts`, l.88-132)
Le filtre capacité est posé comme condition d'un **LEFT JOIN** :
```ts
.leftJoin(rooms, and(...roomJoinConds))   // rooms.max_occupancy >= N
.groupBy(properties.id)
```
Un LEFT JOIN conserve **toutes** les propriétés, même celles dont aucune
chambre ne satisfait la condition (elles apparaissent avec `roomCount=0`,
`minPrice=null`). La propriété n'est jamais exclue.

**Pourquoi la page `/recherche` est correcte mais pas l'API**
La page `/recherche` utilise son propre SQL avec un prédicat d'existence
(`eligibleRoomPredicate` → `EXISTS`/jointure interne) : `guests=6` affiche
bien « Aucun hébergement ». Mais l'API (consommée par le checkout, de futurs
clients mobiles, les tests, les intégrations) renvoie des résultats
impossibles à réserver.

**Solution sans régression**
Dans `GET /api/properties`, après l'agrégation, **exclure les propriétés
dont `roomCount === 0` uniquement quand un filtre de capacité ou de prix est
actif** (pour ne pas changer le comportement non filtré) :
```ts
// après la récupération de rows / avant map
if (guests) {                       // un filtre capacité est demandé
  filteredResults = filteredResults.filter((p) => p.roomCount > 0);
}
```
Variante plus propre (SQL) : passer la condition capacité en `where`
d'existence via `sql.exists(...)` plutôt qu'en condition de LEFT JOIN.
Le filtre prix garde son comportement actuel (les `minPrice=null` sont déjà
écartés par `p.minPrice !== null`). Aucun impact sur la page `/recherche`
(chemin SQL distinct), ni sur l'admin (il consomme les routes détail).

**Test de non-régression** : `guests=2` → toujours 8 ; `guests=6` → 0 ;
recherche sans filtre → toujours 8.

---

### A2 — Paramètres de recherche invalides silencieusement ignorés par l'API
**Sévérité : moyenne (pas de plantage, mais résultats mensongers + confusion)**

**Preuve d'exécution**
```
checkIn=2026-12-10&checkOut=2026-12-05  (dates inversées) → 200 + 8 résultats  ❌
guests=-5                                                → 200 + 8 résultats  ❌
guests=abc                                               → 200 + 8 résultats  ❌
page=999                                                 → ignoré (pas de total) ~
```
Les filtres incohérents sont ignorés au lieu de produire une réponse vide ou
une 400 explicite.

**Cause racine** (`route.ts`)
- Le bloc disponibilité est gardé par `... && checkOut > checkIn` : si les
  dates sont inversées, la condition saute et **aucun filtre de date n'est
  appliqué** → toutes les propriétés reviennent.
- `guests` : `if (Number.isFinite(g) && g > 0)` — un `guests` négatif ou non
  numérique est silencieusement écarté (le filtre ne s'applique pas).
- Pas de borne sur `limit`/`offset` ; le paramètre `page` n'existe pas
  (l'API utilise `limit/offset` mais ne renvoie pas de `total`).

**Solution sans régression**
1. Garder le caractère tolérant de l'API (ne pas casser d'éventuels
   appelants), mais corriger la **sémantique** :
   - Dates inversées/invalides → ne pas appliquer le filtre de date **et**
     renvoyer `{ properties, warning: "dates_invalides" }` OU plus simple :
     traiter comme « aucune disponibilité » quand au moins une date est
     fournie mais incohérente (retourner `[]` si les deux sont présentes et
     `checkOut <= checkIn`).
   - `guests` non positif/non numérique → réponse `400` avec message clair
     (`"guests doit être un entier positif"`), puisque c'est un paramètre de
     filtre explicite.
2. Ajouter un `total` dans la réponse (`count` global) pour que la pagination
   future soit possible ; ne change rien aux appelants existants (champ
   ajouté).

Le plus sûr et le moins risqué : ajouter la validation en tête de handler et
retourner `400` sur `guests` invalide, `[]` sur dates incohérentes (ces deux
cas ne correspondent à aucune utilisation légitime actuelle).

---

## 🟡 ERGONOMIE / « MAL PENSÉ » (ça marche mais l'expérience piège l'utilisateur)

### B1 — Sélecteur « Adultes » de la carte de réservation : 6 choix quelle que soit la chambre
**Sévérité : moyenne**

Sur la fiche hébergement, `PropertyBookingCard` propose systématiquement
**1 à 6 adultes** (`[1,2,3,4,5,6]`, `property-booking-card.tsx` l.65), alors
que la `room` transmise à la carte ne contient que `{ id, basePrice, currency }`
— **la capacité n'est pas connue**. Un utilisateur peut choisir 4 adultes pour
une chambre de 2, cliquer « Voir les disponibilités », et n'être recadré
qu'au checkout (qui borne à `maxAdults`). Le retour arrive tard, après
navigation.

**Solution sans régression**
- Étendre le type `room` de la carte avec `maxAdults?: number` (optionnel →
  aucun appelant cassé) et le renseigner depuis la page hébergement (la
  donnée `rooms.maxAdults` existe déjà).
- Générer les options `[1..min(6, maxAdults)]` quand la capacité est connue,
  garder `[1..6]` sinon (repli).
- C'est purement déductif ; la validation serveur reste la garde-fou
  (inchangée).

### B2 — CTA « Voir les disponibilités » sans chambre choisie redirige en silence
**Sévérité : faible-moyenne**

Si `room` est `null` (aucune chambre dérivable), le lien devient
`/recherche` (fallback silencieux). L'utilisateur clique et se retrouve sur
la recherche sans explication.

**Solution sans régression** : quand `room` est null, désactiver le bouton
avec un libellé explicite (« Aucune chambre disponible ») au lieu d'un lien
muet vers `/recherche`. Aucun changement de route.

### B3 — Recherche d'accueil sans champ « voyageurs »
**Sévérité : faible**

Le formulaire de la home (`/`) envoie `city/checkIn/checkOut` mais pas de
`guests` ; la recherche se fait donc avec la capacité par défaut. Un
voyageur à 4 personnes ne peut pas le préciser dès l'accueil.

**Solution sans régression** : ajouter un `<select name="guests">` (1-8) au
formulaire de la home — champ déjà supporté par `/recherche` et lu par
`readReservationParams`. Pure addition.

### B4 — Analytique hôte incomplète (occupancy & comparaison)
**Sévérité : faible (déjà connue, PAR-013)**

`/dashboard/analytics` calcule le revenu 30 j et sa variation vs 30 j
précédents, mais n'affiche pas le **taux d'occupation** (le mot apparaît dans
la maquette mais sans donnée réelle). Ce n'est pas un bug, c'est une métrique
annoncée non livrée.

**Solution sans régression** : calculer l'occupation côté serveur (nuits
réservées confirmées / nuits vendables sur le parc de chambres de l'hôte sur
la période) et l'ajouter comme nouvelle carte. Additif, ne touche pas au
revenu existant.

---

## 🟢 CHOIX PRODUIT À CONFIRMER (pas un bug, mais à décider en connaissance)

### C1 — Les avis sont auto-approuvés dès publication
`POST /api/reviews` insère `status: "approved"` (l.121) pour un avis lié à un
séjour vérifié éligible. Il n'y a donc **pas de file de modération à la
création** ; la modération admin (`/api/reviews/[id]/moderate`) n'intervient
qu'a posteriori. C'est cohérent avec le fait que l'avis est vérifié (séjour
réel, un seul avis par réservation, rate-limit 20/h), mais à confirmer comme
choix assumé. Sinon, basculer en `status: "pending"` à l'insertion est un
changement d'une ligne (l'admin et l'agrégat gèrent déjà les statuts).

### C2 — Paiement en mode `mock` en l'absence de clés Stripe
En dev/sans `STRIPE_SECRET_KEY`, `createPaymentIntentForBooking` bascule en
pseudo-carte qui réussit immédiatement. C'est attendu pour le sandbox, mais
l'écran ne doit jamais être déployé avec ce mode en production. Déjà tracé
dans KNOWN_LIMITATIONS ; aucun changement de code requis ici (garde-fou
d'environnement à conserver).

---

## 📋 Plan d'action recommandé (ordre ROI / risque)

| # | Constat | Sévérité | Effort | Risque régr. | Décision |
|---|---|---|---|---|---|
| A1 | Filtre capacité API inefficace (LEFT JOIN) | Haute | ~15 lignes | Très faible (filtre additif) | **À corriger** |
| A2 | Paramètres recherche invalides ignorés | Moyenne | ~20 lignes | Faible (validation en tête) | **À corriger** |
| B1 | Sélecteur adultes non borné carte | Moyenne | ~10 lignes | Nul (champ optionnel) | À corriger |
| B2 | CTA sans chambre → redirection muette | Faible | ~5 lignes | Nul | À corriger |
| B3 | Home sans champ voyageurs | Faible | ~8 lignes | Nul (champ ajouté) | À corriger |
| B4 | Occupation analytics manquante | Faible | ~30 lignes | Nul (carte ajoutée) | Backlog |
| C1 | Auto-approbation des avis | Décision | 1 ligne | — | À confirmer |
| C2 | Mock paiement | Décision | — | — | Déjà documenté |

Toutes les corrections A/B sont **additives ou restrictives** : elles ne
modifient aucun contrat d'API ou de page qui fonctionne aujourd'hui, et
chaque correction est vérifiable par 3 appels curl (avant/comportement
filtré/après) + smoke 91/91 + tests.

> Aucune modification de code n'a été appliquée dans ce rapport : il s'agit
> d'une analyse. Les corrections A1/A2/B* peuvent être enchaînées en une
> passe T-119 sans toucher aux parcours validés (auth, messagerie, checkout,
> calendrier, 2FA, modération, factures).
