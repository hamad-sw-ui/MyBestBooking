# Rapport de validation — audit n°5, correctifs courts T-249 / T-251 / T-252

- **Date** : 2026-09-11 · **Branche** : `arena/01a08b7d-mybestbooking`
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_execution.md`
  (constats A4, A5, A8) · rapports d'impact et de conception :
  `REPORTS/analyse_impact_T245_T252_2026-09-11_execution.md`,
  `REPORTS/analyse_conception_T245_T252_2026-09-11_execution.md`
- **Périmètre livré** : trois constats sur huit (**T-249**, **T-251**, **T-252**). Les cinq autres
  (T-245 pagination, T-246 favoris, T-247 dialogues de motif, T-248 journal du wallet,
  T-250 supervision des crons) restent planifiés : ils touchent plusieurs écrans ou une décision
  produit et ne sont **pas** inclus dans cette livraison.

---

## 1. Ce qui a été livré

### T-249 (A4) — bandeau « tri ignoré »

- `src/lib/search-warnings.ts` : `sortIgnored` ajouté au type `SearchWarning`, à la carte
  `SEARCH_WARNING_KEY` et à la détection ; liste blanche `SORT_VALUES = rating | price_asc |
  price_desc | popularity` alignée sur le `switch` du moteur (`api/properties/route.ts:206-216`).
- `src/lib/ui-strings.ts` : `search.warn.sortIgnored` en FR **et** EN ; verrou
  `src/lib/ui-strings.test.ts` **1682 → 1683** (le verrou compte les clés FR ; 1 clé par langue).
- API **inchangée** : un `sort` inconnu répond toujours 200 avec le tri par défaut — c'est le
  bandeau qui explique désormais l'écart, exactement comme les 4 avertissements de T-175.

### T-251 (A5) — messagerie : « introuvable » ≠ « interdit »

- `src/app/api/messages/route.ts` : `checkParticipant` renvoie un résultat discriminé
  (`{ kind: "not_found" }` / `{ kind: "forbidden" }` / `{ kind: "ok", … }`) ; GET et POST
  répondent **404** `{ error: "Conversation introuvable", code: "CONVERSATION_NOT_FOUND" }` pour une
  conversation absente et **403** `{ error: "Accès refusé", code: "CONVERSATION_FORBIDDEN" }` pour un
  tiers (statut historique conservé pour ce cas).
- Variante retenue plutôt que le message neutre : **alignement sur la page `/messages/[id]`**, qui
  distinguait déjà les deux situations (404 si absente, redirection si non participant). Les UUID
  étant non devinables, aucune énumération n'est facilitée.
- `src/lib/api-error.ts` : traduction EN « Conversation not found ».

### T-252 (A8) — hygiène T-207

- Suppression de `src/lib/wallet-currency.ts` (`applyWalletToTotal`) **et** de
  `src/lib/wallet-currency.test.ts` : plus aucun appelant applicatif (vérifié par `grep` — seuls le
  fichier et son test se référençaient).
- `.ai/KNOWN_LIMITATIONS.md` (§ « Surfaces inactives ») : `useWalletCredits` (accepté puis ignoré,
  `walletUsedEur = 0`) documenté avec renvoi à **T-248** pour la décision produit, et mention de la
  suppression pour éviter une réintroduction sans arbitrage.

---

## 2. Preuves d'exécution

| Preuve | Résultat |
|---|---|
| `npx tsc --noEmit` | **0 erreur** (deux `mockResolvedValue` du nouveau test typés via `vi.mocked`, corrigés avant la CI) |
| `npm run ci` (chaîne complète) | **verte** — typecheck · lint `--max-warnings 0` · i18n · `ai:check` **19 OK / 1 warn / 0 fail** (warn R7 attendu) · vitest **126 fichiers passés / 2 ignorés (128)**, **709 tests passés / 28 ignorés (737)** · build production · smoke **95/95** |
| Cohérence des compteurs vitest | 743 (avant) − 8 tests `wallet-currency` supprimés + 2 ajoutés (1 `search-warnings`, 1 `messages` T-251) = **737** ✅ ; 129 fichiers − 1 = **128** ✅ — les 2 fichiers ignorés (`admin/hosts`, `admin/bulk`) le sont par leur propre sonde de disponibilité DB, sans lien avec la modification |
| Runtime — T-249 | `GET /recherche?sort=nimportequoi` → 200 **et** bandeau « Le tri demandé n'est pas reconnu… » **présent** (1 occurrence) ; `?sort=price_asc` → 200, **0** occurrence ; `GET /api/properties?sort=nimportequoi` → toujours **200** (contrat inchangé) |
| Runtime — T-251 | `GET /api/messages?conversationId=<uuid inexistant>` → **404** `{"error":"Conversation introuvable","code":"CONVERSATION_NOT_FOUND"}` |
| Tests ciblés | `messages/route.test.ts` **4/4** (dont le nouveau cas 200 participant / 404 absente / 403 tiers), `search-warnings.test.ts` **8/8**, `ui-strings.test.ts` (verrou 1683), `api-error.test.ts` |
| Base de données | inchangée par la livraison : aucune migration, aucune écriture produit ; les fixtures du test messages sont créées puis supprimées dans le fichier de test |

---

## 3. Non-régression — ce qui n'a pas bougé

- **Contrats d'API** : `/api/properties` (toujours tolérant sur `sort`), `/api/messages` (mêmes
  entrées/sorties ; seuls le statut d'une conversation **absente** — 403 → 404 — et un champ `code`
  additif changent), `PATCH`/`DELETE` wishlists, `/mon-compte`, tunnels de réservation et paiement
  manuel : **aucune modification**.
- **i18n** : une seule clé ajoutée par langue, parité FR/EN vérifiée par le test existant
  (« chaque warning possède une clé FR et EN renseignée ») ; verrou mis à jour dans le même commit.
- **Code mort supprimé** : 1 module + 8 tests retirés, aucun comportement produit perdu (le module
  n'était appelé nulle part).
- **Rapports et backlog** : BACKLOG (T-249 / T-251 / T-252 marqués FAIT), `CURRENT_TASK.md`,
  `PROGRESS.md`, `DEVLOG.md` mis à jour ; les 5 constats restants gardent leur plan détaillé.

## 4. Reste à faire (inchangé, dans l'ordre recommandé)

1. **T-247** — dialogue de motif accessible (remplace les 3 `window.prompt`) + `moderationReason`
   obligatoire pour `hidden`/`rejected`.
2. **T-245** — pagination : écrans RSC (`?page=N`, composant `Pagination`) et API en opt-in.
3. **T-246** — favoris : tri stable + `defaultWishlistId`, renommage, sélecteur de liste, déplacement.
4. **T-250** — `cron_runs` + écran admin « Tâches planifiées ».
5. **T-248** — décision produit sur la consommation du wallet, puis journal `wallet_transactions`
   (migration 0023).
