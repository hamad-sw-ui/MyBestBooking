#!/usr/bin/env bash
# scripts/ci.sh — T-191 (2026-09-02) : chaîne de gates reproductible,
# joueur pour joueur ce que la CI distante exécute (docs/ci-workflow.yml
# — à activer sous .github/workflows/ quand l'App aura la permission
# `workflows`).
#
# Leçon T-187/188/189 : vitest et smoke ne doivent JAMAIS être joués dans
# l'ordre smoke→vitest (le smoke mute la base démo → tests d'intégration
# transitoires en échec). Ce script impose l'ordre inverse et justifie :
#   1. les tests d'intégration vitest SUPPOSENT la base démo seedée —
#      une base jetable vierge les casse tous (« Seed non appliqué ») ;
#   2. le smoke joue APRÈS et se nettoie (cleanup réentrant + purge finale)
#      → la base revient à l'état démo ;
#   3. la disjointedness stricte est garantie en CI distante (vitest :
#      service postgres:16 ; smoke : Postgres embarqué dédié). Localement,
#      l'invariant prouvé = l'ordre, pas une base séparée.
#
# Usage :
#   npm run ci                   # chaîne complète
#   CI_SKIP_BUILD=1 npm run ci   # debug (saute le rebuild)

set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf "\n\033[1m== %s ==\033[0m\n" "$*"; }

step "1/7 — Typecheck"
npx tsc --noEmit

step "2/7 — Lint (0 erreur / 0 warning — gate hérité de T-189)"
npx eslint src --max-warnings 0

step "3/7 — Garde-fou i18n"
npm run i18n:check

step "4/7 — Garde-fou framework .ai"
npm run ai:check

step "5/7 — Vitest (AVANT le smoke — la base démo doit être à l'état seed)"
npx vitest run

step "6/7 — Build production"
if [ -z "${CI_SKIP_BUILD:-}" ]; then npx next build; else echo "(sauté — CI_SKIP_BUILD=1)"; fi

step "7/7 — Smoke HTTP (après vitest ; autonome : démarre DB+app+seed, purge en sortie)"
# smoke.sh lit SEED_TOKEN dans SON environnement pour passer la garde
# /api/seed en mode production (T-178). On source .env.local exactement
# comme on le fait à la main (set -a exporte chaque variable).
# shellcheck disable=SC1091
set -a; [ -f .env.local ] && . ./.env.local; set +a
npm run smoke

printf "\n✅ CI locale OK — chaîne complète verte (ordre vitest→smoke imposé)\n"
