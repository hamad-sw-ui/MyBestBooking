# 🔍 Quatrième audit fonctionnel profond — scénarios & éléments inachevés / mal pensés

> Date : 2026-08-27 (après T-121). Méthode : **exécution réelle** en dev ET en
> **build de production** (`next start`) — Postgres embarqué :55432, seed
> (8 hébergements), sessions réelles pour les **3 rôles** (customer / host /
> admin) + anonyme. Chaque constat est prouvé par un appel HTTP, un en-tête de
> réponse ou un log Postgres, jamais supposé.

---

## Couverture vérifiée (solidité confirmée — à NE PAS casser)

| Zone | Constat à l'exécution |
|---|---|
| **RBAC côté API** | Toutes les API sensibles refusent le mauvais rôle : admin/* → **403** customer ; `POST /api/properties` customer → **401** ; `POST /api/rooms` customer → **401** ; `POST /api/promotions` host **et** customer → **403** ; `POST /api/properties/upload` customer → **403** ; `POST /api/properties/[id]/validate` customer → **403** ; PATCH suspend host → **403** ; `billing/export` customer → **403**. |
| **IDOR** | Facture d'une réservation d'autrui (`/api/bookings/<uuid-autrui>/invoice`) → **404** « Réservation non trouvée » ; vote utile anonyme → 401. Cloisonnement host (ses biens) / customer (ses réservations) respecté. |
| **Avis** | Avis sur `bookingId` inexistant → **404** « Réservation non trouvée » ; schéma strict (`overallRating` 1–10, `bookingId` UUID) ; un anonyme lit les avis **approuvés** uniquement ; modération/réponse réservées (mauvais verbe → 405). |
| **Auth** | Login identifiants inconnus → **401** message générique ; `forgot-password` renvoie un message **identique** que l'email existe ou non (anti-énumération ✅) ; `change-password` : ancien mdp faux → 400, mdp < 8 car. → 400 ; 2FA setup → secret TOTP seulement après mot de passe ; register doublon → **400** « Un compte existe déjà ». |
| **Profil** | L'**email n'est pas modifiable** via `PATCH /api/users/me` (géré par un flow dédié) → pas de collision/prise de contrôle silencieuse. |
| **Validation d'entrée** | Corps JSON vide/mal formé → 400 (T-120) ; `GET /api/reviews` borne déjà `limit`/`offset` via `z.coerce.number()` (cette route est le **bon exemple** à dupliquer). |
| **Redirection post-login** | Le formulaire de connexion route bien host/admin → `/dashboard`, customer → `/` (et respecte `?next=` via `safeNextPath`, anti-open-redirect). |
| **Taux d'occupation** | Le dashboard analytics **calcule réellement** `occupiedNights / potentialNights` (`analytics/page.tsx:96`) — l'ancien gap B4 est en fait couvert. |
| **Pages d'erreur** | `/hebergement/<slug-inconnu>`, `/mes-reservations/avis/<id-inconnu>`, `/wishlists/share/<token-invalide>` (API → 404) affichent une page `not-found.tsx` dédiée. |
| **Liens morts / UI morte** | Aucun `href="#"`, aucun `onClick={() => {}}` ; R19 (ai:check) : les 41 routes internes sont valides. |
| **Pages légales** | mentions-legales (2,3k car.), confidentialité (2,8k), aide (1,1k) : contenu réel. |

**Conclusion importante** : le **niveau API est sain** (contrôle d'accès et
validation solides). Les déficiences ci-dessous sont de deux familles :
(G1) routes API GET qui **planchent en 500** sur un identifiant mal formé ;
(G2) la **garde de rôle des pages** dashboard ne s'applique pas au
plein-chargement (l'API reste le rempart, donc **aucune fuite de données**).

---

## 🟠 DÉFONCTIONNELS

### G1 — Routes API GET dynamiques : un identifiant non-UUID fait planter en 500

**Sévérité : moyenne** (erreurs serveur + bruit de monitoring sur des routes
authentifiées ; déclenchable par un lien mal copié, un id tronqué, ou un test).

**Preuve d'exécution** (build de production `next start`, vérifié aussi en dev) :

```
GET /api/rooms/abc                     -> 500   (cust, host ET admin)
GET /api/properties/abc                -> 500
GET /api/bookings/abc                  -> 500
GET /api/rooms/abc/rate-plans          -> 500
GET /api/rooms/abc/availability        -> 500
GET /api/bookings/abc/invoice          -> 500
GET /api/bookings/abc/cancellation     -> 500
GET /api/messages/attachments/abc      -> 500
```

Log Postgres associé (capture réelle) :

```
error: invalid input syntax for type uuid: "abc"
  code: '22P02',  file: 'uuid.c',  routine: 'string_to_uuid'
  where: "unnamed portal parameter $1 = '...'"
```

Alors que les **mêmes routes avec un UUID bien formé mais inexistant**
répondent proprement :

```
GET /api/rooms/00000000-0000-0000-0000-000000000000                  -> 404 "Chambre non trouvée"
GET /api/rooms/00000000-…/rate-plans                                -> 404 "Introuvable"
GET /api/properties/00000000-…                                      -> 404
GET /api/bookings/00000000-…/invoice                                -> 404
```

`/api/wishlists/shared/abc` renvoie déjà **404** : cette route valide
l'identifiant (le token n'est pas un UUID) — c'est l'exception qui montre la
règle à généraliser.

**Cause racine** : les handlers passent directement `params.id` (une string
arbitraire depuis l'URL) à une comparaison Drizzle sur une colonne `uuid`
(`eq(table.id, id)`). Postgres tente `string_to_uuid('abc')`, lève `22P02`, et
l'erreur n'est pas traduite en réponse 4xx — elle remonte en 500. C'est la
**même famille que F1/T-121** (entrée non validée → 500), mais sur les routes
par identifiant.

**Solution sans régression**
Ajouter un garde-fou partagé, par ex. un petit helper `isUuid` (ou une
réutilisation de Zod `z.string().uuid()`) en tête de chaque handler GET/PATCH
dynamique, et renvoyer **400** (identifiant mal formé) avant toute requête SQL :

```ts
// src/lib/http.ts (existe déjà — y ajouter)
import { z } from "zod";
export const uuidParam = z.string().uuid();
// dans la route :
const parsed = uuidParam.safeParse((await params).id);
if (!parsed.success) {
  return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
}
const id = parsed.data;
```

- **400** pour un identifiant syntaxiquement invalide, **404** pour un UUID
  valide absent : sémantique REST correcte.
- Le garde-fou est placé **avant** le contrôle de rôle ou juste après — ne
  change aucun comportement pour les appels valides (UUID corrects).
- Aucun impact sur les pages (qui envoient des UUID réels).
- Alternative minimale : un wrapper qui transforme l'erreur Postgres `22P02`
  en 400 dans le `catch` des routes concernées. Préférer la validation en
  amont (Zod), plus explicite et testable.

Routes à couvrir : `rooms/[id]` (GET/PATCH/DELETE),
`rooms/[id]/rate-plans`, `rooms/[id]/availability`, `properties/[id]`,
`bookings/[id]`, `bookings/[id]/invoice`, `bookings/[id]/cancellation`,
`messages/attachments/[id]`, `price-alerts/[id]`, `promotions/[id]`,
`reviews/[id]/*`, `users/[id]/suspend`, `admin/settings/[key]`.

---

### G2 — La garde de RÔLE des pages `/dashboard/*` ne s'applique pas au plein-chargement

**Sévérité : moyenne-haute (défaut d'isolation des espaces) — mais sans fuite de
données**, car toutes les API sous-jacentes vérifient le rôle (403) et les
requêtes RSC filtrent par `hostId`/`role`.

**Preuve d'exécution** (build de **production** `next start`, pas un artefact
dev — résultats identiques en dev) :

```
CUSTOMER  GET /dashboard                 -> 200  (attendu : redirection vers /)
CUSTOMER  GET /dashboard/users           -> 200  (page admin ! attendu : redirection)
CUSTOMER  GET /dashboard/settings        -> 200  (page admin)
CUSTOMER  GET /dashboard/billing         -> 200
CUSTOMER  GET /dashboard/properties/new  -> 200  (formulaire de création de bien)
HOST      GET /dashboard/users           -> 200  (page réservée admin)
ANONYME   GET /dashboard                 -> 307 -> /connexion?next=/dashboard  ✅
ADMIN     GET /dashboard/users           -> 200  (normal)
```

Le HTML servi à un **customer** sur `/dashboard` contient la **sidebar de
l'espace hébergeur** (« Tableau de bord », « Hébergements », « Facturation »…)
et le titre de page dashboard, avec des sections « Aucune réservation ». Le
footer publie un lien « Ajouter mon hébergement » → `/dashboard/properties/new`
: un client qui clique arrive sur un **formulaire** dont la soumission échoue
(401), une impasse UX.

**Vérification de l'absence de fuite de données** (important pour le risque) :

```
/dashboard/users en customer  -> 0 email utilisateur exposé
/dashboard/bookings en cust.  -> 0 référence MBB-… d'autrui
/dashboard/analytics en cust. -> 0 chiffre/revenu exposé
API admin/hôte                -> 403 partout (voir tableau de couverture)
```

**Pourquoi le code semble correct mais ne protège pas**
- Le proxy edge (`src/proxy.ts`, ex-`middleware`) ne teste que la **validité du
  JWT** : `if (authed) return NextResponse.next()`. Or le token de session ne
  contient **que `userId`** (`new SignJWT({ userId })`), **pas le `role`** ; le
  proxy ne peut donc pas distinguer customer / host / admin.
- Les pages/layouts font `getCurrentUser()` puis `redirect()` (RSC). Mais les
  redirections RSC sont conçues pour être appliquées par le **routeur client
  lors d'une navigation `<Link>`** (le flux RSC contient `NEXT_REDIRECT`). Au
  **plein-chargement** (URL tapée / rechargement / lien externe) pour une route
  dont le proxy a déjà répondu `next()`, la redirection RSC de **layout vers une
  route hors du segment** (`/`) ne se transforme pas en 307 : le serveur rend
  l'enveloppe du dashboard (200).
- Preuve de contrôle : une **page hors-layout** qui fait `redirect("/")` pour un
  user connecté sert bien le contenu de la cible (testé par une sonde
  temporaire depuis supprimée), alors que `/dashboard` sert le dashboard.
  L'anonyme, lui, est correctement 307 — mais c'est le **proxy edge** qui le
  fait (l'URL porte `?next=`, signature du proxy), pas `redirect()` RSC.
- Plusieurs pages RSC dashboard qui requêtent par `[id]`
  (`dashboard/messages/[id]`, `bookings/[id]`, `rooms/[id]/calendrier`) font
  aussi `redirect("/dashboard")` pour un mauvais rôle : même limite au
  plein-chargement, et avec un id non-UUID elles lèvent `22P02` (l'erreur est
  alors rattrapée par le error boundary qui affiche une 404 — donc pas de crash
  visible, mais du bruit de logs).

**Solution sans régression (défense en profondeur, 2 niveaux)**

1. **Porter le rôle dans le proxy edge** (couvre le plein-chargement, c'est le
   seul endroit qui voit la requête avant le RSC) :
   - Ajouter le rôle au JWT de session : `new SignJWT({ userId, role })`
     dans `createToken`, et le lire dans `verifyToken` (retourner
     `{ userId, role }`). Les anciens tokens (sans `role`) sont traités comme
     « rôle inconnu » → la politique par défaut reste « exiger une vérification
     RSC » ; ne pas casser les sessions existantes (sinon, les utilisateurs sont
     déconnectés, ce qui est acceptable mais peut être évité en retombant sur
     `getSession` RSC).
   - Dans `proxy`, pour `/dashboard/:path*`, vérifier le rôle selon le chemin :
     - routes admin (`/dashboard/users`, `/dashboard/settings`,
       `/dashboard/audit`, `/dashboard/billing`, `/dashboard/promotions`) :
       exiger `admin` ;
     - reste du `/dashboard` : accepter `host` **ou** `admin`, sinon
       rediriger vers `/` (307, comme pour l'anonyme).
   - Le proxy reste en edge runtime (`jose` seul) : on lit le rôle **depuis le
     JWT**, sans base de données — conforme à la contrainte edge actuelle.

2. **Conserver (et fiabiliser) les gardes RSC existantes** comme seconde couche :
   elles restent nécessaires car un JWT peut être périmé/modifié et la
   révocation de session n'est vue qu'en base. Aucun changement de leur logique
   d'autorisation ; elles couvrent les navigations `<Link>` côté client.

- Cette approche **n'altère aucune API** (déjà correctes), **ne change aucune
  page** (mêmes redirections logiques) et **ne casse pas** l'accès host/admin
  (rôles ajoutés au token). Le seul comportement modifié est qu'un customer
  reçoit désormais un 307 au lieu d'un 200 trompeur.
- Tests à ajouter : `proxy.test.ts` (déjà présent) avec tokens host/admin/
  customer sur les différents segments `/dashboard` ; un test e2e/HTTP
  plein-chargement d'un customer vers `/dashboard/users` → 307.

---

## 🟡 ERGONOMIE / « MAL PENSÉ »

### E1 — Un client peut ouvrir des formulaires hôte/admin dont l'action échoue
Conséquence directe de G2 : les pages `/dashboard/properties/new`,
`/dashboard/rooms/new`, `/dashboard/promotions/new` et les réglages
s'**affichent** pour un customer (formulaires client), alors que toute
soumission renvoie 401/403. L'utilisateur remplit un long formulaire avant
d'être bloqué. **Résolu par G2** (redirection en amont) ; en complément, ces
pages clientes pourraient afficher un message « Accès réservé aux hébergeurs »
si l'API répond 401 au chargement, plutôt que de rester sur un état vide.

### E2 — Pages RSC dashboard par `[id]` : erreur `22P02` dans les logs même si l'utilisateur voit une 404
`/dashboard/messages/abc`, `/dashboard/bookings/abc`,
`/dashboard/rooms/abc/calendrier` affichent une page 404 (le error boundary
rattrape l'exception), mais l'erreur Postgres `invalid input syntax for type
uuid` est **levée et journalisée** à chaque accès (pollution du monitoring).
Même correctif que G1 mais côté serveur de pages : valider le format de l'id en
tête de page et appeler `notFound()` / `redirect()` **avant** la requête SQL.

---

## 🟢 CHOIX PRODUIT / CONSTATS MINEURS (à confirmer, aucune action requise)

- **Promotions réservées aux admin** : un `host` ne peut pas créer de code promo
  (même sur ses biens) — 403. C'est peut-être volontaire (administration
  centrale des promos), mais à confirmer contre le besoin métier « le
  propriétaire fait ses offres ».
- `GET /api/promotions/apply` exige un montant (`Montant invalide` si absent) :
  la vérification du code se fait avec le contexte de panier. Comportement
  défensif acceptable.
- `/dashboard/rooms/page.tsx` et plusieurs pages liste n'ont **pas** de garde
  `redirect()` en propre : elles reposent entièrement sur le layout. Une fois G2
  corrigé, c'est suffisant, mais ajouter la même garde en tête de page rendrait
  la protection indépendante du layout (défense en profondeur bon marché).

---

## 📋 Plan d'action recommandé

| # | Tâche | Sévérité | Rétrocompatibilité |
|---|---|---|---|
| **G1** | Valider le format UUID (Zod `uuid()`) en tête de **toutes** les routes API dynamiques → 400 au lieu de 500 | moyenne | Aucun changement pour les appels valides |
| **G2** | Ajouter `role` au JWT de session + gardes de rôle par segment dans `proxy.ts` pour `/dashboard/*` (admin vs host) ; conserver les gardes RSC | moyenne-haute | Tokens anciens tolérés (fallback RSC) ; host/admin non impactés |
| **E1** | Message « Accès réservé » dans les pages formulaire si 401 au chargement (après G2) | basse | Additif |
| **E2** | Valider l'id dans les pages RSC dashboard par `[id]` avant SQL (plus de logs `22P02`) | basse | Aucune |

**Réassurance non-régression** : toutes les déficiences relevées sont des
*ajouts de garde-fous* sur des chemins d'erreur ou d'autorisation ; le cœur
(réservation, paiement, fidélité, recherche, avis, messagerie, admin) a été
re-testé et reste vert. Aucune des corrections proposées ne modifie une réponse
pour une requête **valide**.
