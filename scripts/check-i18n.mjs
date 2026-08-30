#!/usr/bin/env node
/**
 * T-158 (audit n°29) — Garde-fou CI i18n (WARN).
 *
 * Objectif : signaler les libellés français en dur dans la surface
 * publique (app routes + composants partagés) afin qu'une vague i18n
 * suivante (ou un futur changement) ne reparte pas de zéro.
 *
 * - Par défaut : WARN-ONLY (exit 0) — il informe, ne bloque pas un
 *   commit (les dashboards/admin ont leur propre cycle de localisation).
 * - `--strict` : exit 1 si des candidats subsistent (à activer quand la
 *   série de fichiers signalés sera réduite).
 * - Exclusions : commentaires JS, imports/paths, fichiers de
 *   dictionnaires (`src/lib/ui-strings.ts`, `seeds`, `scripts`),
 *   données métier (noms de propriétés, descriptions rédigées par les
 *   hôtes) restent HORS périmètre : on ne signale que du code UI.
 *
 * Heuristique volontairement simple : texte JSX ou chaîne JavaScript
 * contenant au moins une lettre accentuée française. Les faux positifs
 * possibles (ex. une chaîne d'URL) sont tolérables pour un warning.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const STRICT = process.argv.includes("--strict");

const ACCENTS = /[àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ]/;
const EXCLUDED_DIRS = new Set([".next", "node_modules", ".data", "dist", "coverage"]);
// Périmètre : surface UI (routes publiques + dashboard + composants).
// Les contenus métier (seed, mails, settings) et les API restent hors
// périmètre : ce garde-fou surveille les libellés d'interface.
const SCAN_ROOTS = ["src/app/(main)", "src/app/(auth)", "src/app/dashboard", "src/components"];
// Fichiers-sources de dictionnaires et données : légitimes, exclus.
const EXCLUDED_FILES = new Set([
  "src/lib/ui-strings.ts",
  "src/lib/amenities.ts",
  "src/db/seed.ts",
  "src/lib/mail/strings.ts",
]);
const SKIP_LINE = /^\s*(\/\/|\/\*|\*|import\s|export\s+.*\bfrom\b)/;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (EXCLUDED_DIRS.has(entry)) continue;
    if (statSync(full).isDirectory()) {
      yield* walk(full);
    } else if (full.endsWith(".tsx") || (full.endsWith(".ts") && !full.endsWith(".test.ts"))) {
      yield full;
    }
  }
}

const hits = [];
for (const root of SCAN_ROOTS) {
  const base = join(ROOT, root);
  if (!statSync(base, { throwIfNoEntry: false })?.isDirectory()) continue;
  for (const file of walk(base)) {
    const rel = relative(ROOT, file);
    if ([...EXCLUDED_FILES].some((x) => rel.endsWith(x))) continue;
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (SKIP_LINE.test(line)) return;
      if (!ACCENTS.test(line)) return;
      // Chaîne JS ou texte JSX contenant un accent français.
      if (/"[^"\n]*[àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ][^"\n]*"|'[^'\n]*[àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ][^'\n]*'|>[^<>\n]*[àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ][^<>\n]*</.test(line)) {
        hits.push({ file: rel, line: i + 1, text: line.trim().slice(0, 110) });
      }
    });
  }
}

const byFile = new Map();
for (const h of hits) {
  if (!byFile.has(h.file)) byFile.set(h.file, []);
  byFile.get(h.file).push(h);
}

console.log("═ Garde-fou i18n (WARN) — libellés FR potentiels dans la surface UI ═\n");
if (!hits.length) {
  console.log("✅ Aucun candidat détecté — surface UI cohérente.");
  process.exit(0);
}

console.log(`⚠️  ${hits.length} lignes candidates dans ${byFile.size} fichier(s) :`);
for (const [file, lines] of [...byFile.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n  ${file} (${lines.length})`);
  for (const h of lines.slice(0, 4)) {
    console.log(`    :${h.line}  ${h.text}`);
  }
  if (lines.length > 4) console.log(`    … +${lines.length - 4} ligne(s)`);
}

console.log(
  `\n${STRICT ? "❌" : "ℹ️"}  Warn-only par défaut (exit 0) — activer --strict quand ce fichier de signalement sera réduit.`,
);
process.exit(STRICT ? 1 : 0);
