#!/usr/bin/env node
// scripts/check-ai.mjs
//
// Vérifie la cohérence interne du framework de gouvernance `.ai/`
// (AI-DOS Web). Tranché par ADR-002.
//
// Règles vérifiées (toutes pilotées par .ai/framework.manifest.json) :
//   1. framework.manifest.json est un JSON syntaxiquement valide.
//   2. Tous les mandatory_documents existent dans .ai/.
//   3. Tous les optional_documents cités existent dans .ai/ (si présents).
//   4. reading_order référence uniquement des documents existants.
//   5. La liste manifest.roles est identique aux titres "### N. Nom"
//      trouvés dans .ai/PROMPTS/roles.md (débat multi-rôles §15.2).
//   6. La proportionality_levels du manifest liste bien T/L/S/C.
//   7. STATE.md est à jour vis-à-vis du HEAD Git courant (soit référence
//      le SHA court, soit signale explicitement qu'il sera mis à jour à la
//      clôture — motif toléré : "à mettre à jour en fin de session").
//   8. CURRENT_TASK.md référence bien une tâche B-xxx et un statut valide.
//   9. Aucun lien Markdown interne cassé dans les documents obligatoires.
//
// Sortie : code 0 si tout passe, code non nul et rapport détaillé sinon.
// Ne modifie aucun fichier.

import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const AI_DIR = join(REPO_ROOT, ".ai");
const MANIFEST_PATH = join(AI_DIR, "framework.manifest.json");

const results = []; // { rule, status: "ok" | "warn" | "fail", message }

function record(rule, status, message) {
  results.push({ rule, status, message });
}

// ─────────────────────────────────────────────────────────────
// Règle 1 : manifest JSON valide
// ─────────────────────────────────────────────────────────────
let manifest = null;
try {
  const raw = readFileSync(MANIFEST_PATH, "utf8");
  manifest = JSON.parse(raw);
  record("R1 manifest_json_valid", "ok", `${MANIFEST_PATH} parsé sans erreur`);
} catch (err) {
  record("R1 manifest_json_valid", "fail", `${MANIFEST_PATH} : ${err.message}`);
  printReportAndExit();
}

// ─────────────────────────────────────────────────────────────
// Règle 2 : mandatory_documents présents
// ─────────────────────────────────────────────────────────────
const mand = manifest.mandatory_documents ?? [];
const missingMand = mand.filter((f) => !existsSync(join(AI_DIR, f)));
if (missingMand.length === 0) {
  record("R2 mandatory_present", "ok", `${mand.length} documents obligatoires trouvés`);
} else {
  record(
    "R2 mandatory_present",
    "fail",
    `Manquants : ${missingMand.join(", ")}`,
  );
}

// ─────────────────────────────────────────────────────────────
// Règle 3 : optional_documents cités existent (si présents)
// ─────────────────────────────────────────────────────────────
const opt = manifest.optional_documents ?? [];
const missingOpt = opt.filter((f) => !existsSync(join(AI_DIR, f)));
if (missingOpt.length === 0) {
  record("R3 optional_present", "ok", `${opt.length} documents optionnels tous présents`);
} else {
  record(
    "R3 optional_present",
    "warn",
    `Optionnels référencés mais absents : ${missingOpt.join(", ")}`,
  );
}

// ─────────────────────────────────────────────────────────────
// Règle 4 : reading_order pointe sur des documents existants
// ─────────────────────────────────────────────────────────────
const ord = manifest.reading_order ?? [];
const badOrd = ord.filter((f) => !existsSync(join(AI_DIR, f)));
if (badOrd.length === 0 && ord.length > 0) {
  record("R4 reading_order_valid", "ok", `reading_order (${ord.length}) tous existants`);
} else if (ord.length === 0) {
  record("R4 reading_order_valid", "fail", "reading_order vide");
} else {
  record(
    "R4 reading_order_valid",
    "fail",
    `reading_order pointe sur des documents absents : ${badOrd.join(", ")}`,
  );
}

// ─────────────────────────────────────────────────────────────
// Règle 5 : manifest.roles ↔ PROMPTS/roles.md
// ─────────────────────────────────────────────────────────────
const rolesPath = join(AI_DIR, "PROMPTS", "roles.md");
if (existsSync(rolesPath)) {
  const rolesMd = readFileSync(rolesPath, "utf8");
  const roleTitles = [...rolesMd.matchAll(/^###\s+\d+\.\s+(.+?)\s*$/gm)].map(
    (m) => m[1].trim(),
  );
  const manifestRoles = manifest.roles ?? [];
  const inManifestNotMd = manifestRoles.filter((r) => !roleTitles.includes(r));
  const inMdNotManifest = roleTitles.filter((r) => !manifestRoles.includes(r));
  if (inManifestNotMd.length === 0 && inMdNotManifest.length === 0) {
    record(
      "R5 roles_aligned",
      "ok",
      `${manifestRoles.length} rôles alignés manifest ↔ PROMPTS/roles.md`,
    );
  } else {
    const detail = [
      inManifestNotMd.length ? `manifest sans md : ${inManifestNotMd.join(" | ")}` : null,
      inMdNotManifest.length ? `md sans manifest : ${inMdNotManifest.join(" | ")}` : null,
    ]
      .filter(Boolean)
      .join(" ; ");
    record("R5 roles_aligned", "fail", detail);
  }
} else {
  record("R5 roles_aligned", "fail", "PROMPTS/roles.md introuvable");
}

// ─────────────────────────────────────────────────────────────
// Règle 6 : proportionality_levels contient T/L/S/C
// ─────────────────────────────────────────────────────────────
const levels = Object.keys(manifest.proportionality_levels ?? {});
const expected = ["T", "L", "S", "C"];
const missingLevels = expected.filter((l) => !levels.includes(l));
if (missingLevels.length === 0) {
  record("R6 proportionality_TLSC", "ok", "T/L/S/C tous présents");
} else {
  record("R6 proportionality_TLSC", "fail", `Manquants : ${missingLevels.join(", ")}`);
}

// ─────────────────────────────────────────────────────────────
// Règle 7 : STATE.md à jour vis-à-vis de Git HEAD
// ─────────────────────────────────────────────────────────────
const statePath = join(AI_DIR, "STATE.md");
if (existsSync(statePath)) {
  let gitHead = "";
  try {
    gitHead = execSync("git rev-parse --short HEAD", {
      cwd: REPO_ROOT,
      encoding: "utf8",
    }).trim();
  } catch {
    gitHead = "";
  }
  const state = readFileSync(statePath, "utf8");
  const tolerated = /à mettre à jour en fin de session/i.test(state);
  if (gitHead && state.includes(gitHead)) {
    record("R7 state_head_synced", "ok", `STATE.md référence HEAD ${gitHead}`);
  } else if (tolerated) {
    record(
      "R7 state_head_synced",
      "warn",
      `STATE.md ne référence pas HEAD ${gitHead || "(git indisponible)"} mais signale explicitement qu'il sera mis à jour en fin de session`,
    );
  } else if (!gitHead) {
    record("R7 state_head_synced", "warn", "git non disponible, vérification ignorée");
  } else {
    record(
      "R7 state_head_synced",
      "fail",
      `STATE.md ne référence pas le HEAD Git ${gitHead} et ne signale pas de mise à jour différée`,
    );
  }
} else {
  record("R7 state_head_synced", "fail", "STATE.md introuvable");
}

// ─────────────────────────────────────────────────────────────
// Règle 8 : CURRENT_TASK.md référence une tâche B-xxx + statut valide
// ─────────────────────────────────────────────────────────────
const ctPath = join(AI_DIR, "CURRENT_TASK.md");
if (existsSync(ctPath)) {
  const ct = readFileSync(ctPath, "utf8");
  const hasId = /\*\*ID\*\*\s*:\s*B-\d+/i.test(ct);
  const validStatus = /\*\*Statut\*\*|## Statut/i.test(ct) &&
    /(PLANIFIÉ|EN COURS|CORRIGÉ \(INSPECTION\)|CORRIGÉ \(VALIDÉ\)|RÉGRESSION)/.test(ct);
  if (hasId && validStatus) {
    record("R8 current_task_shape", "ok", "CURRENT_TASK.md référence une tâche B-xxx avec statut valide");
  } else {
    const details = [];
    if (!hasId) details.push("pas d'ID B-xxx trouvé");
    if (!validStatus) details.push("statut absent ou invalide");
    record("R8 current_task_shape", "fail", details.join(" ; "));
  }
} else {
  record("R8 current_task_shape", "fail", "CURRENT_TASK.md introuvable");
}

// ─────────────────────────────────────────────────────────────
// Règle 9 : liens Markdown internes des documents obligatoires
// ─────────────────────────────────────────────────────────────
const linkRe = /\[[^\]]+\]\(([^)]+)\)/g;
const broken = [];
for (const f of mand) {
  const fp = join(AI_DIR, f);
  if (!existsSync(fp)) continue;
  const text = readFileSync(fp, "utf8");
  const base = dirname(fp);
  for (const m of text.matchAll(linkRe)) {
    let link = m[1].trim();
    // ignorer les URL absolues et les ancres pures
    if (/^https?:/i.test(link) || link.startsWith("#") || link.startsWith("mailto:")) continue;
    // couper l'ancre éventuelle
    link = link.split("#")[0];
    if (!link) continue;
    const target = resolve(base, link);
    if (!existsSync(target)) {
      broken.push(`${relative(REPO_ROOT, fp)} → ${link}`);
    }
  }
}
if (broken.length === 0) {
  record("R9 internal_links", "ok", "aucun lien Markdown interne cassé dans les documents obligatoires");
} else {
  record("R9 internal_links", "fail", `Liens cassés :\n    - ${broken.join("\n    - ")}`);
}

// ─────────────────────────────────────────────────────────────
// Rapport
// ─────────────────────────────────────────────────────────────
function printReportAndExit() {
  const icons = { ok: "✅", warn: "⚠️ ", fail: "❌" };
  console.log("");
  console.log("┌─ AI-DOS Web — check-ai v" + (manifest?.version ?? "?"));
  console.log("│");
  for (const r of results) {
    console.log(`│ ${icons[r.status]} ${r.rule}`);
    for (const line of r.message.split("\n")) {
      console.log(`│    ${line}`);
    }
  }
  console.log("│");
  const nOk = results.filter((r) => r.status === "ok").length;
  const nWarn = results.filter((r) => r.status === "warn").length;
  const nFail = results.filter((r) => r.status === "fail").length;
  console.log(`└─ ${nOk} OK · ${nWarn} warn · ${nFail} fail`);
  console.log("");
  process.exit(nFail > 0 ? 1 : 0);
}

printReportAndExit();
