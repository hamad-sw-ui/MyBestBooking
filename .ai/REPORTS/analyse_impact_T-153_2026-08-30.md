# Analyse d'impact — T-153 (implémentation des findings A→G de l'audit n°25)

- **Date** : 2026-08-30
- **Tâche** : T-153 — implémentation sans régression des remarques de
  l'audit fonctionnel n°25 (`REPORTS/audit_fonctionnel_profond25_2026-08-30.md`) :
  A wallet EUR appliqué 1:1 à un total non-EUR · B promotions `fixed_amount`
  sans devise · C cashback/rappels crédités sans conversion · D `notFound()`
  → HTTP 200 (SEO) · E `€` codés en dur restants (4 fichiers) · F bouton
  « Utiliser mon solde » non fléché · G absence d'explication du CTA avis.
- **Niveau** : **S — Structurant**. Justification :
  - **écriture financière** : le wallet est **débité** (`POST /api/bookings`)
    et **crédité** (`cron/price-alerts` : cashback) → toute erreur de
    conversion touche de l'argent réel ;
  - **changement de format de réponse publique** : `GET /api/promotions/apply`
    renvoie désormais `currency` (champ **additif**, jamais retiré) ;
  - **nouveaux helpers + tests** transvases (`promotions`, `wallet-currency`,
    `loyalty`) et modifications de composants UI ;
  - pas C : **aucune migration DB**, aucune colonne ajoutée (le wallet reste
    implicitement EUR, les promos restent en EUR — convention documentée).
  - Précédent aligné : T-152 (S) même famille « véracité monétaire ».
- **Surface impactée** : `POST /api/bookings` (wallet+promo),
  `GET /api/promotions/apply`, `cron/price-alerts` (cashback),
  `reservation/page.tsx` (UI wallet/promo), `promo-code-input`,
  `dashboard/properties/[id]`, `mon-compte`, `bestrewards-status`,
  `recherche/page.tsx`, `mes-reservations/page.tsx`, `ui-strings.ts`,
  `promotions.ts`, `wallet-currency.ts` (nouveau), `loyalty.ts`,
  `KNOWN_LIMITATIONS.md`.
- **Risques** : Faible — les cas EUR restent **numériquement identiques**
  (conversion identité `EUR→EUR` = `×1`) ; les réponses API existantes
  conservent leurs champs (`currency` ajouté) ; aucune donnée migrée.
- **Preuves attendues** : tsc 0 · lint 0 (warnings préexistants uniquement) ·
  vitest augmenté (unitaires wallet/promo/loyalty + intégration booking USD)
  · smoke OK · build OK · ai:check OK · preuves runtime (booking USD avec
  wallet+promo → montants en USD, débit wallet EUR correct ; cron cashback
  USD → wallet EUR ; UI EUR identique).
- **Plan de non-régression** :
  1. `applyPromoToTotal` **inchangé** (pur, tests existants verts) — la
     normalisation devise est un pré-traitement additionnel ;
  2. `calculateLoyaltyAward(total)` → paramètre `currency` **optionnel**,
     défaut `EUR` (appels existants identiques) ;
  3. `GET /api/promotions/apply` sans `currency` → **comportement historique**
     (défaut EUR) ;
  4. sur EUR : conversion `×1` → mêmes montants, mêmes rendus ;
  5. smoke + `npm test` complets + vérification du diff.

---

## 1. Quels fichiers utilisent directement les composants concernés ?

Faits mesurés :
- `grep -rn "walletBalance" src --include=*.ts --include=*.tsx` → bookings
  route (débit), cron price-alerts (crédit), mon-compte + bestrewards-status
  (affichage), reservation page (UI checkout), booking-benefits (restitution).
- `grep -rn "applyPromoToTotal" src` → `lib/promotions.ts` (définition),
  `api/bookings/route.ts` (POST), `api/promotions/apply/route.ts` (GET).
- `grep -rn "calculateLoyaltyAward" src` → `lib/loyalty.ts` + cron
  price-alerts (+ tests).
- `grep -rn "formatPrice" src/components src/app --include=*.tsx` → déjà
  utilisé partout ; 4 occurrences `€{...}` restantes (audit E).

## 2. Scénarios touchés par chaque changement

| Finding | Scénario | Changement |
|---|---|---|
| A | Séjour USD + wallet EUR | débit wallet converti, déductions affichées en USD, `walletCreditsUsed` = EUR |
| B | Promo fixe EUR sur séjour USD | `value/min/max` convertis avant application (via contexte devise) |
| C | Séjour USD terminé (Ambassador) | cashback calculé sur total **EUR** avant crédit wallet |
| D | URL invalide (`/hebergement/inconnu`…) | `noindex` déjà émis par not-found Next — **documentation** uniquement (statut 200 = limite App Router) |
| E | Host voie `€170/nuit` pour chambre USD | `formatPrice(…, room.currency)` ; remise promo `formatPrice(…, currency)` |
| F | « Utiliser mon solde » | lien `/recherche?wallet=1` + bandeau explicatif |
| G | Séjour passé non encore `completed` | badge « Avis bientôt disponible » + texte explicatif |

## 3. Risques résiduels (honnêtes)

- **Taux figés V1** (RATES_FROM_EUR, non temps réel) : la conversion est
  « indicative » — la même limitation est déjà affichée sur les prix
  (`LocalizedRoomPrice`). Documenté, pas de changement.
- `walletCreditsUsed` sur d'anciens bookings USD créés **avant** T-153 est
  dans la mauvaise devise (déjà en base, non corrigé — pas de migration par
  principe ; les restitution de ces cas restent au montant historique).
- `GET /api/promotions/apply` : le champ `currency` est dérivé de la
  requête, pas de la promo (pas de colonne devise) — pas de fausse
  promesse.
