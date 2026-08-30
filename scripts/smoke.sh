#!/usr/bin/env bash
# scripts/smoke.sh — Smoke test HTTP reproductible (T-032, R20, ADR-008).
#
# Démarre PostgreSQL embarqué + Next dev si pas déjà en cours,
# joue login × 3 rôles + navigations pages + scénarios métier,
# compte PASS / FAIL et sort en code non nul si un cas échoue.
#
# Usage :
#   npm run smoke              # démarre tout, teste, cleanup ce qu'il a démarré
#   SMOKE_BASE_URL=http://x.y  # tester une instance déjà démarrée ailleurs
#   SMOKE_KEEP_ALIVE=1         # ne pas cleanup à la fin (debug)
#
# Contrat R20 (scripts/check-ai.mjs) :
#   - Header @assertions:N doit rester ≥ 40
#   - login × 3 rôles présent (admin@, host@, customer@)
#   - POST /api/bookings présent
#   - guard body-check présent (DashboardSidebar|Chargement)
#
# @assertions: 94

set -u
umask 077

BASE_URL="${SMOKE_BASE_URL:-http://127.0.0.1:3000}"
JAR_DIR="$(mktemp -d /tmp/smoke-XXXXXX)"
PASS=0
FAIL=0
FAIL_LINES=()
STARTED_DB=0
STARTED_APP=0
DB_PID=""
APP_PID=""

log()  { printf "%s\n" "$*"; }
ok()   { PASS=$((PASS+1)); printf "  ✅ %s\n" "$1"; }
ko()   { FAIL=$((FAIL+1)); FAIL_LINES+=("$1"); printf "  ❌ %s\n" "$1"; }
sect() { printf "\n=== %s ===\n" "$1"; }

cleanup() {
  local code=$?
  if [ "${SMOKE_KEEP_ALIVE:-0}" != "1" ]; then
    if [ "$STARTED_APP" = "1" ] && [ -n "$APP_PID" ]; then
      kill -TERM "-$APP_PID" 2>/dev/null || kill -TERM "$APP_PID" 2>/dev/null || true
      sleep 1
      kill -KILL "-$APP_PID" 2>/dev/null || true
    fi
    if [ "$STARTED_DB" = "1" ] && [ -n "$DB_PID" ]; then
      kill -TERM "-$DB_PID" 2>/dev/null || kill -TERM "$DB_PID" 2>/dev/null || true
      sleep 1
      kill -KILL "-$DB_PID" 2>/dev/null || true
    fi
  fi
  rm -rf "$JAR_DIR"
  exit $code
}
trap cleanup EXIT INT TERM

# ─────────────────────────────────────────────────────────────
# 0. Prérequis serveur : DB + Next
# ─────────────────────────────────────────────────────────────
port_busy() { (echo > "/dev/tcp/127.0.0.1/$1") 2>/dev/null; }

wait_url() {
  local url="$1"
  local max="${2:-45}"
  local i=0
  while [ $i -lt $max ]; do
    local code
    code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "$url" 2>/dev/null || echo 0)
    if [ "$code" = "200" ]; then return 0; fi
    sleep 1
    i=$((i+1))
  done
  return 1
}

sect "0. Prérequis (DB + serveur Next)"

if port_busy 55432; then
  log "  ↺ PostgreSQL déjà sur :55432 → réutilisation"
else
  log "  ▶ npm run db:dev (background)"
  setsid npm run db:dev > "$JAR_DIR/db.log" 2>&1 &
  DB_PID=$!
  STARTED_DB=1
  # Attendre socket TCP
  for i in $(seq 1 30); do
    if port_busy 55432; then break; fi
    sleep 1
  done
  if ! port_busy 55432; then
    ko "PostgreSQL ne démarre pas — voir $JAR_DIR/db.log"
    exit 1
  fi
  log "  ✅ PostgreSQL up"
fi

# Appliquer schéma (idempotent)
log "  ▶ npm run db:push (idempotent)"
npm run db:push > "$JAR_DIR/db-push.log" 2>&1 || {
  ko "db:push a échoué — voir $JAR_DIR/db-push.log"
  exit 1
}

# ─────────────────────────────────────────────────────────────
# Réentrance (audit n°27, T-155) : chaque run laisse sa réservation
# « Smoke Test » sur les mêmes dates/chambre + une alerte prix. Sans
# nettoyage, la disponibilité (quantity=6) finit saturée → 409 « plus
# disponible » → le smoke casse après ~6 exécutions. On supprime les
# artefacts du scénario avant de rejouer (le wishlist-item reste
# idempotent : 400 « déjà dans la liste »).
# NB : POST /api/bookings est limité à 10/h/utilisateur (store mémoire) ;
# au-delà de ~10 runs dans la même heure, redémarrer Next pour vider le
# compteur (documenté KNOWN_LIMITATIONS — rate-limit en mémoire).
# ─────────────────────────────────────────────────────────────
log "  ▶ nettoyage réentrant (runs Smoke précédents)"
DB_URL=$(grep '^DATABASE_URL=' .env.local 2>/dev/null | head -1 | sed -E 's/^DATABASE_URL="?([^"]*)"?$/\1/')
if [ -n "$DB_URL" ]; then
  DB_URL="$DB_URL" node -e "
    const { Client } = require('pg');
    const c = new Client({ connectionString: process.env.DB_URL });
    c.connect().then(async () => {
      try {
        await c.query(\"DELETE FROM bookings WHERE guest_first_name = 'Smoke' AND guest_last_name = 'Test'\");
        await c.query(\"DELETE FROM price_alerts WHERE max_price = '50.00' AND check_in IS NULL AND check_out IS NULL\");
        console.log('cleanup OK');
      } catch (e) { console.error('cleanup KO: ' + e.message); }
      await c.end();
    }).catch((e) => { console.error('cleanup KO: ' + e.message); process.exitCode = 1; });
  " > "$JAR_DIR/cleanup.log" 2>&1 || log "  ⚠️  nettoyage réentrant en échec (voir $JAR_DIR/cleanup.log)"
  grep -q "cleanup OK" "$JAR_DIR/cleanup.log" && log "  ✅ nettoyage réentrant OK" || true
else
  log "  ⚠️  DATABASE_URL introuvable dans .env.local — nettoyage réentrant ignoré"
fi

if port_busy 3000; then
  log "  ↺ Next déjà sur :3000 → réutilisation"
else
  log "  ▶ npx next dev -H 0.0.0.0 -p 3000 (background)"
  setsid npx next dev -H 0.0.0.0 -p 3000 > "$JAR_DIR/next.log" 2>&1 &
  APP_PID=$!
  STARTED_APP=1
  if ! wait_url "$BASE_URL/api/health" 45; then
    ko "Next dev ne répond pas — voir $JAR_DIR/next.log (tail:)"
    tail -20 "$JAR_DIR/next.log" 2>/dev/null || true
    exit 1
  fi
  log "  ✅ Next dev up"
fi

# ─────────────────────────────────────────────────────────────
# 1. Seed (idempotent)
# ─────────────────────────────────────────────────────────────
sect "1. Seed"
seed_body=$(curl -s -X POST "$BASE_URL/api/seed" || true)
if echo "$seed_body" | grep -qE '"(message|success)"'; then
  ok "POST /api/seed → OK ($(echo "$seed_body" | head -c 60))"
else
  ko "POST /api/seed inattendu : $seed_body"
fi

# ─────────────────────────────────────────────────────────────
# 2. Assertions helpers
# ─────────────────────────────────────────────────────────────
assert_code() {
  local url="$1"; local expected="$2"; local label="$3"; local jar="${4:-}"
  local args=(-s -o /dev/null -w "%{http_code}" --max-time 10)
  [ -n "$jar" ] && args+=(-b "$jar")
  local code
  code=$(curl "${args[@]}" "$BASE_URL$url")
  if echo "$expected" | grep -qw "$code"; then
    ok "$code $url ($label)"
  else
    ko "$code $url ($label, attendu $expected)"
  fi
}

assert_body_contains() {
  local url="$1"; local pattern="$2"; local label="$3"; local jar="${4:-}"
  local args=(-s --max-time 10)
  [ -n "$jar" ] && args+=(-b "$jar")
  local body
  body=$(curl "${args[@]}" "$BASE_URL$url")
  if echo "$body" | grep -qE "$pattern"; then
    ok "body $url contient /$pattern/ ($label)"
  else
    ko "body $url ne contient PAS /$pattern/ ($label)"
  fi
}

assert_body_lacks() {
  local url="$1"; local pattern="$2"; local label="$3"; local jar="${4:-}"
  local args=(-s --max-time 10)
  [ -n "$jar" ] && args+=(-b "$jar")
  local body
  body=$(curl "${args[@]}" "$BASE_URL$url")
  if echo "$body" | grep -qE "$pattern"; then
    ko "body $url contient /$pattern/ ($label, guard fuite)"
  else
    ok "body $url exclut /$pattern/ ($label, guard actif)"
  fi
}

# ─────────────────────────────────────────────────────────────
# 3. Login × 3 rôles
# ─────────────────────────────────────────────────────────────
sect "2. Login × 3 rôles (admin@, host@, customer@)"
for creds in "customer@mybestbooking.com:Customer123!:customer.jar:customer" \
             "host@mybestbooking.com:Host123!:host.jar:host" \
             "admin@mybestbooking.com:Admin123!:admin.jar:admin"; do
  email=$(echo "$creds" | cut -d: -f1)
  pwd=$(  echo "$creds" | cut -d: -f2)
  jar=$(  echo "$creds" | cut -d: -f3)
  role=$( echo "$creds" | cut -d: -f4)
  code=$(curl -s -o "$JAR_DIR/login-$jar.json" -w "%{http_code}" \
    -c "$JAR_DIR/$jar" -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$pwd\"}")
  actual=$(python3 -c "import sys,json;d=json.load(open('$JAR_DIR/login-$jar.json'));print(d.get('user',{}).get('role','?'))" 2>/dev/null || echo "?")
  if [ "$code" = "200" ] && [ "$actual" = "$role" ]; then
    ok "login $email → role=$actual"
  else
    ko "login $email → HTTP $code / role=$actual (attendu $role)"
  fi
done

# ─────────────────────────────────────────────────────────────
# 4. Navigation publique
# ─────────────────────────────────────────────────────────────
sect "3. Pages publiques (12, checkout invité inclus)"
for u in / /recherche /aide /bestrewards /confidentialite \
         /mentions-legales /connexion /inscription /reservation \
         /mot-de-passe-oublie /verifier-email /maintenance; do
  assert_code "$u" "200" "public"
done

# ─────────────────────────────────────────────────────────────
# 5. Pages protégées sans cookie (proxy edge → 307)
# ─────────────────────────────────────────────────────────────
sect "4. Pages protégées sans cookie (19 → 307 proxy)"
for u in /mon-compte /mes-reservations /mes-favoris /messages \
         /dashboard /dashboard/bookings /dashboard/properties /dashboard/rooms \
         /dashboard/reviews /dashboard/messages /dashboard/promotions \
         /dashboard/settings /dashboard/users /dashboard/analytics \
         /dashboard/billing /dashboard/audit /dashboard/rooms/new \
         /dashboard/properties/new /dashboard/promotions/new; do
  assert_code "$u" "307 302 308" "proxy edge"
done

# ─────────────────────────────────────────────────────────────
# 6. Customer authentifié — pages accessibles
# ─────────────────────────────────────────────────────────────
sect "5. Customer authentifié — 9 pages"
for u in / /mon-compte /mes-reservations /mes-favoris /messages \
         /reservation /recherche /aide /bestrewards; do
  assert_code "$u" "200" "customer" "$JAR_DIR/customer.jar"
done

# ─────────────────────────────────────────────────────────────
# 7. Guard body-check : dashboard NE DOIT PAS être rendu au customer
#    (Next 16 redirect() = 200 + instruction RSC ; on vérifie le body)
# ─────────────────────────────────────────────────────────────
sect "6. Guards role (body-check) — customer bloqué du dashboard"
# Le body après redirect() RSC contient uniquement le squelette
# ("Chargement en cours…" ou "Aller au contenu principal") et ne
# contient PAS le mot "DashboardSidebar" ni le titre "Tableau de bord"
# du vrai dashboard.
for u in /dashboard /dashboard/properties /dashboard/rooms \
         /dashboard/promotions /dashboard/users /dashboard/settings \
         /dashboard/audit; do
  assert_body_lacks "$u" "DashboardSidebar|Tableau de bord|Espace propriétaire" \
    "customer→$u" "$JAR_DIR/customer.jar"
done

# ─────────────────────────────────────────────────────────────
# 8. Host dashboard (11 pages autorisées)
# ─────────────────────────────────────────────────────────────
sect "7. Host — pages dashboard autorisées (hôte)"
# T-123 (G2) : le proxy edge applique la garde de rôle au plein-chargement.
# Le host accède aux sections hôte (200) mais est renvoyé (307) hors des
# sections admin-only (users, settings, audit, promotions).
for u in /dashboard /dashboard/bookings /dashboard/properties /dashboard/rooms \
         /dashboard/rooms/new /dashboard/reviews /dashboard/messages \
         /dashboard/analytics /dashboard/billing; do
  assert_code "$u" "200" "host" "$JAR_DIR/host.jar"
done
for u in /dashboard/promotions /dashboard/promotions/new \
         /dashboard/users /dashboard/settings /dashboard/audit; do
  assert_code "$u" "307 302 308" "host→admin-only (proxy edge)" "$JAR_DIR/host.jar"
done

# ─────────────────────────────────────────────────────────────
# 9. Admin — 9 pages
# ─────────────────────────────────────────────────────────────
sect "8. Admin — 9 pages incluant admin-only"
for u in /dashboard /dashboard/users /dashboard/audit /dashboard/settings \
         /dashboard/properties /dashboard/bookings /dashboard/reviews \
         /dashboard/analytics /dashboard/billing; do
  assert_code "$u" "200" "admin" "$JAR_DIR/admin.jar"
done

# ─────────────────────────────────────────────────────────────
# 10. /api/auth/me × 3 → rôle correct
# ─────────────────────────────────────────────────────────────
sect "9. /api/auth/me pour chaque rôle"
for pair in "customer.jar:customer" "host.jar:host" "admin.jar:admin"; do
  jar=$(echo "$pair" | cut -d: -f1)
  expected=$(echo "$pair" | cut -d: -f2)
  body=$(curl -s -b "$JAR_DIR/$jar" "$BASE_URL/api/auth/me")
  actual=$(python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('user',{}).get('role','?'))" <<<"$body" 2>/dev/null || echo "?")
  if [ "$actual" = "$expected" ]; then
    ok "/api/auth/me [$jar] → role=$actual"
  else
    ko "/api/auth/me [$jar] → role=$actual (attendu $expected)"
  fi
done

# ─────────────────────────────────────────────────────────────
# 11. APIs protégées sans cookie
# ─────────────────────────────────────────────────────────────
sect "10. APIs protégées sans cookie (9)"
for u in /api/bookings /api/wishlists /api/conversations /api/price-alerts \
         /api/users/me/referral /api/auth/me; do
  assert_code "$u" "401" "unauth"
done
for u in /api/admin/settings /api/admin/audit; do
  assert_code "$u" "401 403" "unauth-admin"
done

# ─────────────────────────────────────────────────────────────
# 12. RBAC : customer refusé sur /api/admin/*
# ─────────────────────────────────────────────────────────────
sect "11. RBAC — customer refusé sur admin"
assert_code "/api/admin/settings" "403" "customer→admin" "$JAR_DIR/customer.jar"
assert_code "/api/admin/audit"    "403" "customer→admin" "$JAR_DIR/customer.jar"

# ─────────────────────────────────────────────────────────────
# 13. Scénarios métier
# ─────────────────────────────────────────────────────────────
sect "12. Scénarios métier"

# Search filtrée
assert_code "/api/properties?guests=2&checkIn=2026-09-01&checkOut=2026-09-05&sort=price_asc" \
  "200" "search filtrée"

# Récup PROP + ROOM + WL du seed
PROP=$(curl -s "$BASE_URL/api/properties" | \
  python3 -c "import sys,json;print(json.load(sys.stdin)['properties'][0]['id'])" 2>/dev/null || echo "")
SLUG=$(curl -s "$BASE_URL/api/properties" | \
  python3 -c "import sys,json;print(json.load(sys.stdin)['properties'][0]['slug'])" 2>/dev/null || echo "")
ROOM=$(curl -s "$BASE_URL/api/rooms?propertyId=$PROP" | \
  python3 -c "import sys,json;print(json.load(sys.stdin)['rooms'][0]['id'])" 2>/dev/null || echo "")
WL=$(curl -s -b "$JAR_DIR/customer.jar" "$BASE_URL/api/wishlists" | \
  python3 -c "import sys,json;d=json.load(sys.stdin);print(d['wishlists'][0]['id'] if d.get('wishlists') else '')" 2>/dev/null || echo "")

if [ -n "$PROP" ] && [ -n "$ROOM" ]; then
  ok "seed extract : PROP=$PROP ROOM=$ROOM SLUG=$SLUG"
else
  ko "extraction PROP/ROOM depuis le seed a échoué"
fi

# T-152 (G) : le smoke ne dépend plus de la wishlist du seed — il en crée
# une si absente (POST /api/wishlists sans propertyId = création, 201).
if [ -z "$WL" ]; then
  wl_create=$(curl -s -w "\n__HTTP__%{http_code}" -b "$JAR_DIR/customer.jar" \
    -X POST "$BASE_URL/api/wishlists" -H "Content-Type: application/json" \
    -d '{"name":"Smoke auto (T-152)","isPublic":false}')
  wl_code=$(echo "$wl_create" | sed -n 's/.*__HTTP__//p')
  wl_body=$(echo "$wl_create" | sed '$d')
  if [ "$wl_code" = "201" ] || [ "$wl_code" = "200" ]; then
    WL=$(echo "$wl_body" | python3 -c "import sys,json;print(json.load(sys.stdin).get('wishlist',{}).get('id',''))" 2>/dev/null || echo "")
  fi
  if [ -n "$WL" ]; then
    ok "création auto de la wishlist smoke → $wl_code"
  else
    ko "création auto wishlist → $wl_code body=$wl_body"
  fi
fi

# Page publique hébergement
assert_code "/hebergement/$SLUG" "200" "page hebergement dynamique"

# Ajout wishlist item (si wishlist existe)
# Le test est idempotent : soit 201 (première fois), soit 400 avec
# le message métier « déjà dans la liste » (rejeu). Toute autre erreur
# est un vrai fail.
if [ -n "$WL" ]; then
  wl_out=$(curl -s -w "\n__HTTP__%{http_code}" -b "$JAR_DIR/customer.jar" \
    -X POST "$BASE_URL/api/wishlists" -H "Content-Type: application/json" \
    -d "{\"wishlistId\":\"$WL\",\"propertyId\":\"$PROP\"}")
  code=$(echo "$wl_out" | sed -n 's/.*__HTTP__//p')
  body=$(echo "$wl_out" | sed '$d')
  if [ "$code" = "201" ] || [ "$code" = "200" ]; then
    ok "POST /api/wishlists (add item) → $code (créé)"
  elif [ "$code" = "400" ] && echo "$body" | grep -qi "déjà dans la liste"; then
    ok "POST /api/wishlists (add item) → 400 (idempotent : déjà présent)"
  else
    ko "POST /api/wishlists (add item) → $code body=$body"
  fi
fi

# Price-alert
code=$(curl -s -o /dev/null -w "%{http_code}" -b "$JAR_DIR/customer.jar" \
  -X POST "$BASE_URL/api/price-alerts" -H "Content-Type: application/json" \
  -d "{\"propertyId\":\"$PROP\",\"maxPrice\":50}")
if [ "$code" = "201" ] || [ "$code" = "200" ]; then
  ok "POST /api/price-alerts → $code"
else
  ko "POST /api/price-alerts → $code (attendu 201/200)"
fi

# Referral
assert_body_contains "/api/users/me/referral" "\"code\":" "referral code présent" \
  "$JAR_DIR/customer.jar"

# Booking bout-en-bout — la vraie preuve
if [ -n "$PROP" ] && [ -n "$ROOM" ]; then
  BODY=$(curl -s -b "$JAR_DIR/customer.jar" -X POST "$BASE_URL/api/bookings" \
    -H "Content-Type: application/json" -d "{
      \"propertyId\":\"$PROP\",
      \"roomId\":\"$ROOM\",
      \"checkIn\":\"2027-01-15\",
      \"checkOut\":\"2027-01-18\",
      \"numAdults\":2,
      \"guestFirstName\":\"Smoke\",\"guestLastName\":\"Test\",
      \"guestEmail\":\"customer@mybestbooking.com\"
    }")
  ref=$(python3 -c "import sys,json;print(json.load(sys.stdin).get('booking',{}).get('bookingReference',''))" <<<"$BODY" 2>/dev/null || echo "")
  status=$(python3 -c "import sys,json;print(json.load(sys.stdin).get('booking',{}).get('status',''))" <<<"$BODY" 2>/dev/null || echo "")
  if [ -n "$ref" ] && [ "$status" = "confirmed" ]; then
    ok "POST /api/bookings → ref=$ref status=$status"
  else
    ko "POST /api/bookings → ref='$ref' status='$status' (attendu confirmed avec ref)"
  fi
fi

# ─────────────────────────────────────────────────────────────
# 14. Rapport final
# ─────────────────────────────────────────────────────────────
TOTAL=$((PASS + FAIL))
sect "RÉSULTAT"
log "  Total assertions : $TOTAL"
log "  PASS             : $PASS"
log "  FAIL             : $FAIL"
if [ $FAIL -gt 0 ]; then
  log ""
  log "  Détail des FAIL :"
  for line in "${FAIL_LINES[@]}"; do
    log "    - $line"
  done
  log ""
  log "  ❌ smoke KO"
  exit 1
fi
log ""
log "  ✅ smoke OK ($PASS assertions)"
exit 0
