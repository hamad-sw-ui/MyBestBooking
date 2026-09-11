# Analyse d'impact — T-245 → T-252 (audit n°5, exécution)

- **Date** : 2026-09-11 · **Branche** : `arena/01a08b7d-mybestbooking` · **HEAD de l'analyse** : `8253c74`
- **Nature** : analyse d'impact **avant implémentation** (§14). Aucune ligne de code produit modifiée à ce stade.
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_execution.md`
  (copie `.ai/REPORTS/analyse_runtime_n5_2026-09-11_execution.md`) — constats A1→A8.
- **Niveau de proportionnalité déclaré pour la tâche courante** : **S** (passe d'analyse + correctifs de
  fin de parcours, sans changement de modèle métier hors T-248, qui touche un solde monétaire).

---

## 1. Périmètre et surfaces touchées (prévu)

| Tâche | Constat | Surfaces de code (prévues) | Contrats exposés | Migrations |
|---|---|---|---|---|
| **T-245** | A2 — pagination | 6 pages RSC (`dashboard/bookings`, `users`, `reviews`, `properties`, `promotions`, `mes-reservations`) + composant `Pagination` ; `GET /api/bookings`, `GET /api/messages` (params opt-in) | **Aucun changement** de corps de réponse ; ajout d'en-tête `X-Total-Count` uniquement si `limit`/`offset` fournis | aucune |
| **T-246** | A1 — favoris multi-listes | `api/wishlists/route.ts` (tri, `defaultWishlistId`, `name`), `use-wishlist-toggle.ts`, `wishlist-actions.tsx`, `property-card-client.tsx`, `create-wishlist-button.tsx`, `/mes-favoris` | PATCH : `name` **optionnel** (les appels actuels inchangés) ; GET : ordre + champ additif | aucune |
| **T-247** | A3 — motifs de modération | `ui/dialog.tsx` (nouveau), 3 composants admin, `api/reviews/[id]/moderate/route.ts` | **Durcissement assumé** : `moderationReason` requis si `hidden`/`rejected` (400 `issues`) ; `approved`/`pending` inchangés | aucune |
| **T-248** | A6 — journal du wallet | `db/schema.ts` (+ table), 4 familles d'écriture (`bookings/[id]`, `cron/price-alerts`, `booking-benefits`, `booking-request-expiration`), `/mon-compte` | Aucune route modifiée ; lecture seule ajoutée à l'espace compte | **0023** (additive) |
| **T-249** | A4 — tri ignoré | `lib/search-warnings.ts`, `/recherche`, `lib/ui-strings.ts` | Aucun (API inchangée) | aucune |
| **T-250** | A7 — supervision crons | `db/schema.ts` (+ table), `cron/price-alerts`, `cron/payouts` (legacy 410), nouvel écran admin, `lib/technical-purge` (T-243) | Réponse cron inchangée (ajout de compteurs possibles) | **0024** (additive) |
| **T-251** | A5 — messagerie | `api/messages/route.ts`, `/messages` (état « indisponible ») | Champ `code` **additif** ; `error` inchangé | aucune |
| **T-252** | A8 — hygiène | `lib/wallet-currency.ts` (+ test), `KNOWN_LIMITATIONS.md` | Suppression d'un export **sans appelant** | aucune |

## 2. Contrats à ne pas casser (non-régression)

1. **Réponses d'API existantes** : `GET /api/bookings` et `GET /api/messages` renvoient aujourd'hui un
   tableau JSON en 200. La pagination doit rester **opt-in** : sans `limit`/`offset`, la forme et le
   contenu de la réponse doivent être **strictement identiques** (test de contrat dédié).
2. **PATCH `/api/wishlists`** : trois champs (`wishlistId`, `isPublic`, `rotateShareToken`) sont utilisés
   par l'UI de partage/rotation (prouvé T-238). `name` s'ajoute en **optionnel** ; les combinaisons
   actuelles doivent répondre exactement comme avant.
3. **Modération** : le seul appelant est l'UI admin (3 composants). Le durcissement
   `hidden`/`rejected` → motif obligatoire est un **changement de contrat volontaire** ; il est couvert
   par la refonte du dialogue dans la même tâche (T-247) pour qu'aucun chemin d'écran ne puisse plus
   envoyer une demande sans motif.
4. **Wallet** : `users.walletBalance` reste la **source de vérité** ; le journal est un
   **enregistrement** des mouvements, jamais un recalcul de solde. Les montants et les règles de calcul
   (5 %, conversion EUR, parrainage, remboursements legacy) ne changent pas.
5. **Cron** : la réponse JSON de `GET /api/cron/price-alerts` est consommée par le planificateur
   externe (et par les sondes) — les clés existantes doivent rester présentes avec la même sémantique ;
   les nouvelles informations passent par la table `cron_runs`.
6. **i18n** : toute clé nouvelle suit la parité FR/EN ; le verrou de `src/lib/ui-strings.test.ts`
   (qui compte les clés **FR**) doit être mis à jour **dans le même commit** — départ 1682 → **1683**
   pour T-249 (une clé par langue), davantage pour T-246/T-250. `npm run i18n:check` reste un
   garde-fou avertisseur (WARN, non bloquant).

## 3. Risques de régression et parades

| Risque | Probabilité | Impact | Parade prévue |
|---|---|---|---|
| Pagination RSC : disparition de lignes au-delà de la page 1 si l'utilisateur ne voit pas la pagination | Moyenne | Utilisateur croit avoir tout vu | Compteur « X résultats » + pager visible en haut **et** bas de tableau ; test RSC page 1/2/3 ; smoke ajusté |
| Pagination API : un appelant existant envoie déjà `limit` par inadvertance | Faible | Forme de réponse différente | Grep des appelants avant implémentation ; documenter `limit`/`offset` comme opt-in dans `docs/API` si présent |
| `name` dans le PATCH wishlist : collision avec un futur champ | Faible | 400 inattendu | Champ optionnel, validation 1–80, test « sans `name` = 200 identique » |
| Dialogue de motif : perte de la saisie à la fermeture | Faible | Perte de travail admin | Dialogue contrôlé (état React), pas de fermeture au clic extérieur pour l'action destructive (ou confirmation) |
| Motif obligatoire : scripts de simulation/smoke qui masquent un avis sans motif | Moyenne | Smoke rouge | Recherche des appels dans `scripts/*.py`, `scripts/*.mjs` **avant** le durcissement ; ajuster les scripts |
| Journal wallet : double écriture (cashback + ligne) en cas d'erreur partielle | Faible | Journal incomplet | Écriture **dans la transaction existante** (aucune transaction longue en plus), test « exception → ni solde ni ligne » |
| `wallet_transactions` : divergence solde/journal après des mois de données | Moyenne | Confiance dans le journal | Migration **sans backfill** : le journal démarre à la migration ; note explicite dans `KNOWN_LIMITATIONS.md` (le solde reste la référence) |
| `cron_runs` : écriture de trace en échec qui masque l'erreur d'origine | Faible | Diagnostic brouillé | Écriture de trace en `try/catch` imbriqué, jamais propagée ; test « erreur métier → 500 + ligne `ok=false` » |
| Message « introuvable ou non accessible » : perte d'information pour le support | Faible | Diagnostic plus lent | Code machine `code` distinct + log serveur conservant la cause réelle |

## 4. Compatibilité et données

- **Migrations** : 0023 (`wallet_transactions`) et 0024 (`cron_runs`) — purement additives, `db:push`
  compatible avec la base seed ; aucune colonne retirée, aucun `NOT NULL` ajouté à une table existante.
- **Rétention** : `cron_runs` est purgée par `purgeTechnicalData()` (T-243) comme `sessions` et
  `email_outbox` ; `wallet_transactions` est **conservée** (ligne comptable, pas de purge automatique)
  — à documenter.
- **RGPD** : `wallet_transactions` ne contient aucune donnée personnelle nouvelle (clé `user_id`
  interne) ; elle suit l'anonymisation du compte (T-242) sans modification.
- **Performances** : index `(user_id, created_at desc)` sur `wallet_transactions`,
  `(name, started_at desc)` sur `cron_runs` ; pagination RSC = une requête `COUNT` + une requête bornée
  par page et par écran.
- **Observabilité** : les compteurs déjà renvoyés par le cron alimentent `cron_runs.counters` sans
  nouvelle instrumentation.

## 5. Impacts sur les tests et la CI

| Niveau | Tests prévus |
|---|---|
| Unitaires (vitest) | pagination (bornes, défaut inchangé), schéma PATCH wishlist (`name`), `search-warnings` (`sortIgnored`), journal wallet (1 crédit = 1 ligne, idempotence cron), `cron_runs` (succès/échec), dialogue (validation motif) |
| Intégration route | `moderate` (400 sans motif sur `hidden`/`rejected`, 200 sur `approved`), `GET /api/bookings` (sans paramètre = tableau identique), `GET /api/messages` (code additif) |
| Runtime | pager RSC page 2, renommage + déplacement d'un favori, modération tracée dans `audit_log.metadata.reason`, ligne `cron_runs` après appel du cron, `/mon-compte` historique wallet |
| CI complète | `npm run ci` (typecheck · lint · i18n · ai:check · vitest · build · smoke 95/95) à chaque tâche, verrou i18n mis à jour dans le même commit |

## 6. Décisions à trancher avant T-248

1. **Consommation du wallet** : avoir au règlement sur place (`markPaidOffline` + montant déduit, même
   transaction, ligne de journal `booking_payment`) **ou** gel explicite du programme (retirer le
   cashback des promesses BestRewards). Recommandation : étape 1 (journal) immédiate, décision produit
   avant toute consommation.
2. **Périmètre du backfill** : aucun (recommandé — journal à partir de la migration) ou reconstruction
   depuis `bookings.cashbackAmount` / `walletCreditsUsed` (partielle par nature, car parrainage et
   remboursements ne sont pas rattachés à une réservation).
3. **`useWalletCredits`** : suppression du champ (rupture de compatibilité API pour un champ inerte) ou
   conservation documentée. Recommandation : conservation + note (le champ a été publié).

## 7. Conclusion

Les huit correctifs sont **additifs par conception** : paramètres optionnels, champs supplémentaires,
nouvelles tables, nouveaux composants, messages neutres. Les deux seuls changements de comportement
volontaires sont le **motif obligatoire** pour masquer/refuser un avis (T-247, compensé par la refonte du
dialogue) et la **pagination RSC** (T-245, compensée par un compteur et un pager visibles). Aucune
route, aucune forme de réponse existante ni aucun calcul monétaire n'est modifié.
