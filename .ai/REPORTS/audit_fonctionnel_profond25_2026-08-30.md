# Audit fonctionnel profond n°25 — scénarios & éléments inachevés ou mal pensés (à l'exécution)

**Date :** 2026-08-30
**Branche :** `arena/01a052ed-mybestbooking` (base `e23ae5b` — T-152)
**Méthode :** crawls HTTP réels (anonyme / customer / host / admin) sur les
**41 pages** (132 vérifications, 159 HTML capturés) + **60 routes API** +
lecture ciblée des flux critiques (paiement, wallet, promos, BestRewards,
annulation, messagerie, alertes prix, recherche, devises) + tests de parcours
de bout en bout. Pour chaque écart : **problème → preuve → solution sans
régression**. Aucune modification de code dans ce rapport.

---

## ✅ Ce qui est sain (vérifié à l'exécution)

- **RBAC pages** : anonyme → 307 `/connexion?next=…` sur les 18 pages
  dashboard ; customer → 307 `/` sur tout `/dashboard` ; host → 307
  `/dashboard` sur audit/promotions/settings/users ; admin 200 partout
  (« 200/307 » conforme T-123).
- **RBAC API** : `GET /api/bookings/[id]` → 403 non-propriétaire (sans
  fuite) ; id non-UUID → 400 (plus d'erreur 22P02) ; `PUT
  /api/properties/[id]` → 403 non-propriétaire ; `invoice` → 403 hors
  owner/host/admin ; `shared/[token]` → 404 token inconnu.
- **Aucune page en erreur** : 132 requêtes pages, 0 « Application error »,
  0 `undefined`/`NaN`/`[object Object]` dans le texte rendu, 0
  `href="#"`, 0 handler vide. 0 TODO/FIXME affiché.
- **Messagerie complète** (testé de bout en bout) : conversation créée
  (`property:…:user:…`), message customer → `unreadByHost=1`, réponse host
  → `unreadByUser=1`, lecture → `unreadUser=0`. **OK.**
- **Annulation** : `GET /api/bookings/[id]/cancellation` → 200 avec devis
  (frais 0,00 pour flexible à J-13) ; `cancelBooking` calcule les frais sur
  des **pourcentages** (pas de montant fixe → pas de problème de devise) ;
  remboursement PSP = montant **post-wallet** (part carte) + restitution
  séparée du wallet (`releaseBookingBenefits`, idempotent). **Pas de double
  remboursement** (vérifié par analyse en profondeur).
- **Recherche/filtres prix** : bornes saisies dans la devise d'affichage
  (`displayCurrency`) converties en EUR via `priceBoundToStorage` ; SQL
  normalise `base_price / taux` (RATES_FROM_EUR, valeurs injectées depuis
  le code, jamais depuis l'URL) ; affichage carte converti avec mention
  « conversion indicative ». **OK.**
- **Alertes prix** : la devise est transmise de bout en bout (UI → POST →
  `quotePriceAlert` filtre `rooms.currency`) ; fichier maître propre.
- **`<html lang>`** dynamique : PATCH `language=en` → `lang="en"`,
  restauration → `fr`. **OK (T-152).**
- **Version du tunnel de réservation** : `RoomData.currency` +
  `formatPrice(…, roomCurrency)` sur tous les montants (T-152).

---

## 🟠 P1 — Findings critiques (véracité monétaire)

### A. Wallet BestRewards (EUR) appliqué à un total non-EUR au taux 1:1

**Problème.** Le wallet de fidélité est un solde **sans devise propre**
(`users.wallet_balance` credité en EUR) mais le checkout le soustrait
**directement** du total de la chambre, quelle que soit la devise de celle-ci
: `walletUsed = Math.min(wallet, total)` puis `total -= walletUsed`
(`src/app/api/bookings/route.ts` l. ~269-273) ; côté UI
(`reservation/page.tsx` l. ~817-824) la déduction est affichée en **EUR**
(`−formatPrice(Math.min(walletBalance, total), "EUR")`) alors que le solde
à payer est en **USD**. Résultat : **1 € = 1 $US** — la valeur du crédit
dépend du taux de change du jour sans avoir été convertie.

**Preuves (runtime).**
- Chambre USD créée (`170,00 USD`, Riad `8b6f7c72-…`) ;
- `POST /api/bookings` customer (wallet 25,00 €, code `LASTMINUTE`) →
  booking `MBB-2026-9HYHNJ` : `subtotal 340,00 · taxes 34,00 ·
  discount 105,18 · total 268,82 · currency USD ·
  walletCreditsUsed 25,00 · promotionId af52fcb6-…`. Le détail du
  discount : **20,00 (LASTMINUTE, montant fixe EUR) + 60,18 (15 %+2 %
  BestRewards) + 25,00 (wallet EUR)** déduits d'un total **USD** sans
  conversion (au lieu de ≈ 19,00 $US + 57,40 $US + 25,00 € convertis).
- `users.wallet_balance` du customer : 25,00 → 0,00.

**Impact.** Un séjour libellé USD consomme 1:1 du crédit EUR ; l'utilisateur
perd (ou gagne) selon le taux réel ; les analytics/blending restent
cohérents mais le **débit réel** du client est faux.

**Solution sans régression (proposée, additive).**
1. Dans `POST /api/bookings`, avant d'appliquer le wallet, **convertir**
   `wallet` vers la devise de la chambre via `convertAmount(wallet, "EUR",
   roomCurrency)` (taux figés déjà utilisés partout, `src/lib/i18n.ts`) ;
   débit du wallet en **EUR** de `wallet` (inchangé), `walletCreditsUsed`
   enregistré **dans la devise de la chambre** (valeur convertie) ;
2. UI `reservation/page.tsx` : afficher la déduction wallet dans la devise
   **de la chambre** (`formatPrice(min(convert(wallet), total),
   roomCurrency)`) et le solde restant en USD ; mention « converti au taux
   indicatif » (même sémantique que les cartes de prix) ;
3. Garde : si `convertAmount` échoue (devise inconnue), **refuser**
   l'application du wallet avec message clair au lieu d'appliquer 1:1 ;
4. Tests : unitaire (conversion), intégration (booking USD + wallet → USD
   réel), non-régression (booking EUR → montants **identiques**).

---

### B. Promotions « montant fixe » sans devise

**Problème.** `promotions.value` / `minBookingAmount` / `maxDiscount` sont
des décimaux **sans devise** (`src/db/schema.ts` l. ~450-455) ; le formulaire
admin les libelle en **€** (`promotion-form.tsx`), mais
`applyPromoToTotal` les applique **tels quels** au total de la chambre
(`src/lib/promotions.ts`), quel que soit `room.currency`. Un code
`LASTMINUTE` (20,00) appliqué à un séjour USD donne **20 $US** de remise
au lieu de ≈ 19 $US, et un séjour GBP serait remisé en GBP.

**Preuves (runtime).** Voir finding A — `discount` inclut 20,00 appliqués à
un total USD (`MBB-2026-9HYHNJ`) ; le GET `/api/promotions/apply?code=…`
renvoie le `discount` sans devise.

**Solution sans régression (proposée).**
1. **Sans migration** : traiter `value/minBookingAmount/maxDiscount` comme
   des montants **EUR** et les **convertir** vers la devise de la chambre
   (`convertAmount`) avant `applyPromoToTotal` pour `fixed_amount` ;
   `minBookingAmount` et `maxDiscount` de même (comparaison **en EUR** ou
   convertie — plus simple : normaliser le comparaison en devise chambre) ;
2. Afficher dans le tunnel la remise dans la devise de la chambre (déjà le
   cas après T-152) — la valeur convertie est alors la bonne ;
3. Migration optionnelle (hors périmètre) : ajouter `promotions.currency`
   (default `EUR`) pour les promos créées en devise ;
4. Tests : `applyPromoToTotal` reste pur (conversion hors lib) ;
   intégration : promo fixe sur USD → remise convertie ; sur EUR → identité.

---

### C. Cashback BestRewards & crédits de parrainage : devise du wallet silencieuse

**Problème.** Le cron `POST /api/cron/price-alerts` (complétion des séjours)
crédite le wallet d'un **cashback = 5 % × `booking.total`**
(`src/lib/loyalty.ts`) et des bonus de parrainage **fixes** (settings
`bestrewards.referral`) **sans aucune conversion** : si le séjour est en
USD, le cashback est calculé en USD mais ajouté au solde wallet libellé
EUR. Même chose pour `walletCreditsUsed` restitué à l'annulation
(`booking-benefits.ts` : `+ walletUsed` sans devise d'origine).

**Preuves.** Lecture : `cron/price-alerts` l. ~56 (cashback sur
`booking.total`), l. ~64-80 (bonus parrain/referee), `loyalty.ts` (5 % du
total) ; `booking-benefits.ts` l. ~20-27 (restitution).

**Solution sans régression (proposée).**
1. Définir le wallet comme **EUR** (déjà implicite) et **toujours convertir**
   le cashback depuis la devise du booking avant crédit
   (`convertAmount(booking.total, booking.currency, "EUR") × 5 %`) ;
2. Stocker `cashback_amount` dans la devise **d'origine** du booking (colonne
   déja existante, sans migration) et le montant **EUR** crédité dans le
   wallet (ou documenter `cashbackAmount` comme « montant d'origine ») ;
3. idem pour la restitution wallet (`walletCreditsUsed` = montant débité
   **en EUR** — à enregistrer ainsi à la création, voir finding A) ;
4. Message d'information sur la page BestRewards : « crédits en EUR » ;
5. Tests : cron sur booking USD → cashback converti en EUR ; sur EUR →
   **identique** (non-régression).

---

## 🟡 P2 — Findings de cohérence

### D. `notFound()` rend la page 404 avec un statut HTTP **200** (toutes les pages dynamiques)

**Problème.** Sur les pages dynamiques qui appellent `notFound()` après un
`await` (slug [slug], avis [id], messages [id], dashboard/bookings [id],
wishlist share [token]…), le layout `(main)` **streame** (header/footer) et
le statut HTTP a déjà été envoyé (200) quand `notFound()` est levé. Le
visiteur voit « Page introuvable » (correct) mais les robots/crawlers et les
clients HTTP reçoivent **200** — mauvaise sémantique HTTP, référencement
dégradé (contenu d'erreur indexé, `noindex` seulement sur certains cas).

**Preuves (runtime, admin cookie).**

| URL (ID invalide) | Statut HTTP | Corps |
|---|---|---|
| `/hebergement/slug-inexistant-xyz` | **200** | Page introuvable |
| `/mes-reservations/avis/00000000-…` | **200** | Page introuvable |
| `/messages/00000000-…` | **200** | Page introuvable |
| `/dashboard/bookings/00000000-…` | **200** | Page introuvable |
| `/wishlists/share/00000000-…` | **200** | Page introuvable |

(L'API `shared/[token]` renvoie bien 404 ; seule la page rend 200.)

**Solution sans régression (proposée).**
1. Utiliser des **route handlers** (`route.ts`/`not-found` dédiés) pour les
   chemins où le statut doit être exact, ou ;
2. dans les pages concernées, effectuer la vérification **avant** tout
   `await` de layout (impossible avec le pattern actuel) → la solution
   pragmatique : `generateMetadata`/`generateStaticParams` ne s'applique
   pas ; recommandation : **`export const dynamic = "force-dynamic"` ne
   suffit pas** — utiliser `headers()`/`cookies()` (déjà utilisé par
   `fetchShared` pour l'URL absolue) n'aide pas non plus ;
   → **La solution : déplacer le `notFound()` dans un `layout`-level early
   return n'est pas possible sans refonte ; alternative retenue :
   remplacer `notFound()` par `redirect("/recherche")`** NON (perd la page
   404) — **mieux : garder `notFound()` mais lui préfixer un
   `<meta name="robots" content="noindex">` global sur ces routes** (le
   framework l'accepte en `not-found.tsx` par route, sans casser le statut
   200) **et documenter** la limite dans `KNOWN_LIMITATIONS.md` (statut 200
   attendu, contenu 404 correct). Le compromis **sans régression** : ajouter
   `export const metadata = { robots: { index: false } }` aux pages
   dynamiques (aucun changement de logique) ;
3. Test : `curl -o /dev/null -w "%{http_code}"` sur chaque URL invalide →
   documenter que 200 est le comportement actuel (pas de test de
   non-régression à ajouter, mais un test de contenu « Page introuvable »
   déjà couvert par le smoke).

---

### E. Écrans hôte / compte avec `€` codés en dur (hors tunnel B T-152)

**Problème.** Le finding B du rapport n°24 corrigeait le **tunnel** ; il reste
des affichages en `€` dur qui deviennent faux pour une chambre non-EUR :

| Fichier | Occurrence | Devise affichée |
|---|---|---|
| `src/app/dashboard/properties/[id]/page.tsx` (~l.546) | `€{parseFloat(room.basePrice).toFixed(0)}/nuit` | **toujours EUR** (chambre USD → `€170/nuit` faux) |
| `src/app/(main)/mon-compte/page.tsx` (~l.264) | `€{parseFloat(user.walletBalance).toFixed(2)}` | EUR — **correct** si wallet EUR (cf. finding C) mais non explicite |
| `src/components/bestrewards-status.tsx` (~l.80) | `` `€${Number(wallet).toFixed(2)}` `` | idem |
| `src/components/promo-code-input.tsx` (~l.63) | `−{applied.discount.toFixed(2)} €` | **toujours EUR** (remise en devise chambre → faux si USD) |

**Preuves (code + runtime partiel).** `dashboard/properties/[id]` est un
composant client (pas de chambres dans le HTML SSR) → preuve statique
(grep) ; `promo-code-input` affiche la remise d'un booking USD en `€`.

**Solution sans régression (proposée).**
1. `dashboard/properties/[id]` : `formatPrice(room.basePrice,
   room.currency ?? "EUR")` (idem `rooms/new`, `rooms/[id]/calendrier` si
   prix affichés) ;
2. `promo-code-input` : la remise vient de `GET /api/promotions/apply` qui
   doit renvoyer **`currency`** (déjà en DB) → afficher
   `formatPrice(discount, currency)` ;
3. `mon-compte` / `bestrewards-status` : afficher
   `formatPrice(walletBalance, "EUR")` (rendu identique, explicite) ;
4. Tests : grep ne doit plus trouver `€{` dans ces 4 fichiers ; snapshots
   EUR inchangés.

---

### F. Bouton « Utiliser mon solde » du wallet → aucun scenarii fléché

**Problème.** Sur `/mon-compte` (carte wallet), le lien
`/recherche` sans paramètre ne **guide pas** vers l'application du solde :
le voyageur doit choisir un logement puis cocher « Utiliser mes crédits »
manuellement ; le wallet n'a **aucun state « à utiliser »** ni filtre.

**Preuves.** `mon-compte/page.tsx` l. ~266-271 : `<Link href="/recherche">`
**statique** ; aucun `?wallet=1` ni mention dans `recherche/page.tsx`.

**Solution sans régression (proposée, cosmétique).** Remplacer le lien par
`/recherche?wallet=1` + lecteur de ce paramètre côté recherche pour afficher
un bandeau « Vous avez X € de crédits, pensez à les utiliser au paiement »
(affichage seul, aucun changement de contrat API).

---

### G. Page « Avis » d'un booking éligible : aucune indication du délai/critère

**Problème (mineur).** Le CTA « Laisser mon avis » n'apparaît que pour
`status === "completed"` (après T-152) — correct — mais **aucun message**
n'explique pourquoi un booking `confirmed` (séjour futur/passé récent) n'a
pas d'avis : l'utilisateur voit « Passées » sans action ni explication.

**Preuves.** `mes-reservations/page.tsx` : CTA sous `status === "completed"`
uniquement ; `isReviewEligible` (checkOut passé) utilisé sur la page avis
mais non expliqué dans la liste.

**Solution sans régression (proposée).** Petit texte sous les cartes
« Passées » : « Les avis sont ouverts après votre départ » ; et pour un
booking `confirmed` avec `checkOut` passé → badge « Avis bientôt
disponible ». Aucun changement d'API.

---

## ✅ Verdier & priorisation

| # | Finding | Effort | Risque | Bénéfice |
|---|---|---|---|---|
| A | Wallet EUR → total USD 1:1 | M | Faible (additif, conversion) | Élevé — véracité du paiement |
| B | Promo fixe sans devise | M | Faible | Élevé — véracité remise |
| C | Cashback/parrainage : devise | S | Faible | Moyen — wallet cohérent |
| D | `notFound()` → 200 | XS | Nul (métadonnées) | Moyen — SEO/HTTTP |
| E | `€` dur restants (4 fichiers) | S | Nul | Moyen |
| F | « Utiliser mon solde » non fléché | XS | Nul | Faible — UX |
| G | Avis : absence d'explication | XS | Nul | Faible — UX |

**Recommandation :** implémenter **A+B** ensemble (même cause racine :
montants sans devise convertis 1:1), puis **C** (même famille), puis **E**
et **D** (rapides). Aucune migration DB nécessaire pour A/B/C si l'on
conserve « wallet = EUR » et une conversion via `convertAmount` (taux figés
déjà en place) ; l'alternative propre (colonne devise sur `promotions` /
`users.wallet_balance`) est documentée mais **hors périmètre sans
régression**.

**Données de test à nettoyer avant toute implémentation :** chambre USD
`5504717e-e537-43c9-a536-3700a735d97f`, booking `MBB-2026-9HYHNJ`
(`58083237-d369-4ddb-a56b-c14db5c97708`), wishlist « A25 Partage »
`e5afbe0b-609d-48c8-a976-b14354fd6ea1` (token
`3cb97eea-3f1e-4c55-bef8-c038b4504945`), conversation
`82b44f09-8c84-45a7-a354-df4161a61dda` (+ 2 messages), alerte prix
`e8eafa58-f87f-4c59-8905-c11aa9f44429` ; `users.language` du customer
restauré `fr` (vérifié) et `walletBalance` restauré à **25,00** après
annulation de test (le wallet a été débité de 25,00 par la preuve A — à
restaurer).
