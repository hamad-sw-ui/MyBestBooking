# 🎯 TÂCHE EN COURS

**ID** : T-160 (audit n°30 — implémentée et validée)

**Niveau de proportionnalité** : S (implémentation des 7 findings : 2 P2,
5 P3 — additif, aucun contrat API public cassé, aucune migration)

**Titre** : Audit n°30 — « Mes favoris » pollué (123 listes d'artefacts +
N+1), alertes prix acceptées pour des dates passées (jamais expirées),
i18n public vague 2 (5 pages FR malgré langue EN), 404 de partage en
HTTP 200, label devise FR au SSR, liens e-mail relatifs si APP_URL
manquante, hygiène des runs (votes/favoris).

**Statut** : **CORRIGÉ (VALIDÉ)** — T-160→T-166 implémentés ; validation
complète passée (tsc 0 · vitest 60 fichiers/403 tests · sims 5/5 · probes
régression 18/18 · build prod · ai:check 19 OK/1 warn R7/0 fail).
Rapport : `.ai/REPORTS/audit_fonctionnel_profond30_2026-08-30.md`.
Détail/preuves : section « Audit n°30 — implémentation » de
`.ai/TRACEABILITY.md`.

**Activité en cours (2026-08-31)** : **test intégral complet** demandé par
l'utilisateur — TOUTE la suite rejouée, 3 échecs (smoke, surface, paranoid)
réparés et re-passés. Verdict final : tsc 0 · lint 0 err/14 warn ·
ai:check 19/1/0 · vitest 60/403/0 · sims **5/5 (396 OK · 3 WARN · 0 KO)** ·
probes n°30 **18/18** · build prod ✓ · i18n exit 0. Commit du correctif :
`0fb18fc` (voir PROGRESS/TRACEABILITY, session 2026-08-31).

## Récapitulatif implémentation (sans régression)

- **T-160 (P2)** — purge étendue (`purge-sim-data.mjs` : 122 wishlists
  d'artefacts supprimées sur l'état réel de l'audit ; critères stricts
  `rate-test-*`, noms exacts, « Mes favoris » vide) + `cleanup_db` du
  runner (wishlists/votes/alertes) + refactor `getWishlists()` : 1
  requête `wishlist_items ⋈ properties` + `aggregateWishlistItems` +
  compteur de propriétés UNIQUES (`uniqueProperties`).
- **T-161 (P2)** — `POST /api/price-alerts` : `checkIn` passé → **400**
  (« La date d'arrivée de l'alerte ne peut pas être dans le passé » ;
  avant : 201) ; cron : `expirePastStayAlerts(today)` → `active=false`
  (jamais supprimé) + `pastAlertsExpired` dans la réponse.
- **T-162 (P2)** — les 5 pages publiques localisées (métadonnées +
  libellés + pluriels) : `confidentialite`, `mentions-legales`,
  `bestrewards`, `reservation` (wrapper RSC `generateMetadata` +
  composant client `reservation-form.tsx`), `wishlists/share/[token]` ;
  ~45 nouvelles clés fr/en dans `ui-strings.ts`.
- **T-163 (P3)** — **écart technique documenté** : le pattern prescrit
  « `notFound()` dans `generateMetadata` » ne produit PAS de 404 sur
  Next 16.2.6 (streaming : statut figé à 200 dès le premier `await` —
  docs « Streaming · The HTTP contract » + issue vercel/next.js #82041,
  constaté en dev ET en build prod). Solution réelle : validation au
  **proxy** (`src/proxy.ts`) — l'API publique du partage est interrogée
  avant le rendu, token inconnu → **404 HTML immédiat** (localisé
  fr/en, `noindex`), token valide → page RSC (200).
- **T-164 (P3)** — `CurrencySelector({ initialLanguage })` passé depuis
  `SearchPriceFilter` ← `recherche/page.tsx` (`getServerLocale`) : le
  label SSR est « Display currency » avec cookie EN (plus de flash FR).
- **T-165 (P3)** — `src/lib/app-url.ts` : `appBaseUrl()` (variable
  nettoyée sinon `https://mybestbooking.com`, warn unique hors test) ;
  utilisé par les 2 templates e-mail (`templates.ts`) et l'URL du cron.
- **T-166 (P3)** — `purge-sim-data.mjs` + `cleanup_db` nettoyent aussi
  `review_votes` (directs + via avis des users test), `price_alerts` et
  wishlist_items/wishlists d'artefacts.

## Contrôles terminés (aucun problème)

- Les 3 pages réécrites + partage : titre/localisés EN avec cookie ;
  formatage et rendus identiques sinon (classes/composants conservés).
- Tests additifs : `app-url.test.ts`, `wishlist-utils.test.ts`,
  `price-alert-rules.test.ts` (étendu `isStayPast`/`isStayExpired`),
  `api/price-alerts/route.test.ts` (intégration : 400 passé / 201 futur /
  expiration cron), `proxy.test.ts` (+2 : 404 middleware / 200 valide).
- `scripts/deep_sim.py` : contrôle statique adapté au pattern
  wrapper RSC + composant client sibling (`reservation-form.tsx`) —
  l'intention (composants branchés) est conservée.
