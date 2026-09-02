#!/usr/bin/env node
/**
 * scripts/site-audit.mjs — T-193 (2026-09-02) : audit d'exécution runtime.
 *
 * Crawl du site servi (par défaut http://localhost:3000) :
 *   - 4 profils : anonyme, admin, hôte, voyageur (logins démo seed)
 *   - langues : FR pour tous ; EN UNIQUEMENT en anonyme — un compte
 *     connecté dont le profil est fr DOIT rester en français (priorité
 *     profil > cookie : comportement voulu, pas un résidu).
 *   - seeds : uniquement des routes RÉELLES du routeur (jamais d'URL
 *     inventée — sinon de faux 404), enrichies des liens internes
 *     découverts dans les pages visitées.
 *
 * Détecte :
 *   - HTTP >= 500 / 404 sur page atteinte
 *   - <title>/contenu FR résiduel en EN (anonyme)
 *   - pages légales EN privé attendues (Privacy policy, Legal notice)
 *
 * Sortie : 0 = propre, 1 = au moins une issue (détaillée).
 *
 * Usage : node scripts/site-audit.mjs [BASE_URL]
 */
import { setTimeout as delay } from "node:timers/promises";

const BASE = process.argv[2] || "http://127.0.0.1:3000";
const MAX_PAGES_PER_PROFILE = 120;

const PUBLIC_ROUTES = [
  "/", "/recherche", "/connexion", "/inscription", "/aide",
  "/confidentialite", "/mentions-legales", "/bestrewards", "/mot-de-passe-oublie",
];

// Attendus légaux EN (SSR anonyme) — ancre T-162 / probe T-190.
const LEGAL_EN = {
  "/confidentialite": /Privacy policy/i,
  "/mentions-legales": /Legal notice/i,
};

const FR_MARKERS = [
  /Politique de confidentialit[ée]/, /Mentions l[ée]gales/, /Se connecter/,
  /Cr[ée]er un compte/, /Mot de passe/, /Nos h[ée]bergements/, /Mon compte/,
];

const issues = [];

async function login(email, password) {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    redirect: "manual",
  });
  if (r.status !== 200) return null;
  return r.headers.getSetCookie().map((s) => s.split(";")[0]).join("; ");
}

function discoverLinks(html) {
  const out = [];
  for (const m of html.matchAll(/href="(\/[^"#?]*)(?:\?[^"#]*)?"/g)) {
    const p = m[1].replace(/&amp;.*$/, "");
    if (p.startsWith("//") || p.startsWith("/_next") || p.startsWith("/api")) continue;
    if (/\.(jpg|jpeg|png|svg|webp|ico|css|js|woff2?|txt|xml|json)$/i.test(p)) continue;
    out.push(p);
  }
  return out;
}

async function crawl({ name, cookie, lang }) {
  const seen = new Set();
  const queue = [...PUBLIC_ROUTES];
  let count = 0;
  while (queue.length && count < MAX_PAGES_PER_PROFILE) {
    const url = queue.shift().split("#")[0];
    if (seen.has(url)) continue;
    seen.add(url);
    count++;
    const headers = { Cookie: `${cookie ? cookie + "; " : ""}mybb:ui-language=${lang}` };
    try {
      const r = await fetch(BASE + url, { headers, redirect: "follow" });
      const html = await r.text();
      if (r.status >= 500) issues.push(`${name}/${lang} ${url} → HTTP ${r.status}`);
      else if (r.status === 404) issues.push(`${name}/${lang} ${url} → 404 (route pelletée)`);
      if (r.status === 200 && lang === "en") {
        const title = (html.match(/<title>([^<]*)</) || [])[1] || "";
        for (const mk of FR_MARKERS) if (mk.test(title)) issues.push(`${name}/en ${url} → <title> FR : "${title}"`);
        if (LEGAL_EN[url]) {
          if (!LEGAL_EN[url].test(title)) issues.push(`${name}/en ${url} → attendu "${LEGAL_EN[url]}", reçu "${title}"`);
        }
        const body = html
          .replace(/<script[\s\S]*?<\/script>/g, " ")
          .replace(/<style[\s\S]*?<\/style>/g, " ")
          .replace(/<[^>]+>/g, " ");
        const hits = FR_MARKERS.filter((mk) => mk.test(body)).length;
        if (hits >= 3) issues.push(`${name}/en ${url} → ${hits} marqueurs FR résiduels`);
      }
      if (r.status === 200) {
        for (const p of discoverLinks(html)) if (!seen.has(p) && !queue.includes(p)) queue.push(p);
      }
    } catch (e) {
      issues.push(`${name}/${lang} ${url} → EXC ${String(e.message).slice(0, 80)}`);
    }
    await delay(15);
  }
  return count;
}

// Pré-vol
const health = await fetch(`${BASE}/api/health`).then((r) => r.ok).catch(() => false);
if (!health) {
  console.error(`❌ ${BASE} ne répond pas — démarrez l'app (next start / dev) puis relancez.`);
  process.exit(2);
}

const jars = [];
for (const [name, email, pw] of [
  ["admin", "admin@mybestbooking.com", "Admin123!"],
  ["host", "host@mybestbooking.com", "Host123!"],
  ["customer", "customer@mybestbooking.com", "Customer123!"],
]) {
  const c = await login(email, pw);
  if (!c) console.warn(`⚠️  login ${name} KO — rôle sauté (seed démo requis)`);
  else jars.push([name, c]);
}

const results = [];
// FR : tout le monde.
results.push([await crawl({ name: "anon", cookie: null, lang: "fr" }), "anon/fr"]);
for (const [name, c] of jars) results.push([await crawl({ name, cookie: c, lang: "fr" }), `${name}/fr`]);
// EN : anonyme uniquement (la priorité profil rendrait le test non significatif).
results.push([await crawl({ name: "anon", cookie: null, lang: "en" }), "anon/en"]);

let total = 0;
for (const [n, label] of results) { console.log(`  ✓ ${label} : ${n} pages`); total += n; }
console.log(`\nTotal : ${total} pages visitées, ${issues.length} issue(s).`);
if (issues.length) {
  for (const i of issues) console.log("  ❌ " + i);
  process.exit(1);
}
console.log("✅ Site-audit propre");
