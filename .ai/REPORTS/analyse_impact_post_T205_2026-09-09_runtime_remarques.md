# Analyse d’impact post-correction — T-205 — Audit fonctionnel/runtime

- **Date** : 2026-09-09
- **Tâche** : T-205
- **Statut** : VALIDÉ localement
- **Niveau** : S

## Correspondance prévu / constaté

Les effets constatés correspondent au plan : les changements sont additifs, sans migration destructive, et conservent les contrats API existants. Deux points ont été élargis après inspection finale :

1. **Récap checkout** : ajout de `GET /api/bookings/quote` pour éliminer la divergence entre `room.basePrice × nuits` côté client et les prix calendrier utilisés par `POST /api/bookings`.
2. **Calendrier availability** : ajout d’une défense serveur sur format, dates passées et fenêtre maximale, en plus du guard UI.

## Fichiers ajoutés ou élargis hors plan initial strict

| Fichier | Pourquoi |
|---|---|
| `src/app/api/bookings/quote/route.ts` | Devis non persistant requis pour afficher le même calcul que la création de réservation sans créer de hold. |
| `src/app/api/bookings/quote/route.test.ts` | Test d’intégration DB-gated prouvant que le devis utilise les prix journaliers du calendrier et refuse un stop-sell. |
| `src/app/api/rooms/[id]/availability/route.ts` | Défense serveur ajoutée après décision : l’UI seule ne suffisait pas pour protéger les écritures historiques/abusives. |

## Risques anticipés matérialisés

- **Règle React hooks `set-state-in-effect`** : une première version du devis checkout mettait des states synchrones dans un effet ; `npm run lint` l’a détecté. Correction : état de fraîcheur dérivé par clé de devis, mises à jour uniquement dans les callbacks réseau.
- **Build sans DB locale** : `next build` échoue si `DATABASE_URL`/PostgreSQL ne sont pas disponibles. Correction d’environnement local : `.env.local`, `npm run db:dev`, `npm run db:push`, puis build vert.

## Effets non anticipés

- `npm test` exécute les tests DB si PostgreSQL est joignable ; sur une DB fraîche non seedée, cela peut fausser le run global. La preuve ciblée `bookings/quote` a donc été exécutée avec DB locale, puis le run global a été relancé DB arrêtée comme dans le comportement DB-gated existant.

## Revérification traitée

| Zone | Preuve |
|---|---|
| TypeScript | 🔨 `npm run typecheck` → 0 erreur |
| Lint | 🔨 `npm run lint` → 0 erreur |
| Tests unitaires/intégration globaux | 🧪 `npm test` → 62 fichiers passés, 29 skipped ; 455 tests passés, 113 skipped |
| Test devis checkout DB | 🧪 `npm test -- src/app/api/bookings/quote/route.test.ts` → 1 fichier passé, 2 tests passés |
| i18n | 🔍 `npm run i18n:check` → 0 candidat |
| Build production | 🔨 `npm run build` → succès, 65 pages |
| Smoke HTTP | ▶️ `npm run smoke` → 95/95 PASS |
| Framework `.ai` | ✅ `npm run ai:check` → 19 OK · 1 warn R7 · 0 fail |

## Limites explicites

- Les tests DB-gated restent dépendants d’une base locale disponible ; le run global les skippe quand PostgreSQL n’est pas joignable, conformément aux conventions existantes.
- Playwright n’a pas été utilisé : l’installation Chromium avait précédemment échoué côté CDN/TLS ; le smoke HTTP couvre les parcours critiques disponibles sans navigateur.
