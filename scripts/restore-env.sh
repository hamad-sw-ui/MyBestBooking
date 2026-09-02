#!/usr/bin/env bash
# scripts/restore-env.sh — T-192 : restauration IDEMPOTENTE du sandbox
# après une restauration de snapshot (node_modules/.data/.next/.env.local
# ne sont pas persistés entre les reprises).
#
# ⚠️  SECRETS : les valeurs écrites dans .env.local sont des constantes de
#     PREVIEW/DÉVELOPPEMENT (déterministes pour que le vault chiffré
#     CREDENTIALS_ENCRYPTION_KEY reste déchiffrable tant que .data survit).
#     NE JAMAIS déployer ces valeurs en production — la production pose
#     ses propres variables d'environnement.
#
# Idempotent : chaque étape est sautée si déjà satisfaite.
# Usage : npm run env:restore

set -euo pipefail
cd "$(dirname "$0")/.."

log() { printf "  %s\n" "$*"; }

# ── 1. Dépendances ──────────────────────────────────────────────
if [ -d node_modules/next ] && [ -d node_modules/embedded-postgres ]; then
  log "↺ node_modules présent — install sauté"
else
  log "▶ npm ci…"
  npm ci --no-audit --no-fund
fi

# ── 2. .env.local sandbox ──────────────────────────────────────
if [ -f .env.local ]; then
  log "↺ .env.local présent — secrets inchangés (vault intact)"
else
  log "▶ écriture .env.local (constantes PREVIEW — NE PAS déployer)"
  cat > .env.local << 'ENV'
# ── Généré par scripts/restore-env.sh (T-192) — constantes de PREVIEW ──
# ── NE JAMAIS déployer en production : la prod définit ses secrets. ──
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:55432/app_db"
JWT_SECRET="arena-jwt-secret-2026-64chars-stable-local-sandbox-only-0123456789abcdef"
CREDENTIALS_ENCRYPTION_KEY="0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
SEED_TOKEN="arena-seed-token-2026"
CRON_SECRET="arena-preview-cron-2026"
ALLOW_MOCK_PAYMENTS="true"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
MAIL_FROM="MyBestBooking <no-reply@mybestbooking.local>"
ENV
fi

# ── 3. PostgreSQL embarqué ─────────────────────────────────────
port_busy() { (echo > "/dev/tcp/127.0.0.1/$1") 2>/dev/null; }
if port_busy 55432; then
  log "↺ PostgreSQL déjà sur :55432 — démarrage sauté"
else
  log "▶ démarrage PostgreSQL embarqué (setsid, survit au script)…"
  setsid npm run db:dev > /tmp/restore-db.log 2>&1 &
  for i in $(seq 1 240); do
    port_busy 55432 && break
    sleep 1
  done
  port_busy 55432 || { echo "❌ PostgreSQL ne démarre pas — /tmp/restore-db.log"; exit 1; }
fi

# ── 4. Schéma (idempotent) ─────────────────────────────────────
log "▶ db:push (idempotent)"
npm run db:push > /dev/null 2>&1

printf "\n✅ Environnement restauré (base prête).\n"
printf "   Reste (process longs, à lancer via le gestionnaire de processus) :\n"
printf "   1. npx next build && npx next start -p 3000 -H 0.0.0.0\n"
printf "   2. curl -X POST localhost:3000/api/seed -H \"x-seed-token: arena-seed-token-2026\"\n"
printf "   3. npm run cron:local\n"
