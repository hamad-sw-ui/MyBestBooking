# Audit fonctionnel profond n°21 — T-146 — 2026-08-29

**Demande utilisateur :** « Faites une analyse profonde des scénarios et éléments
fonctionnels du projet à l'exécution (pages, boutons…) inachevés et/ou mal
pensés. Expliquer le problème et donnez leurs solutions sans régression pour ne
pas casser tout ce qui fonctionne déjà bien. »

Méthode : exécution réelle (DEV port 3000 puis **PROD `next start` port 3009**),
3 rôles (client `customer@`, hôte `host@`, admin `admin@`) + anonyme. On se fie
au code et au runtime, pas aux docs. Données de test créées puis **nettoyées**
(retour à 37 réservations, 0 réservation en 2028, 0 rate-plan de test, 0
propriété de test).

---

## 1. Défaut corrigé (sans régression)

### 🔨 P2 — Récapitulatif de réservation : la remise du tarif (rate plan) était comptée deux fois dans le détail

**Fichier :** `src/app/(main)/reservation/page.tsx` (répondeur de prix, ~l.659).

**Problème constaté à l'exécution / code.**
Le tunnel propose des tarifs remisés (rate plans, ex. « Non remboursable −10 % »).
Le calcul des totaux est juste :

```
pricePerNight   = room.basePrice
baseSubtotal    = pricePerNight * numNights          // tarif de base
ratePlanDiscount= baseSubtotal * discount%           // remise
subtotal        = max(0, baseSubtotal - ratePlanDiscount)
taxes           = subtotal * 0.1
total           = subtotal + taxes (− promo − wallet)
```

Mais la **première ligne du récapitulatif** affichait à droite `subtotal`
(déjà remisé) alors que son étiquette indique « N nuits × €prix/nuit » :

```
2 nuits × €118.67  .........  €213.61   ← affichait subtotal (remisé), pas le produit 2×118,67
Non remboursable -10%        −€23.73
Taxes & frais                €21.36
Total                        €211.24
```

Soit un détail **incohérent** : 213,61 − 23,73 + 21,36 = **211,24**, alors que
l'addition réelle est 237,34 − 23,73 + 21,36 = **234,97**. La remise était
soustraite une fois dans `subtotal` **et** une seconde fois sur la ligne verte.
Le **Total final était néanmoins correct** (la variable `total` est juste) et le
**serveur recalcule tout** (`/api/bookings`, testé : −10 % appliqué
237,34 → 213,61 de sous-total, taxes justes) : c'est donc purement un défaut
d'affichage de la **ligne de base**, qui trompe le client sur le détail.

**Correctif (additif, aucun calcul touché) :** afficher `baseSubtotal`
(le produit nuits × tarif) sur la première ligne ; la remise reste sur sa ligne
verte. Le détail devient alors arithmétiquement juste :

```
2 nuits × €118.67  .........  €237.34
Non remboursable -10%        −€23.73
Taxes & frais                €21.36
Total                        €234.97   (= 237,34 − 23,73 + 21,36) ✓
```

Sans rate plan, `baseSubtotal === subtotal` : aucun changement d'affichage.

**Preuves :** `tsc` 0 · `eslint` 0 (1 warning `<img>` préexistant, non lié) ·
`vitest` **288** · `smoke` **94/94** · `build` ✓ (60 pages) · `ai:check`
19 OK / 1 warn.

---

## 2. Point documenté (connu, déjà mitigé) — pas de code modifié

### ℹ️ Soft-404 : `notFound()` en streaming renvoie HTTP 200 au lieu de 404

**Constat PROD reproductible.** Une fiche hébergement inexistante/suspendue, un
token de liste partagée invalide, ou toute page qui appelle `notFound()` pendant
le rendu RSC, renvoient un **code HTTP 200** (le corps est pourtant bien la page
404). Une route totalement inexistante renvoie, elle, bien **404**.

**Cause racine (vérifiée).** Le fichier `src/app/loading.tsx` racine crée une
limite Suspense qui démarre le **streaming** immédiatement. Dès que les en-têtes
sont envoyés, le statut ne peut plus changer ; `notFound()` lancé pendant le
rendu bascule le *contenu* vers la page 404 mais le statut reste 200.
Preuve par l'expérience : en retirant temporairement `loading.tsx` puis en
rebuildant, `notFound()` renvoie bien **404** (testé sur fiche, token, et une
page de test minimale) ; `loading.tsx` a été restauré ensuite.

Doc Next 16.2.6 (`node_modules/next/dist/docs/.../loading.md`, « Status codes »)
: « When streaming, a 200 status code will be returned… Because the response
headers have already been sent, the status code cannot be updated. » Next émet
automatiquement `<meta name="robots" content="noindex">` dans le HTML streamé.

**Déjà mitigé (T-135, vérifié à l'exécution) :** les soft-404 portent bien
`<meta name="robots" content="noindex">` (fiche absente ✓, token invalide ✓)
tandis que les pages valides (accueil, fiche active) n'ont pas de `noindex`
(restent indexables). Le SEO est donc protégé.

**Impact résiduel :** uniquement l'analytics/conformité qui s'attend à un vrai
404 ; aucun risque de sécurité ni d'indexation.

**Solution sans régression (optionnelle, non appliquée ici car hors périmètre et
à risque UX) :** Next recommande de décider du 404 **avant** le streaming, via
`proxy.ts` (ex. pour `/hebergement/[slug]`, vérifier en cache que le slug
existe/est actif et produire une réponse 404 sinon) — mais cela ajoute une
vérification (DB ou cache) sur le chemin critique et demande un cache maintenu
pour ne pas alourdir chaque requête. Alternative plus coûteuse en UX : retirer/
restreindre `loading.tsx` racine (perte du spinner de chargement). **Recommandation
: conserver l'état actuel** (noindex suffisant pour le SEO) et traiter ce point
uniquement si une exigence de conformité/analytics l'exige.

---

## 3. Scénarios vérifiés à l'exécution et jugés SAINS

| Domaine | Scénario testé | Résultat |
|---|---|---|
| Paiement tunnel | mock vs Stripe, bannière démo, reprise de paiement | OK (`reservation/page.tsx` gère les deux) |
| Rate plans (API) | remise >100 → 400 ; sans `cancellationPolicy` → 400 ; client → 401 ; hôte création → 201 | validations OK |
| Rate plans (résa) | −10 % réellement appliqué serveur (237,34 → 213,61) | OK |
| Rate plans (UI hôte) | formulaire envoie bien `cancellationPolicy` (défaut « flexible ») | OK, pas de 400 silencieux |
| Contact hôte pré-résa | `ContactHostButton` crée/rouvre conversation ; anonyme redirigé connexion | OK |
| Propriété suspendue | absente de la liste publique ; fiche `notFound()` ; **réservation bloquée** « Hébergement non disponible » 400 | OK |
| Contrôle d'accès résa | GET/facture/devis annulation d'une résa d'autrui → **403** (client étranger, IDOR) | OK |
| Modération propriétés | hôte crée en `pending` (invisible public) → admin bulk `approve` → visible ; hôte `approve` → 403 ; suppression admin | OK |
| Avis | IDOR (résa d'autrui) → 403 ; résa non terminée → 400 « après un séjour terminé » | OK |
| Wishlist partage | création, passage public (token), accès anonyme 200, **rotation invalide l'ancien token** (404), repassage privé → 404, suppression | OK |
| Auth | logout → 401 ; forgot-password ne fuite pas l'existence d'un email ; reset token invalide → 400 ; change-password mauvais mdp / trop court → messages fr | OK |
| Avatar (T-145) | upload 200, retrait via PATCH `avatarUrl:null` persiste | OK |
| Recherche | 0 résultat → message dédié ; tri `sort=price_asc`/`price_desc` correct (l'UI envoie bien `sort`) ; filtre ville sans résultat | OK |
| Promotions | réservées admin (hôte redirigé 307 / API 403) | OK (conception) |
| Audit / analytics admin | API audit admin 200, hôte 403 ; page audit 200 ; dashboard analytics rend | OK |
| Facturation | `/dashboard/billing` hôte 200 ; les versements admin sont dans l'onglet facturation (pas de route `/dashboard/payouts` — URL tapée à la main, aucun lien mort) | OK |
| Liens morts | aucun `href="#"`, aucun handler vide, aucune page « bientôt disponible » (`ai:check` R18/R19 OK) | OK |

**Aucune autre régression détectée.** Le seul correctif de code de cet audit est
la ligne de récapitulatif (§1) ; le reste est sain ou déjà mitigé (§2).
