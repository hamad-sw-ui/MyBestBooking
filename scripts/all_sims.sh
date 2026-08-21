#!/usr/bin/env bash
# Runner unifié : lance chaque simulation dans un environnement propre
# (Next redémarré pour vider les rate-limits en mémoire) et cleanup
# DB entre les runs (bookings de test, 2FA seed, wallet reset).
#
# Usage : bash scripts/all_sims.sh
# Prérequis : PostgreSQL déjà démarré via `npm run db:dev`
#
# T-032 (Session 11 quinquies) — objectif : 0 KO sur TOUTES les suites.

set -u

REPO="/home/user/MyBestBooking"
BASE="http://127.0.0.1:3000"
LOGDIR="/tmp/sim-runs"
mkdir -p "$LOGDIR"

log() { printf "\n\033[1;36m=== %s ===\033[0m\n" "$1"; }
ok()  { printf "  \033[32m✅ %s\033[0m\n" "$1"; }
ko()  { printf "  \033[31m❌ %s\033[0m\n" "$1"; }

# ─── Helpers DB ─────────────────────────────────────────────────
db() {
  node -e "
const {Client} = require('pg');
const c = new Client({connectionString:'postgresql://postgres:postgres@127.0.0.1:55432/app_db'});
c.connect().then(async () => {
  try { const r = await c.query(\`$1\`); console.log(JSON.stringify(r.rows)); }
  catch (e) { console.log(JSON.stringify({error:e.message})); }
  await c.end();
});"
}

cleanup_db() {
  log "Cleanup DB (bookings test + 2FA seed + wallet)"
  db "DELETE FROM bookings WHERE guest_first_name IN ('Racer','ParaFix','RaceFix','Trans','Calc','Wallet','Anonymous','Blocked','Deep','Sim','BlockTest','FreeTest','Combo','Chevauchement0','Chevauchement1','Chevauchement2','RaceRetry00','RaceRetry01','RaceRetry02') OR guest_first_name LIKE 'Racer%' OR guest_first_name LIKE 'ParaFix%' OR guest_first_name LIKE 'RaceFix%' OR guest_first_name LIKE 'RaceRetry%' OR guest_first_name LIKE 'Trans%' OR guest_first_name LIKE 'Chevauchement%'" > /dev/null
  db "UPDATE users SET two_factor_enabled=false, two_factor_secret=null WHERE email LIKE '%@mybestbooking.com'" > /dev/null
  db "UPDATE users SET wallet_balance='25.00' WHERE email='customer@mybestbooking.com'" > /dev/null
  # Retirer les helpful votes du customer (rate-limit review helpful)
  ok "cleanup DB"
}

# ─── Restart Next.js (vide les rate-limits mémoire) ─────────────
restart_next() {
  log "Restart Next.js (vide rate-limits mémoire)"
  # Trouver et tuer les process next
  pkill -f "next dev" 2>/dev/null || true
  pkill -f "next-server" 2>/dev/null || true
  sleep 3
  # Redémarrer
  (cd "$REPO" && setsid npx next dev -H 0.0.0.0 -p 3000 > "$LOGDIR/next.log" 2>&1 &)
  # Attendre le port
  for i in $(seq 1 25); do
    if curl -s -o /dev/null -w "%{http_code}" "$BASE/api/health" | grep -q 200; then
      ok "Next up (port 3000)"
      return 0
    fi
    sleep 1
  done
  ko "Next ne démarre pas"
  tail -20 "$LOGDIR/next.log"
  return 1
}

# ─── Runner d'une simulation ─────────────────────────────────────
run_sim() {
  local name="$1"; local cmd="$2"; local log="$LOGDIR/${name}.log"
  log "Simulation : $name"
  cleanup_db
  restart_next || return 1
  cd "$REPO"
  eval "$cmd" 2>&1 | tee "$log" > /dev/null
  local last=$(tail -3 "$log" | grep -oE "✅ [0-9]+|⚠️? *[0-9]+|❌ [0-9]+|Total.*|(smoke OK|smoke KO)" | tr '\n' ' ')
  # Détection succès selon format
  local ko_count=$(grep -c "^❌" "$log" || true)
  local warn_count=$(grep -c "^⚠️" "$log" || true)
  local ok_count=$(grep -c "^✅" "$log" || true)

  # Smoke.sh a un format différent
  if grep -q "smoke OK" "$log"; then
    ok "$name : smoke OK"
    return 0
  elif grep -q "smoke KO" "$log"; then
    ko "$name : smoke KO"
    tail -10 "$log"
    return 1
  fi

  if [ "$ko_count" = "0" ]; then
    ok "$name : $ok_count OK · $warn_count WARN · 0 KO"
    return 0
  else
    ko "$name : $ok_count OK · $warn_count WARN · $ko_count KO"
    grep "^❌" "$log" | head -10
    return 1
  fi
}

# ─── Séquence ───────────────────────────────────────────────────
FAILS=()

restart_next || exit 1

run_sim "smoke"    "SMOKE_KEEP_ALIVE=1 bash scripts/smoke.sh"    || FAILS+=("smoke")
run_sim "surface"  "python3 scripts/simulate.py"                 || FAILS+=("surface")
run_sim "deep"     "python3 scripts/deep_sim.py"                 || FAILS+=("deep")
run_sim "xtreme"   "python3 scripts/xtreme_sim.py"               || FAILS+=("xtreme")
run_sim "paranoid" "python3 scripts/paranoid_sim.py"             || FAILS+=("paranoid")

log "RÉSULTAT FINAL"
if [ ${#FAILS[@]} -eq 0 ]; then
  ok "TOUTES les simulations passent (0 KO)"
  exit 0
else
  ko "Échecs : ${FAILS[*]}"
  echo "Logs dans $LOGDIR/"
  exit 1
fi
