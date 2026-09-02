#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# T-185 — Mesure de performance reproductible (baseline).
#
# Usage :
#   bash scripts/perf-baseline.sh                 # instance :3000 locale
#   PERF_BASE_URL=http://127.0.0.1:3000 bash scripts/perf-baseline.sh
#   PERF_N=20 bash scripts/perf-baseline.sh       # échantillons/route
#   PERF_COOKIE=/tmp/c bash scripts/perf-baseline.sh  # mesures authentifiées
#
# Sortie : tableau markdown p50/p95/max par cible (ms), prêt à coller dans
# les rapports .ai/REPORTS. AUCUNE donnée modifiée : lecture seule.
# ─────────────────────────────────────────────────────────────
set -u

BASE_URL="${PERF_BASE_URL:-http://127.0.0.1:3000}"
N="${PERF_N:-15}"
COOKIE="${PERF_COOKIE:-}"

probe() { # $1=label  $2=chemin
  local label="$1" path="$2"
  local args=(-s -o /dev/null)
  [ -n "$COOKIE" ] && args+=(-b "$COOKIE")
  curl "${args[@]}" "$BASE_URL$path" >/dev/null 2>&1 || true # chauffe
  local times_file
  times_file=$(mktemp)
  local i
  for i in $(seq "$N"); do
    curl "${args[@]}" -w '%{time_total}\n' "$BASE_URL$path" 2>/dev/null >> "$times_file" || echo 0 >> "$times_file"
  done
  LABEL="$label" PATH_="$path" python3 - "$times_file" << 'PYEOF'
import os, sys
vals = sorted(float(l) * 1000 for l in open(sys.argv[1]) if l.strip())
label, path = os.environ["LABEL"], os.environ["PATH_"]
if not vals:
    print(f"| {label} (`{path}`) | ? | ? | ? |")
else:
    p50 = vals[len(vals)//2]; p95 = vals[min(len(vals)-1, int(len(vals)*0.95))]; mx = vals[-1]
    print(f"| {label} (`{path}`) | {p50:.0f} | {p95:.0f} | {mx:.0f} |")
PYEOF
  rm -f "$times_file"
}

echo "| Cible | p50 ms | p95 ms | max ms |"
echo "|---|---|---|---|"
probe "Accueil" "/"
probe "Recherche catalogue (sans dates)" "/recherche"
probe "Recherche avec dates (temps réel)" "/recherche?checkIn=2027-02-01&checkOut=2027-02-03"
probe "Fiche hébergement" "/hebergement/dar-el-medina"
probe "Connexion (page)" "/connexion"
probe "API catalogue" "/api/properties?limit=20"
probe "BestRewards" "/bestrewards"
