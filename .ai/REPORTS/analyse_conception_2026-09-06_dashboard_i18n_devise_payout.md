# Analyse de conception — Dashboard i18n, conversion devises, versement hôte/admin

- **Date** : 2026-09-06
- **Tâche** : implémentation des remarques (Phases A/B = S, Phase C = C)
- Production après l'analyse d'impact, avant toute écriture de code.

---

## Phase A — i18n dashboard (sélecteurs + durcissement)

### 1. Objectif
Que l'hôte/admin puisse **changer sa langue et sa devise d'affichage** depuis l'espace pro, et que
le garde-fou CI détecte réellement le français non accentué.

### 2. Problème actuel
- `LanguageSelector` et `CurrencySelector` ne sont montés que dans le header/recherche **publics**.
- `check-i18n.mjs` ne détecte que le français **accentué** → des mots non accentués (« Voir »,
  « Modifier », « Total », « Actions ») passent le garde-fou.

### 3. Solutions possibles
1. **S1 — Réutiliser les sélecteurs existants** dans la sidebar/header mobile du dashboard.
   - Avantages : zéro nouveau composant, cohérent avec le public.
   - Inconvénients : `CurrencySelector` public utilise `localStorage` (inopérant pour un compte
     connecté car `user.currency` prime) → il faut une variante qui **PATCH `/api/users/me`**.
   - Complexité : Faible · Sécurité : neutre · Maintenabilité : excellente.
2. **S2 — Sélecteurs dédiés au dashboard** qui PATCHent le profil (langue + devise), calqués sur
   le pattern `LanguageSelector` (qui PATCH déjà la langue).
   - Avantages : sémantique claire, persiste la préférence **au niveau du compte** (partagée site entier).
   - Inconvénients : un composant neuf (mais réutilisable).
   - Complexité : Faible · Sécurité : neutre (PATCH déjà validé par Zod) · Maintenabilité : bonne.
3. **S3 — Ne rien faire** (garder la langue via le compte uniquement).
   - Inconvénient : ne répond pas à la demande (l'hôte ne voit pas de sélecteur dans son espace).

### 4. Solution retenue
**S2** pour la devise (variante `DashboardCurrencySelector` qui PATCH `/api/users/me`), **S1** pour la
langue (`LanguageSelector` est déjà compatible : il PATCH la langue pour un compte connecté).
Justification : cohérence avec `LanguageSelector`, persiste au niveau compte, et évite le piège
`localStorage`/`user.currency`. On **borne** les options de devises à EUR/USD/GBP/XAF
(= `supportedCurrencies` admin) pour rester aligné avec le panneau.

### 5. Risques
- Faible. Le sélecteur de devise change `user.currency` (affichage), aucune transaction touchée.
- ⚠️ Il faut être certain que le dashboard **convertit** réellement (sinon le sélecteur serait trompeur)
  → c'est l'objet de la **Phase B** ; elles sont livrées ensemble.

### 6. Compatibilité
- `PATCH /api/users/me {currency}` accepte déjà `DISPLAY_CURRENCIES` (EUR/USD/GBP/CHF/MAD/XAF).
  On n'expose que EUR/USD/GBP/XAF dans le sélecteur. Aucune migration. Aucun changement public.

### 7. Plan de développement
1. Créer `src/components/dashboard-currency-selector.tsx` (PATCH profil, rollback sur erreur).
2. Monter `LanguageSelector` + `DashboardCurrencySelector` dans `DashboardSidebar` et
   `DashboardMobileHeader`.
3. Durcir `scripts/check-i18n.mjs` (lexique français non accentué).
4. Migrer les résidus EUR (wallet, bestrewards, promo) vers la conversion d'affichage.

### 8. Retour arrière
Retirer les deux composants de la sidebar/header + revert `check-i18n.mjs`. Aucune migration.

---

## Phase B — Conversion des devises (dashboard)

### 1. Objectif
Afficher dans le dashboard un **total unifié** en devise d'affichage (converti), **sans jamais
masquer** la répartition native par devise, et sans convertir un montant transactionnel.

### 2. Problème actuel
`formatCurrencyBreakdown` affiche « 1 200,00 € + 785 000 XAF » (jamais un total unifié). Le prix/nuit
de `properties/[id]` reste dans la devise de la chambre. Le wallet/aide restent en EUR.

### 3. Solutions possibles
1. **S1 — Helper additif `sumByCurrencyConverted`** qui calcule un total converti (via
   `convertAmount`/`RATES_FROM_EUR`) en plus de la répartition, avec drapeau multi-devises.
   - Avantages : non-régressif (la répartition native reste), testable en pur.
   - Inconvénients : les taux sont figés (documentés comme indicatifs) — cohérent avec l'existant.
   - Complexité : Faible · Sécurité : neutre (aucun montant transactionnel converti).
2. **S2 — Unifier en convertissant tout vers EUR**.
   - Inconvénient : masque la devise native d'une transaction ; contraire à la règle T-132.
     **Rejeté.**
3. **S3 — Utiliser une API FX temps réel**.
   - Inconvénient : dépendance réseau + coût + besoin de la cacher ; hors périmètre V1 (le projet
     utilise déjà des taux figés). **Rejeté pour l'instant**, versé au backlog.

### 4. Solution retenue
**S1**. Ajouter `sumByCurrencyConverted(items, targetCurrency)` et
`formatCurrencyConverted(map, targetCurrency, locale)` dans `currency-summary.ts`, réutilisés par
billing/analytics/dashboard. Affichage : total converti **+** détail `formatCurrencyBreakdown` si
multi-devises. Pour `properties/[id]`, utiliser le pattern `LocalizedRoomPrice` (devise d'affichage
convertie + note).

### 5. Risques
- Faible. EUR mono-devise = rendu identique (non-régression garantie par test).
- ⚠️ On ne convertit que l'**affichage** ; `bookings.netToHost`, `bookings.total`, `walletCreditsUsed`
  restent dans leur devise native.

### 6. Compatibilité
Aucune migration. Clés i18n additives FR/EN (le type `UiStringKey` force la parité).

### 7. Plan
1. Extension de `currency-summary.ts` + tests.
2. Billing / analytics / dashboard : afficher le total converti + détail natif.
3. `properties/[id]` : prix converti (pattern `LocalizedRoomPrice`).
4. Résidus EUR : wallet (mon-compte, bestrewards) et promo → devise d'affichage.

### 8. Retour arrière
Revert du helper + des affichages. Aucune migration.

---

## Phase C — Versement hôte/admin (Stripe Connect) — C

### 1. Objectif
Permettre à un hôte/admin de **recevoir** le `netToHost` sur un compte bancaire, via un ledger
auditable et (à terme) Stripe Connect.

### 2. Problème actuel
`netToHost`/`commission` sont calculés et exportés en CSV mais **aucun versement n'existe** :
pas de table `payouts`, pas de compte bancaire, pas d'exécution réelle.

### 3. Solutions possibles
1. **S1 — Ledger interne + abstraction provider (mock/stripe)**, sans modifier le flux de paiement
   client : table `payouts`, agrégation périodique, UI « Versements », et un `PayoutProvider`
   qui expose `createPayoutAccount` / `executePayout` (mock en dev, Stripe Connect si clés).
   - Avantages : testable sans clés Stripe, non-régressif (sans Connect account → comportement
     actuel), respecte le pattern provider déjà en place pour les paiements.
   - Inconvénients : l'exécution Stripe Connect réelle **reste non validable ici** (pas de clés).
   - Complexité : Moyenne · Sécurité : élevée (IBAN chiffré) · Maintenabilité : bonne.
2. **S2 — Stripe Connect destination charge direct** dès la création du booking.
   - Avantages : split natif à la source.
   - Inconvénients : modifie le flux de paiement client (risque de régression), exige des clés,
     et n'est pas testable ici. **Reporté** en faveur de S1 (qui ne touche pas au flux client).
3. **S3 — Ne rien faire**.
   - Inconvénient : ne répond pas à la demande.

### 4. Solution retenue
**S1** — priorité à la non-régression et à la testabilité. Le paiement client **reste inchangé**.
On ajoute : table `payouts`, `src/lib/payout.ts` (agrégation pure + idempotence), `PayoutProvider`
(abstraction mock/stripe), UI billing « Versements », webhook `payout.*` (inbox idempotente réutilisée).

> ⚠️ **Limite honnête** : le branchement Stripe Connect réel (onboarding, transfert, SEPA) exige
> des clés de test absentes du sandbox. Conformément à §13.5, la partie externe reste
> `CORRIGÉ (INSPECTION)` ; la partie interne (modèle, ledger, UI, tests) vise `CORRIGÉ (VALIDÉ)`.

### 5. Risques
- Critique si on touche au flux de paiement → **on n'y touche pas** (S1).
- Critique (données bancaires) → chiffrement AES-GCM, jamais réaffichées, audit_log.
- Criticité devise → refus si incompatible.

### 6. Compatibilité
Migration **additive** (nouvelle table ; aucune modification de table existante). Aucun contrat
API public modifié. `db:push` sur chaîne fraîche.

### 7. Plan
1. Migration `payouts` (table + index).
2. `src/lib/payout.ts` (agrégation, idempotence) + tests.
3. `src/lib/payout-provider.ts` (abstraction mock/stripe) + `provider-credentials` intégration.
4. Cron `payouts` dans `cron-runner`.
5. UI billing « Versements » + webhook.
6. Docs (ADR, KNOWN_LIMITATIONS).

### 8. Retour arrière
Migration additive : suppression de la table (jamais destructif sur les données existantes) ;
revert des composants UI et du cron.
