# Validation — T-235 → T-239 (audit n°3, findings F4 → F8)

- **Date** : 2026-09-11
- **Branche** : `arena/01a08b7d-mybestbooking`
- **Source** : `docs/analyse_2026-09-10_audit_runtime_scenarios.md`
- **Statut** : **CORRIGÉ (VALIDÉ)**

## 1. Gates automatisés (`npm run ci`, exit code 0)

| Étape | Résultat |
|---|---|
| 1/7 Typecheck (`tsc --noEmit`) | **0 erreur** |
| 2/7 Lint (`eslint .`) | **0 erreur / 0 warning** (gate hérité de T-189) |
| 3/7 Garde-fou i18n | **0 candidat** introduit par ce lot (warn-only : 5 commentaires FR antérieurs) — verrou `ui-strings` **1655** clés FR = EN |
| 4/7 `ai:check` | 19 OK · 1 warn (R7 `state_head_synced`, resync prévu en fin de session) · **0 fail** |
| 5/7 Vitest | **127 fichiers / 735 tests** ✅ (+6 fichiers, +26 tests vs 863978e) |
| 6/7 Build production | ✅ (inchangé) |
| 7/7 Smoke | **95/95** ✅ |

## 2. Preuves runtime (serveur `next dev`, base seedée)

### T-235 — les erreurs de saisie ne consomment plus le quota produit

```
--- 10 essais invalides (email mal formé) ---
codes: 400 400 400 400 400 400 400 400 400 400     ← aucun 429
--- demande valide (avec heure d'arrivée 15:30) ---
{"booking":{"id":"35e0185f-…","bookingReference":"MBB-2026-EO6EK8", …}}   ← 201
```

Avant le correctif, six essais invalides suffisaient à bloquer la demande légitime en 429.
Le 11ᵉ essai ne reçoit **pas** de 429 : le quota produit n'a été débité que par la demande
acceptée. Le message de refus porte désormais `Retry-After` + « réessayez dans N minute(s) »
(couvert par `bookings/route.t235.test.ts`, qui vérifie le code 429 et l'en-tête).

### T-236 — heure d'arrivée restituée

```
connexion hôte=200 · GET /dashboard/bookings/35e0185f-… → 200
grep "15:30"                    → 15:30
grep "Heure d'arrivée estimée"  → Heure d'arrivée estimée
```

La demande créée avec `estimatedArrival: "15:30"` est **relue** sur la fiche hôte ; les 4 e-mails
(demande + confirmation, voyageur + hôte) et l'espace voyageur sont couverts par les tests.

### T-237 — décision d'annonce notifiée et motif visible

Test d'intégration sur base réelle (`validate/route.t237.test.ts`, 3/3) : rejet → `draft` +
`properties.review_reason` renseigné + **1 envoi** ; rejeu de la même décision → toujours **1
envoi** (idempotence) ; approbation → `active` + motif **`null`** + 1 envoi ; interrupteur coupé →
décision appliquée + **0 envoi**. Migration `0022` appliquée (`db:push`) et colonne vérifiée en
base.

### T-238 — lien partagé assaini et rotation prouvée

`route.t238.test.ts` (2/2) : rotation du jeton → **ancien lien 404**, **nouveau 200** ;
wishlist repassée privée → **404**. `noindex`/`nofollow` déclarés dans les métadonnées de
`/wishlists/share/[token]`.

### T-239 — désabonnement réel

```
GET /desabonnement?u=eecc587d…&c=price_alerts&s=KWH_PSJLee… → statut=200
noindex présent (1) · « Désabonnement pris en compte »
users.price_alert_enabled : true → false  (puis restauré true)
```

Jeton invalide / d'autrui / catégorie inconnue : **aucun effet** (tests 2/2 sur base réelle).
`unsubscribe.test.ts` 4/4 : jeton altéré, autre utilisateur, autre clé, absent → refusés.

## 3. Non-régression

- Suite complète verte (127 fichiers / 735 tests) **et** smoke 95/95 : le tunnel de réservation,
  la wishlist, les e-mails transactionnels et les réglages admin conservent leurs contrats.
- La régression historique du cookie invité (`route.t206`) reste surveillée et verte : poser un
  cookie de quota ne peut pas faire échouer une réservation.
- Migration strictement additive (une colonne, `IF NOT EXISTS`), **aucune** donnée réécrite.

## 4. Base après validation

`bookings` **31** (identique au seed), **0** compte de sonde (`probe-*@test.local`),
**0** résidu de réservation smoke, outbox revenue à son état initial après purge des 2 e-mails de
sonde (132 lignes), `price_alerts` utilisateur restauré.

## 5. Reste à faire

- **T-241** (F11/F12/F13) : distinctions d'admin, analytics (période + export), erreurs d'API
  (`issues` + schémas `.strict()`).
- Resynchronisation de `.ai/STATE.md` sur le HEAD final (R7) avant clôture.
