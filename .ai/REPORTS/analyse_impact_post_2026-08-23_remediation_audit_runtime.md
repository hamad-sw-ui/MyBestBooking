# Analyse d’impact post-correction — T-102

- **Date** : 2026-08-23
- **Référence prévue** : `analyse_impact_2026-08-23_remediation_audit_runtime.md`
- **Statut** : VALIDÉ dans les limites explicitement listées.

## Effets constatés vs prévus

| Prévision | Constat |
|---|---|
| Stock/`minStay`/capacité validés côté serveur | ▶️ Confirmé : capacité 2 refusée pour 6 adultes + 4 enfants ; stock quotidien 1 accepte le premier booking puis refuse le second ; minStay 3 refuse 2 nuits. |
| Transition voyageur restreinte | ▶️ `confirmed → completed` par customer retourne 400 ; avis futur retourne 400. |
| Checkout invité | ▶️ `/reservation` anonyme retourne 200 ; API guest préservée. |
| Remboursement mock traçable | ▶️ Annulation mock : `refundAmount` total, `refundStatus=refunded`, horodatage présent. |
| Cron idempotent | ▶️ première alerte = 1 notification, deuxième au même prix = 0 ; un booking passé a été clôturé une fois et marqué fidélité. |
| Migration additive | ▶️ `drizzle-kit migrate` sur base PostgreSQL fraîche a appliqué 0000→0008 ; les 7 nouvelles colonnes attendues sont présentes. |
| CTA et actions visibles | ▶️ smoke HTTP 91/91 ; URL CTA produite sous la convention `property`/`room`, conversation/wishlist/API testées. |

## Écarts constatés

1. **Test suite dépendante du serveur** : `admin/bulk/route.test.ts` se met en skip si aucun serveur n’écoute sur 3000. Une exécution finale avec serveur de validation a donné **208/208** ; sans serveur, Vitest reste vert mais 12 assertions sont skippées. Ce comportement est préexistant.
2. **Stripe test-mode live** : le code compile et l’état pending est correctement représenté, mais aucune clé Stripe sandbox n’a été fournie. Ce test externe n’est donc pas déclaré exécuté.
3. **Navigateurs Playwright** : Chromium est absent et son téléchargement est bloqué par le réseau du sandbox. Les smoke HTTP et la build production compensent partiellement, sans être présentés comme un test navigateur.

## Fichiers modifiés hors périmètre initial strict

- `scripts/smoke.sh` : le smoke attend désormais correctement `/reservation` public pour le mode invité. C’est une adaptation nécessaire du contrat de test.
- `scripts/check-ai.mjs` : la branche attendue est synchronisée sur la branche Arena imposée à cette session, afin de faire respecter R10 sans faux échec.
- Documents API/FEATURES/KNOWN_LIMITATIONS : correction de promesses devenues fausses (paiement/factures/alertes).

## Risques anticipés matérialisés

- Lint a révélé une apostrophe JSX non échappée lors de la validation finale. Elle a été corrigée puis la chaîne complète relancée.
- Les avertissements préexistants `<img>` et hooks restent non bloquants : 0 erreur ESLint, 16 avertissements consignés dans `KNOWN_LIMITATIONS.md`.

## Effets non anticipés

- Le test bulk conditionne sa couverture à la présence d’un serveur HTTP, pas seulement de la DB ; la procédure finale doit donc démarrer le serveur avant `npm test` pour obtenir 208/208.

## Checklist de revérification

- [x] migration fraîche 0008
- [x] typecheck
- [x] lint sans erreur
- [x] Vitest 208/208 avec DB + serveur
- [x] build production
- [x] `npm run smoke` 91/91
- [x] `npm run ai:check` 18 OK, 2 avertissements non bloquants, 0 échec
- [x] tests HTTP/API manuels des cas critiques
- [ ] Stripe test-mode avec clés fournisseur
- [ ] Playwright Chromium dans CI/environnement avec navigateur
