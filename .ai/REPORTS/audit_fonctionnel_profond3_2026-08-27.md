# 🔍 Troisième audit fonctionnel profond — scénarios & éléments inachevés / mal pensés

> Date : 2026-08-27 (après T-120). Méthode : **exécution réelle** (Postgres +
> Next + seed, sessions customer/host/admin), sur les zones peu explorées les
> fois précédentes : wallet/BestRewards/parrainage, checkout invité & reprise
> de paiement, cron de clôture/séjour, webhook Stripe, uploads privés, mode
> maintenance, pagination/filtres de l'API, vote utile, sitemap/robots. Chaque
> constat est vérifié par un appel HTTP ou un log SQL, jamais supposé.

## Couverture vérifiée (solidité confirmée — à ne pas casser)

| Flux | Constat à l'exécution |
|---|---|
| Wallet au checkout | `useWalletCredits` débite bien le solde (25 € → 0), avec garde-fous `Math.min(wallet, total)` et `Math.max(0, …)`. |
| Remises BestRewards | Niveau 2 → 15 % (10/15/20 par niveau), +2 % sur propriété BestRewards (plafonné 30 %) ; calcul cohérent sur la réservation test (subtotal 178 → discount 54,37 totalisant BestRewards + wallet). |
| Cashback / fidélité | `calculateLoyaltyAward` crédite le wallet **à la clôture du séjour** (post-check-out), pas à l'achat ; attribution unique (`loyaltyAwardedAt`), non rétroactive. Exécuté par le **cron journalier** `/api/cron/price-alerts` (GET, idempotent, protégé par `CRON_SECRET` en prod, déclaré dans `vercel.json`). Le cron remplit aussi la clôture → **condition de l'éligibilité aux avis**. |
| Guest checkout | Crée un profil après toutes les validations ; email existant → **409** « Connectez-vous » (anti-détournement) ; email de réclamation `guest_claim` envoyé (lien de création de mot de passe, expire 24 h) → donne accès aux réservations/factures. |
| Webhook Stripe | Signature invalide → **400** « Invalid signature ». |
| Uploads privés | Type MIME whitelist (texte → 400), images OK ; accès pièce jointe sans session → **401**. |
| Mode maintenance | Écritures transactionnelles bloquées (reviews → **503** `MAINTENANCE_MODE`) ; `/api/auth/*` et `/api/admin/*` en whitelist anti-lockout (volontaire). |
| Vote « utile » | Anonyme → 401 ; customer → 200 (compteur incrémenté). |
| Tri | `sort=price_asc&guests=2` → prix strictement croissants (89…148). |
| Messagerie | `GET /api/messages` sans `conversationId` → **400** explicite ; liste des conversations OK ; IDOR protégé. |
| SEO | `sitemap.xml` liste les 8 hébergements actifs ; `robots.txt` interdit `/api/`, `/dashboard/`, `/mon-compte/`. |
| RBAC booking/host | host voit 36 réservations (ses biens), customer voit les siennes ; facture guest accessible à l'hôte (200) mais pas à un tiers (403). |

---

## 🟠 DÉFONCTIONNELS

### F1 — L'API `/api/properties` plante en 500 sur des paramètres numériques invalides
**Sévérité : moyenne-haute (erreurs serveur + bruit de monitoring sur une API publique)**

**Preuve d'exécution** (confirmée par les logs Postgres) :
```
GET /api/properties?offset=-10   → 500   ERROR: OFFSET must not be negative
GET /api/properties?minRating=abc → 500  ERROR: invalid input syntax for type numeric: "abc"
GET /api/properties?limit=-5     → 200 mais ignore la limite (renvoie 8)
GET /api/properties?limit=abc    → 200 mais retombe sur la limite par défaut
```
**Cause racine** (`src/app/api/properties/route.ts`)
- `const limit = parseInt(...)` et `const offset = parseInt(...)` sont passés
  directement à `.limit()` / `.offset()` sans borne : un `offset` négatif
  lève une erreur PostgreSQL (`OFFSET must not be negative`) non capturée
  comme erreur de requête.
- `minRating` est injecté tel quel dans
  `sql\`${properties.averageRating} >= ${minRating}\`` : une valeur non
  numérique (`abc`) produit une erreur de cast SQL.
- Un `limit` négatif est silencieusement accepté (comportement dépend du
  driver) et un `limit` non numérique est ignoré.

C'est le même famille que le D1/T-120 (entrées non validées → 500), mais
cette fois sur une route **GET publique de lecture**.

**Solution sans régression**
Normaliser/borner les paramètres numériques en tête de handler :
```ts
const rawLimit = parseInt(searchParams.get("limit") || "20", 10);
const rawOffset = parseInt(searchParams.get("offset") || "0", 10);
const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;
const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

const minRatingRaw = searchParams.get("minRating");
const minRating = minRatingRaw !== null ? Number(minRatingRaw) : null;
if (minRatingRaw !== null && (!Number.isFinite(minRating) || minRating < 0 || minRating > 10)) {
  return NextResponse.json({ error: "minRating doit être un nombre entre 0 et 10" }, { status: 400 });
}
// et utiliser la valeur numérique bornée dans sql`... >= ${minRating}`
```
De même pour `minPrice`/`maxPrice` (déjà filtrés en JS via `parseFloat`, mais
un `minPrice=abc` produit `NaN` et un filtrage incohérent — à borner aussi).
Aucun appelant valide n'est affecté (les valeurs correctes gardent le même
résultat) ; seules les valeurs aberrantes passent de 500/comportement
silencieux à 400 propre ou valeur par défaut bornée.

---

## 🟡 ERGONOMIE / « MAL PENSÉ »

### F2 — La liste `/api/properties` ne renvoie pas de `total` (pagination infaisable côté client)
**Sévérité : faible-moyenne**

La réponse est `{ properties: [...] }` sans nombre total ni métadonnées de
pagination. Un client (mobile, future intégration) qui consomme l'API ne
peut pas savoir s'il existe une page suivante ni construire une pagination
correcte. La page `/recherche` utilise son propre SQL (avec sa pagination),
donc aucun écran actuel n'est cassé, mais l'API publique est incomplète.

**Solution sans régression** : ajouter un champ `total` (et éventuellement
`limit`/`offset` retournés) à la réponse, calculé sur la même condition que
le filtre (avant `.limit()`). Champ **ajouté** → aucun appelant existant
cassé.

### F3 — La recherche n'expose pas la devise du prix
**Sévérité : faible**

Chaque propriété renvoie `minPrice: 89` mais **pas** de champ `currency`.
Les chambres ont une devise en base (`rooms.currency`), mais l'agrégat de
l'API ne la restitue pas. Un client ne peut donc pas afficher « 89 € » ou
« 89 $ » de façon fiable (l'application web suppose EUR par défaut).

**Solution sans régression** : exposer la devise (celle de la chambre la
moins chère, ou la devise par défaut de la propriété) dans l'objet liste.
Champ ajouté, sans impact sur l'existant.

---

## 🟢 CONSTATS / CHOIX À ASSUMER (pas un bug)

- **Cron de clôture = point de bascule avis/cashback** : l'éligibilité aux
  avis (`isReviewEligible`) exige `status="completed"`, qui n'est posé que
  par le cron journalier (ou une action admin/host). C'est fonctionnel et
  idempotent, mais dépend de l'exécution planifiée (`vercel.json` 0 8 * * *).
  À garder en tête à la mise en prod : si le cron ne tourne pas, les avis
  post-check-out ne se débloquent pas. Aucun code à changer ici.
- **Maintenance** : seules les écritures transactionnelles critiques
  (réservation, avis, upload, promo apply) sont gelées ; wishlists/messages/
  profil restent ouverts. Choix discutable mais volontaire (le blocage est
  ciblé sur les flux monétaires). Documenté comme tel.
- **B4** (taux d'occupation analytics) reste le seul gap métier connu côté
  dashboard (déjà backlog aux audits 1 et 2).

---

## 📋 Plan d'action recommandé

| # | Constat | Sévérité | Effort | Risque régr. | Décision |
|---|---|---|---|---|---|
| F1 | Pagination/filtres numériques non bornés → 500 (offset négatif, minRating non numérique, limit négative) | Moy-haute | ~20 lignes | Très faible (bornage additif) | **À corriger (T-121)** |
| F2 | Liste sans `total` (pagination client impossible) | Faible-moyenne | ~5 lignes | Nul (champ ajouté) | À corriger |
| F3 | Prix sans devise dans la recherche | Faible | ~5 lignes | Nul (champ ajouté) | À corriger |
| B4 | Taux d'occupation analytics | Faible | ~30 lignes | Nul | Backlog |

> Analyse uniquement, aucun code modifié. Les correctifs F1/F2/F3 sont
> courts, isolés à la route `GET /api/properties`, vérifiables par 6 appels
> curl (offset/minRating/limit limites + présence `total`/`currency`) +
> smoke 91/91 + 228 tests, sans toucher aux parcours validés (auth,
> réservation, wallet, cron, webhook, uploads, maintenance, factures).
> Données d'audit nettoyées en base (réservations/wishlist/user invité/
> upload de test supprimés, vote utile remis à 0, maintenance désactivée).
