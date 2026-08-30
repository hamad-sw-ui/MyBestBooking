# Audit fonctionnel profond n°27 — remédiation des 9 KO du runner unifié

**Date :** 2026-08-30
**Branche :** `arena/01a052ed-mybestbooking` (base `546f09d` — audit n°26 clos)
**Point de départ :** `python3 scripts/run_all_sims.py` — 1ère exécution
(pré-fixes) : smoke **1 KO**, surface **0**, deep **1 KO**, xtreme **0**,
paranoid **crash** ; le runner regroupait les 5 simulations.
**Démarche :** pour chaque KO → **preuve runtime** (logs `/tmp/sim-runs/`,
réponses HTTP réelles) → lecture du code réel (route/UI/SQL) →
**classification** : vrai bug produit vs contrat intentionnel vs contrat de
sim obsolète. Aucun changement de contrat API public, aucune migration de
schéma, cas EUR numériquement inchangés.

---

## 🔴 Findings produit réels (2 — corrigés)

### P2-1. `POST /api/bookings` — code promo inconnu → **409** au lieu de 400

**Problème.** Le deep sim envoyait `promoCode=INCONNU` et obtenait `409`
`{"error":"Code promo : Code promo inconnu"}`. Un code inexistant est une
**entrée invalide** (400), pas un conflit d'état (409) : le 409 est réservé
aux règles métier applicables (expiré, épuisé, conditions de séjour,
wallet…).

**Preuve runtime.** `curl -b <session> POST /api/bookings promoCode=NOPE277`
→ avant fix : `409` ; après fix : `400`.

**Code réel.** `src/app/api/bookings/route.ts` levait `BookingRuleError`
pour « Code promo inconnu » et le catch unique renvoyait 409.

**Solution (additive, sans changement de contrat public : 4xx inchangé
dans la plage erreur, seul le code précis change).** Nouvelle classe
`PromoCodeNotFoundError` (même message), catch dédié → **400**. Les
conflits d'état restent 409. Aucune migration, aucun effet sur les cas
numériques (le refus était déjà un échec, seul le statut change).

**Vérification.** curl → `400 {"error":"Code promo : Code promo inconnu"}` ✓
; smoke bookings promo **94/94** ; deep `[6] promoCode inconnu → [400]` ✓.

### P3-2. Recherche — filtre `?amenity=tv` / `?amenity=minibar` → **0 résultat**

**Problème.** Depuis T-154e le formulaire de recherche expose les
équipements, mais `tv` et `minibar` sont des amenities de **chambres**
(`rooms.amenities`), jamais portées par `properties.amenities`. Le filtre
ne matchait donc **aucune** propriété → une recherche sur `tv` donnait 0
résultat alors que des chambres en sont équipées.

**Preuve runtime.** Avant fix : `GET /recherche?amenity=tv` → 0 URL
d'hébergement ; `?amenity=minibar` → 0. SQL du seed : `tv`/`minibar` dans
`rooms.amenities`, absent de `properties.amenities`. Après fix : **8
propriétés** pour chacun ; `?amenity=zzz` → 0 (pas de faux positifs).

**Code réel.** `src/app/(main)/recherche/page.tsx` : condition unique
`properties.amenities @> '["tv"]'`.

**Solution (additive, SQL identique pour les amenities "propriété").**
Ajout d'un `OR EXISTS (SELECT 1 FROM rooms ra WHERE ra.property_id =
properties.id AND ra.amenities @> …)` — mêmes valeurs, même sémantique
« la propriété propose cet équipement », applicabilité finale toujours
déterminée par l'éligibilité des chambres (le MIN sur chambres éligibles
reste inchangé).

**Vérification.** `?amenity=tv` et `?amenity=minibar` → 8 propriétés ✓ ;
`?amenity=pool` (amenity propriété, T-153) → identique avant/après ✓ ;
`?amenity=zzz` → 0 ✓ ; tsc 0, vitest 372/372.

---

## 🟠 KO écartés : contrats intentionnels (les sims étaient obsolètes)

### K1. `GET /reservation` anonyme → **200** (2 occurrences : surface + paranoid)

**Attendu produit :** depuis T-109 le checkout invité est **public** (guest
mode : le formulaire bascule sur saisie d'email invité au lieu de
rediriger). Les routes sensibles du tunnel restent gardées côté serveur
(`POST /api/bookings` exige un compte ou un email invité valide).
**Action :** `simulate.py` déplace `/reservation` de la section B
(protégée) vers la section A (publique) ; `paranoid_sim.py` retire
`/reservation` de `sensitive_paths` et **ajoute** la vérification positive
`GET /reservation anonyme → 200` (elle tourne : 71/71).

### K2. deep — `POST /api/auth/2fa/setup` : `secret 0 chars`

**Attendu produit :** le setup exige le **mot de passe courant**
(T-120 D4) ; le payload `{}` du sim renvoyait 400 « Mot de passe requis ».
**Action :** `deep_sim.py` envoie `{"password":"Customer123!"}`.

### K3. deep — désactivation 2FA → 400 « Valeur invalide ou manquante »

**Finding de vérification (réel mais côté contrat sim).** La route
`/api/auth/2fa/disable` exige `password` **et** `code` (T-120 D4 — action
sensible). Le sim n'envoyait que `code` → 400 Zod. L'UI
(`two-factor-section.tsx`) envoie bien les deux — aucun bug produit.
**Action :** `deep_sim.py` envoie `{"password":"Customer123!","code":…}`.

### K4. deep — upload : `url=None`

**Attendu produit :** `POST /api/uploads` = pièces jointes de messagerie
**privées** ; en stockage local l'URL publique est `null` par design (la
pièce est servie via `GET /api/messages/attachments/[id]`, auth requise).
Les images publiques ont leur route dédiée (`/api/properties/upload`, url
renseignée). **Pas un bug** (rapport n°26, uploads privés `.data/`).
**Action :** `deep_sim.py` vérifie `key` + `size` + DELETE/ownership
(200 → GET 404), et marque l'URL publique « non applicable » en local.

### K5. xtreme — mails de vérification / reset introuvables

**Attendu produit :** depuis T-109 l'outbox nomme les fichiers
`console_<sha256(clé idempotence)[:24]>.txt` — **l'adresse n'est plus dans
le nom** (hygiène des données locales). Le sim cherchait
`*<email>*.txt` → 0 fichier.
**Action :** `latest_mail_for()` lit le **contenu** (en-tête `To:`) —
tolérant au nommage ; `forgot-password` réutilise cette fonction.

### K6. paranoid — register dupliqué (même email, lowercase) → **409**

**Attendu produit :** l'unicité case-insensitive est garantie ; le refus
peut être 400 (entrée) ou 409 (unicité violée) — **tout code ≠ 2xx
empêche le doublon** ; seul un 200 serait une vulnérabilité.
**Action :** `paranoid_sim.py` accepte `(400, 409)`.

### K7. paranoid — proxy : routes sensibles

**Attendu produit :** la liste correcte est `/dashboard`,
`/connexion`, `/inscription`, `/mon-compte/:path*`,
`/mes-reservations/:path*`, `/mes-favoris/:path*`, `/messages/:path*`.
`/reservation` en est exclue (T-109). Écart écarté — liste conforme au
code (`middleware.ts`).

### K8. smoke — booking `ref=''`

**Cause racine :** les runs précédents laissaient leur réservation
« Smoke Test » sur les mêmes dates/chambre + une alerte prix sentinelle ;
la disponibilité (quantity=6) finissait saturée → 409 « plus disponible »
et l'assertion échouait (`ref=''`). Artefact de données, pas un bug
produit.
**Action :** `smoke.sh` — nettoyage **réentrant** pré-run (DELETE bookings
`Smoke Test` + price_alerts sentinelles) via `DATABASE_URL` extrait de
`.env.local`. Smoke **94/94** répétable.

---

## 🔧 Robustesse du harnais (crashs, pas des bugs produit)

### H1. paranoid — `subprocess.TimeoutExpired` sur `POST /api/auth/login`

**Symptôme :** après le restart Next du runner, la 1re requête compile la
route (Turbopack) et dépassait `--max-time 10`/`timeout=10` → traceback,
0 assertion.
**Action :** `paranoid_sim.py` — wrapper `sh()` (TimeoutExpired → stdout
vide, jamais de crash), timeouts relevés (login 60 s, GETs 30 s) ;
`run_all_sims.py` — `_run()` idem + `db_query()` avec **3 essais**
(Postgres momentanément occupé au stop de Next).

### H2. deep — KO « 429 » sur les chemins d'erreur booking en run solo

**Symptôme :** en lançant deep seul après un run complet, les checks
booking tombaient en 429 — rate-limit **mémoire** (10/h) d'un process Next
non redémarré.
**Action :** pas de changement produit (limite documentée) ; le runner
redémarre Next entre chaque simulation → deep **80/80** en run unifié.

---

## 📊 Validation finale (`run_all_sims.py`, run complet)

| Simulation | OK | WARN | KO | Statut |
|---|---|---|---|---|
| smoke | 94 | 0 | 0 | ✅ PASS |
| surface | 68 | 0 | 0 | ✅ PASS |
| deep | 80 | 0 | 0 | ✅ PASS |
| xtreme | 83 | 3 | 0 | ✅ PASS |
| paranoid | 71 | 0 | 0 | ✅ PASS |
| **Total** | **396** | **3** | **0** | ✅ |

- **3 WARN xtreme inchangés** (par design, fail-open documenté) :
  maintenance-gate, unread-messages-badge, résumé de page — silences
  volontaires vérifiés dans le code.
- **tsc `--noEmit`** : 0 erreur.
- **vitest** : 52 fichiers, **372/372** passés.
- **contracts vérifiés par curl** : promo inconnue → 400 ;
  `?amenity=tv`/`minibar` → 8 ; `?amenity=zzz` → 0.

---

## Impact & risques

- **P2-1** : seule la classe d'erreur « code inconnu » change de statut
  (409 → 400). Aucun changement de schéma, aucune valeur numérique ; les
  tests existants (`en` promo) inchangés.
- **P3-2** : élargit le match aux amenities de chambres — même contrat
  d'affichage (liste `rooms.amenities` déjà utilisée pour les fiches) ;
  l'ORDER et les bornes de prix (MIN EUR sur chambres éligibles) ne sont
  pas touchés.
- **Scripts** : resynchronisation sur les contrats réels + robustesse
  (timeouts/retry) — aucune assertion affaiblie qui masquerait une
  régression : deep passe de 73 à **80** assertions, paranoid de 71
  (stable), smoke de 94 (stable).

## Tâches associées

- `T-155` — BACKLOG (P2-1, P3-2, resynchronisation des 6 scripts).
