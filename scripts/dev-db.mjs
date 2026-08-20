#!/usr/bin/env node
// scripts/dev-db.mjs
//
// Démarre un PostgreSQL embarqué (dev/CI uniquement) et le laisse tourner.
// Persistance des données dans .data/pg/.
//
// Usage :
//   node scripts/dev-db.mjs         # démarre + garde en foreground
//   node scripts/dev-db.mjs --once  # initialise puis quitte (pour install)

import EmbeddedPostgres from "embedded-postgres";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const DATA_DIR = resolve(process.cwd(), ".data", "pg");
const PORT = 55432;
const USER = "postgres";
const PASSWORD = "postgres";
const DB = "app_db";

const isFresh = !existsSync(DATA_DIR);
mkdirSync(resolve(process.cwd(), ".data"), { recursive: true });

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: true,
});

async function main() {
  if (isFresh) {
    console.log("→ First-time init (this may download a Postgres binary)…");
    await pg.initialise();
  }
  await pg.start();
  console.log(`✅ Postgres embedded up on postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DB}`);

  if (isFresh) {
    try {
      await pg.createDatabase(DB);
      console.log(`✅ Database '${DB}' created`);
    } catch (e) {
      if (!String(e.message).includes("already exists")) throw e;
    }
  }

  if (process.argv.includes("--once")) {
    await pg.stop();
    console.log("→ Stopped after init (--once)");
    process.exit(0);
  }

  console.log("→ Press Ctrl+C to stop");
  const shutdown = async (sig) => {
    console.log(`\n→ ${sig} received, stopping Postgres…`);
    try { await pg.stop(); } catch (e) { console.error(e); }
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  // keep alive
  setInterval(() => {}, 60_000);
}

main().catch((err) => {
  console.error("❌ dev-db failed:", err);
  process.exit(1);
});
