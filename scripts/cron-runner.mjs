#!/usr/bin/env node
// scripts/cron-runner.mjs
//
// T-188 — Ordonnanceur local pour l'environnement de preview (Arena).
//
// ## Pourquoi
// `vercel.json` déclare le cron (chaque jour 08:00) mais rien ne l'appelle
// hors Vercel : en preview, alertes prix, clôture des séjours (cashback
// BestRewards + parrainage), rappels et demandes d'avis restaient
// DORMANTS. Ce runner appelle périodiquement le handler via HTTP avec le
// Bearer `CRON_SECRET` — le handler reste l'unique autorité (idempotent,
// protégé ; Vercel peut continuer à l'appeler en parallèle sans double
// effet).
//
// ## Usage
//   npm run cron:local          # boucle infinie (défaut : 1 h)
//   CRON_EVERY_MIN=5 npm run cron:local   # intervalle en minutes
//   CRON_ONCE=1 npm run cron:local        # un seul passage puis sortie
//
// Non-régressif : ajout pur (process distinct), aucune modification de
// handler ni de route ; sans lui, le comportement historique est inchangé.

import { readFileSync, existsSync } from "node:fs";

const BASE_URL = process.env.CRON_BASE_URL ?? "http://127.0.0.1:3000";
const EVERY_MIN = Number(process.env.CRON_EVERY_MIN ?? 60);
const ONCE = process.env.CRON_ONCE === "1";

/** Charge .env.local si présent (le runner ne dépend pas de dotenv). */
function loadDotEnvLocal() {
  const p = ".env.local";
  if (!existsSync(p) || process.env.CRON_SECRET) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)="?([^"]*)"?\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
loadDotEnvLocal();

const SECRET = process.env.CRON_SECRET;
if (!SECRET) {
  console.error("[cron-runner] CRON_SECRET manquant (.env.local) — arrêt.");
  process.exit(1);
}

async function tick() {
  const at = new Date().toISOString();
  try {
    const res = await fetch(`${BASE_URL}/api/cron/price-alerts`, {
      headers: { authorization: `Bearer ${SECRET}` },
    });
    const body = await res.text();
    console.log(`[cron-runner] ${at} → HTTP ${res.status} ${body.slice(0, 200)}`);
  } catch (err) {
    console.warn(`[cron-runner] ${at} → échec appel (${err.message}) — prochain tick dans ${EVERY_MIN} min`);
  }
}

await tick();
if (ONCE) process.exit(0);
console.log(`[cron-runner] actif — intervalle ${EVERY_MIN} min (CTRL+C pour stopper)`);
setInterval(tick, EVERY_MIN * 60 * 1000);
