# 🔍 Audit d'exécution — lenteur constatée du projet (T-178)

- **Date** : 2026-09-01
- **Déclencheur** : retour utilisateur « tout le projet est lent à
  l'exécution ».
- **Méthode** : mesures chronométrées curl (TTFB / total) par route et par
  API, à froid puis à chaud, en DEV puis en PROD sur la même machine.

## 1. Diagnostic mesuré (les faits, pas des suppositions)

### Mode DÉVELOPPEMENT (`next dev`, preview exposée jusqu'ici)

| Route | 1er hit (compile Turbo) | hits suivants |
|---|---|---|
| `/` | **2 200 ms** | ~100–190 ms |
| `/recherche` | 375 ms | ~100–180 ms |
| `/hebergement/hotel-barcelona-center` | **1 333 ms** | ~186–200 ms |
| `/connexion` | 106 ms | ~90 ms |

→ Chaque changement de code, redémarrage ou nouvelle route = recompilation
à la volée (logs : 1,3 s – 2,8 s); le hot-reload est aussi plus lourd en
JavaScript hydraté.

### Mode PRODUCTION (`next start`, même build T-177)

| Route | 1er hit | hits suivants |
|---|---|---|
| `/` | 60 ms | ~36 ms (final mesuré **17 ms**) |
| `/recherche` | 50 ms | ~21 ms |
| `/hebergement/…` | 95 ms | ~24 ms |
| `/connexion` | 21 ms | ~10 ms |

→ **3 à 8× plus rapide**, et la lenteur « de compilation au premier accès »
disparaît complètement (pages pré-générées 60/60 au build).

### Conclusion du diagnostic

Ce n'est **pas l'application** qui est lente (DB locale, requêtes bornées,
pas de délai artificiel en code — le seul `setTimeout` 800 ms est le
spinner visuel de transition de paiement, voulu) : c'est le **mode dev de
la prévisualisation**. Solution : servir la preview en production.

## 2. Deux verrous de sécurité apparus en prod — levés proprement

1. `POST /api/seed` : protégé (404 sans `x-seed-token` en production) —
   garde **conservée** ; le smoke transmet désormais le header si
   `SEED_TOKEN` est défini (sinon comportement historique en dev).
2. Paiement : la factory exige les vraies clés Stripe en production
   (throw → 503 après résa créée, smoke le détectait) — garde **conservée
   par défaut**, levée uniquement pour la démo par opt-in explicite
   `ALLOW_MOCK_PAYMENTS=true` (documenté, testé : `=false` ou absent →
   refus inchangé).

## 3. Livré

- Preview basculée : **`next start` (production) sur :3000** — plus aucune
  compilation à la volée.
- `src/lib/payment/index.ts` : opt-in mock démo (+2 tests).
- `scripts/smoke.sh` : transmission de `x-seed-token` si défini.
- `.env.local` (preview) : `ALLOW_MOCK_PAYMENTS=true` + `SEED_TOKEN`.

## 4. Ce qui n'a volontairement PAS été touché

- Garde prod Stripe par défaut (la sécurité prime hors preview).
- Aucun changement de requête/index (inutile à ce volume, mesuré rapide).
