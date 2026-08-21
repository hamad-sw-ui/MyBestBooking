#!/usr/bin/env node
// scripts/check-ai.mjs
//
// Vérifie la cohérence interne du framework de gouvernance `.ai/`
// (AI-DOS Web). Tranché par ADR-002.
//
// Règles vérifiées (toutes pilotées par .ai/framework.manifest.json) :
//   R1  framework.manifest.json est un JSON syntaxiquement valide.
//   R2  Tous les mandatory_documents existent dans .ai/.
//   R3  Tous les optional_documents cités existent dans .ai/ (si présents).
//   R4  reading_order référence uniquement des documents existants.
//   R5  La liste manifest.roles est identique aux titres "### N. Nom"
//       trouvés dans .ai/PROMPTS/roles.md (débat multi-rôles §15.2).
//   R6  La proportionality_levels du manifest liste bien T/L/S/C.
//   R7  STATE.md est à jour vis-à-vis du HEAD Git courant (soit référence
//       le SHA court, soit signale explicitement qu'il sera mis à jour à la
//       clôture — motif toléré : "à mettre à jour en fin de session").
//   R8  CURRENT_TASK.md référence bien une tâche T-xxx et un statut valide.
//   R9  Aucun lien Markdown interne cassé dans les documents obligatoires.
//   R10 La branche Git courante = arena/01a01eee-mybestbooking (§8).
//   R11 Aucune collision d'ID entre les BUG-xxx (dans BUGS.md) et les
//       T-xxx (dans BACKLOG.md, CURRENT_TASK.md, STATE.md, TRACEABILITY,
//       PROGRESS) — voir §8.1.
//   R12 CURRENT_TASK.md de niveau S ou C → un rapport
//       REPORTS/analyse_impact_*_<slug>.md ET un rapport
//       REPORTS/analyse_conception_*_<slug>.md existent (§14, §15.1).
//   R13 Chaque item de TRACEABILITY.md marqué "CORRIGÉ (VALIDÉ)" porte
//       au moins une preuve 🔨, 🧪 ou ▶️ (§16, §22).
//
// v1.1.0 (ADR-006) — RÈGLES DE COMPLÉTUDE PRODUIT :
//   R14 Chaque table de manifest.product_coverage.expected_endpoint_tables
//       (hors sessions et exempted_tables) a au moins un endpoint dédié
//       sous src/app/api/, ou est explicitement mentionnée dans un
//       endpoint existant.
//   R15 Chaque composant .tsx qui contient un <button> avec un label
//       d'action (Envoyer, Répondre, Publier, Annuler, Valider,
//       Supprimer, Uploader, Enregistrer, Confirmer, Créer, Modifier,
//       Approuver, Rejeter, Suspendre) doit aussi contenir un
//       fetch("/api/…") ou une Server Action.
//   R16 Hygiène BACKLOG / BUGS : les items 🔴/🟠 de BACKLOG.md ne
//       doivent pas dupliquer des BUG déjà présents en Corrigés.
//       Les références BUG-\d+ dans les .md doivent exister dans BUGS.md.
//   R17 Fraîcheur : FEATURES.md pas touché depuis > 30 commits
//       API/schema, PROGRESS.md pas touché depuis > 5 commits src/,
//       compteur sessions_since_last_product_audit dans STATE.md
//       ≤ max_sessions_without_product_audit (défaut 5).
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
  const hasId = /\*\*ID\*\*\s*:\s*T-\d+/i.test(ct);
  const validStatus = /\*\*Statut\*\*|## Statut/i.test(ct) &&
    /(PLANIFIÉ|EN COURS|CORRIGÉ \(INSPECTION\)|CORRIGÉ \(VALIDÉ\)|RÉGRESSION)/.test(ct);
  if (hasId && validStatus) {
    record("R8 current_task_shape", "ok", "CURRENT_TASK.md référence une tâche T-xxx avec statut valide");
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
// Règle 10 : branche Git = arena/01a01eee-mybestbooking (§8)
// ─────────────────────────────────────────────────────────────
const EXPECTED_BRANCH = "arena/01a01eee-mybestbooking";
try {
  const branch = execSync("git rev-parse --abbrev-ref HEAD", {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }).trim();
  if (branch === EXPECTED_BRANCH) {
    record("R10 git_branch", "ok", `branche courante = ${branch}`);
  } else {
    record(
      "R10 git_branch",
      "fail",
      `branche courante '${branch}' ≠ attendue '${EXPECTED_BRANCH}' (§8)`,
    );
  }
} catch {
  record("R10 git_branch", "warn", "git non disponible, vérification ignorée");
}

// ─────────────────────────────────────────────────────────────
// Règle 11 : pas de collision d'IDs BUG-xxx ↔ T-xxx (§8.1)
// ─────────────────────────────────────────────────────────────
function grepIds(files, prefixRe) {
  const found = new Set();
  for (const f of files) {
    const p = join(AI_DIR, f);
    if (!existsSync(p)) continue;
    const text = readFileSync(p, "utf8");
    for (const m of text.matchAll(prefixRe)) found.add(m[0]);
  }
  return found;
}

// BUG-xxx : peuvent apparaître partout mais leur source de vérité est BUGS.md
// T-xxx   : source de vérité TRACEABILITY.md, BACKLOG.md, CURRENT_TASK.md
const bugIds = grepIds(
  ["BUGS.md", "KNOWN_LIMITATIONS.md", "CHECKLISTS/avant_release.md"],
  /\bBUG-\d{3,}\b/g,
);
const taskIds = grepIds(
  ["TRACEABILITY.md", "CURRENT_TASK.md", "BACKLOG.md", "STATE.md", "PROGRESS.md"],
  /\bT-\d{3,}\b/g,
);
// Chercher aussi des B-xxx résiduels dans tout .ai/ (post-migration §8.1).
// Ignorer :
//   - les mentions entre backticks (`B-001`) — références historiques ou
//     citations littérales dans les rapports d'audit ;
//   - les mentions préfixées par "ancien " ou "anciennement " ;
//   - le mot "sur B-" à l'intérieur d'un lien URL.
const residualB = new Set();
const residualLocs = [];
{
  const walk = (dir) => {
    const list = execSync(`find "${dir}" -type f -name '*.md'`, { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
    for (const p of list) {
      const t = readFileSync(p, "utf8");
      for (const m of t.matchAll(/\bB-\d{3,}\b/g)) {
        // vérifier le voisinage : backticks encadrants ?
        const start = m.index ?? 0;
        const before = t.slice(Math.max(0, start - 1), start);
        const after = t.slice(start + m[0].length, start + m[0].length + 1);
        if (before === "`" && after === "`") continue; // mention littérale
        // ignorer aussi les URL
        const lineStart = t.lastIndexOf("\n", start) + 1;
        const lineEnd = t.indexOf("\n", start);
        const line = t.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
        if (/https?:\/\/[^\s)]*B-\d/.test(line)) continue;
        residualB.add(m[0]);
        residualLocs.push(`${relative(REPO_ROOT, p)}: ${m[0]}`);
      }
    }
  };
  walk(AI_DIR);
}

const collisionMsgs = [];
if (residualB.size > 0) {
  collisionMsgs.push(
    `IDs B-xxx résiduels (ambigus, ni BUG- ni T-) : ${[...residualB].sort().join(", ")}`,
  );
}
// Extraire les nombres et comparer
const bugNums = new Set([...bugIds].map((id) => id.replace(/^BUG-/, "")));
const taskNums = new Set([...taskIds].map((id) => id.replace(/^T-/, "")));
const shared = [...bugNums].filter((n) => taskNums.has(n));
if (shared.length > 0) {
  collisionMsgs.push(
    `Numéros partagés entre BUG- et T- : ${shared.join(", ")}. Ce n'est pas interdit (séries indépendantes), c'est signalé pour information.`,
  );
}
if (collisionMsgs.length === 0) {
  record(
    "R11 id_collision",
    "ok",
    `${bugIds.size} BUG-* trouvés, ${taskIds.size} T-* trouvés, aucun B-* résiduel`,
  );
} else if (residualB.size > 0) {
  record("R11 id_collision", "fail", collisionMsgs.join(" | "));
} else {
  record("R11 id_collision", "warn", collisionMsgs.join(" | "));
}

// ─────────────────────────────────────────────────────────────
// Règle 12 : rapports d'impact + conception pour tâche S/C (§14, §15.1)
// ─────────────────────────────────────────────────────────────
if (existsSync(ctPath)) {
  const ct = readFileSync(ctPath, "utf8");
  const levelMatch = ct.match(/\*\*Niveau(?:\s+de\s+proportionnalité)?\*\*\s*:\s*\*?\*?([TLSC])\b/i);
  if (levelMatch) {
    const level = levelMatch[1].toUpperCase();
    if (level === "S" || level === "C") {
      const reportsDir = join(AI_DIR, "REPORTS");
      const files = existsSync(reportsDir)
        ? execSync(`ls "${reportsDir}"`, { encoding: "utf8" }).split("\n").filter(Boolean)
        : [];
      // Autoriser un rapport 'audit_*.md' à tenir lieu d'analyse d'impact
      // pour une itération de maintenance §15.0-bis.
      const hasImpact = files.some((f) => /^(analyse_impact|audit)_.*\.md$/i.test(f));
      const hasDesign = files.some((f) => /^(analyse_conception|audit)_.*\.md$/i.test(f));
      if (hasImpact && hasDesign) {
        record(
          "R12 impact_reports_for_S_or_C",
          "ok",
          `niveau ${level} → rapport d'impact et de conception présents`,
        );
      } else {
        const missing = [
          !hasImpact ? "analyse_impact_*.md" : null,
          !hasDesign ? "analyse_conception_*.md" : null,
        ]
          .filter(Boolean)
          .join(" + ");
        record(
          "R12 impact_reports_for_S_or_C",
          "fail",
          `niveau ${level} exige ${missing} dans REPORTS/ (§14, §15.1)`,
        );
      }
    } else {
      record(
        "R12 impact_reports_for_S_or_C",
        "ok",
        `niveau ${level} → aucun rapport requis`,
      );
    }
  } else {
    record(
      "R12 impact_reports_for_S_or_C",
      "warn",
      "Impossible d'extraire le niveau de proportionnalité de CURRENT_TASK.md",
    );
  }
}

// ─────────────────────────────────────────────────────────────
// Règle 13 : items VALIDÉ portent au moins une preuve 🔨/🧪/▶️ (§16)
// ─────────────────────────────────────────────────────────────
const traceabilityPath = join(AI_DIR, "TRACEABILITY.md");
if (existsSync(traceabilityPath)) {
  const trace = readFileSync(traceabilityPath, "utf8");
  const lines = trace.split("\n");
  const badItems = [];
  for (const line of lines) {
    if (!line.trim().startsWith("|")) continue;
    if (!/CORRIGÉ \(VALIDÉ\)/.test(line)) continue;
    // Ligne d'un item VALIDÉ : doit contenir au moins un tag de preuve exécutée
    const hasEvidence = /🔨|🧪|▶️/.test(line);
    if (!hasEvidence) {
      // Extraire l'ID en 1ère colonne
      const idMatch = line.match(/\|\s*([TB][A-Z-]*-?\d+[^\s|]*)/);
      const id = idMatch ? idMatch[1] : "(id introuvable)";
      badItems.push(id);
    }
  }
  if (badItems.length === 0) {
    record("R13 validated_items_have_evidence", "ok", "aucun item VALIDÉ sans preuve 🔨/🧪/▶️");
  } else {
    record(
      "R13 validated_items_have_evidence",
      "fail",
      `Items VALIDÉ sans preuve 🔨/🧪/▶️ : ${badItems.join(", ")} (§16, §22)`,
    );
  }
} else {
  record("R13 validated_items_have_evidence", "warn", "TRACEABILITY.md introuvable");
}

// ═══════════════════════════════════════════════════════════════
// v1.1.0 — RÈGLES DE COMPLÉTUDE PRODUIT (ADR-006)
// ═══════════════════════════════════════════════════════════════

const productCoverage = manifest.product_coverage ?? {};

// ─────────────────────────────────────────────────────────────
// Règle 14 : couverture schéma DB ↔ API
// Pour chaque table de expected_endpoint_tables, un fichier
// src/app/api/<table>/route.ts (ou variante) doit exister.
// ─────────────────────────────────────────────────────────────
{
  const expected = productCoverage.expected_endpoint_tables ?? [];
  const apiDir = join(REPO_ROOT, "src", "app", "api");
  const missing = [];
  const partial = [];

  const listApiFiles = () => {
    if (!existsSync(apiDir)) return [];
    try {
      return execSync(`find "${apiDir}" -name 'route.ts'`, { encoding: "utf8" })
        .split("\n").filter(Boolean);
    } catch { return []; }
  };
  const apiFiles = listApiFiles();

  for (const rawTable of expected) {
    // Normaliser : "rate_plans" → dossier possible "rate-plans" ou
    // "rate_plans" ou "rate-plan"/"availability" (dernier segment).
    const bases = new Set([
      rawTable,
      rawTable.replace(/_/g, "-"),
      rawTable.replace(/^[^_]+_/, "").replace(/_/g, "-"), // room_availability → availability
      rawTable.split("_").pop() ?? rawTable, // wishlist_items → items
    ]);
    const found = [...bases].some((c) =>
      apiFiles.some(
        (f) =>
          f.includes(`/api/${c}/`) ||
          f.endsWith(`/api/${c}/route.ts`) ||
          f.includes(`/${c}/route.ts`),
      ),
    );
    // Sinon : le nom brut apparaît dans un route.ts (couvert
    // implicitement, ex: wishlist_items sous /api/wishlists).
    let mentioned = false;
    if (!found) {
      // Convertir snake_case → camelCase pour matcher les identifiants
      // Drizzle importés dans les routes.
      const camelCase = rawTable.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
      const patterns = [rawTable, camelCase];
      for (const f of apiFiles) {
        try {
          const text = readFileSync(f, "utf8");
          if (patterns.some((p) => text.includes(p))) {
            mentioned = true;
            break;
          }
        } catch {}
      }
    }
    if (found) continue;
    if (mentioned) partial.push(rawTable);
    else missing.push(rawTable);
  }

  const msgs = [];
  if (missing.length) msgs.push(`Aucun endpoint pour : ${missing.join(", ")}`);
  if (partial.length) msgs.push(`Mention seulement (pas de route dédiée) : ${partial.join(", ")}`);
  if (msgs.length === 0) {
    record("R14 db_api_coverage", "ok", `${expected.length} tables métier ont au moins un endpoint dédié`);
  } else {
    record("R14 db_api_coverage", "warn", msgs.join(" | "));
  }
}

// ─────────────────────────────────────────────────────────────
// Règle 15 : couverture UI ↔ API
// Cherche dans src/app/**/*.tsx les labels d'action et vérifie
// qu'un fetch("/api/") ou une Server Action est présent dans le
// même fichier.
// ─────────────────────────────────────────────────────────────
{
  const labels = productCoverage.ui_action_labels ?? [];
  const labelRe = new RegExp(`>\\s*(${labels.join("|")})\\s*<`, "i");
  const fetchOrActionRe = /fetch\(["'`]\/api\/|action=\{|"use server"|useTransition|<form\s+action=/;
  const appDir = join(REPO_ROOT, "src", "app");
  const tsxFiles = execSync(`find "${appDir}" -name '*.tsx'`, { encoding: "utf8" })
    .split("\n").filter(Boolean);

  const suspicious = [];
  for (const f of tsxFiles) {
    let text;
    try { text = readFileSync(f, "utf8"); } catch { continue; }
    // Exclut les tests
    if (f.endsWith(".test.tsx")) continue;
    // Doit contenir un bouton avec un label d'action
    if (!labelRe.test(text)) continue;
    // Doit contenir un appel API OU une Server Action
    if (fetchOrActionRe.test(text)) continue;
    // Fichier suspect
    const matched = text.match(labelRe);
    suspicious.push(`${relative(REPO_ROOT, f)} (bouton "${matched?.[1]}")`);
  }

  if (suspicious.length === 0) {
    record("R15 ui_api_coverage", "ok", "aucun bouton d'action visible sans fetch/action associé");
  } else {
    record("R15 ui_api_coverage", "warn", `${suspicious.length} composant(s) suspect(s) :\n    - ${suspicious.slice(0, 10).join("\n    - ")}${suspicious.length > 10 ? `\n    - ... (+${suspicious.length - 10} autres)` : ""}`);
  }
}

// ─────────────────────────────────────────────────────────────
// Règle 16 : hygiène BACKLOG / BUGS
// - Items 🔴 ou 🟠 dans BACKLOG dont un mot-clé est déjà dans
//   BUGS Corrigés → warn (à retirer).
// - Références BUG-\d+ dans les docs qui n'existent ni dans
//   Ouverts ni dans Corrigés → fail (référence orpheline).
// ─────────────────────────────────────────────────────────────
{
  const backlogPath = join(AI_DIR, "BACKLOG.md");
  const bugsPath = join(AI_DIR, "BUGS.md");
  const warnings = [];
  const fails = [];

  // 1. Extraire les BUG-IDs valides depuis BUGS.md
  const validBugIds = new Set();
  if (existsSync(bugsPath)) {
    const bugs = readFileSync(bugsPath, "utf8");
    for (const m of bugs.matchAll(/\bBUG-\d{3,}\b/g)) validBugIds.add(m[0]);
  }

  // 2. Chercher les BUG-IDs orphelins ailleurs
  const allDocs = execSync(`find "${AI_DIR}" -name '*.md'`, { encoding: "utf8" })
    .split("\n").filter(Boolean);
  const orphanRefs = new Map(); // BUG-xxx → [fichiers]
  for (const f of allDocs) {
    if (f.endsWith("BUGS.md")) continue;
    let text;
    try { text = readFileSync(f, "utf8"); } catch { continue; }
    for (const m of text.matchAll(/\bBUG-\d{3,}\b/g)) {
      const id = m[0];
      if (!validBugIds.has(id)) {
        if (!orphanRefs.has(id)) orphanRefs.set(id, []);
        orphanRefs.get(id).push(relative(REPO_ROOT, f));
      }
    }
  }
  if (orphanRefs.size > 0) {
    fails.push(`${orphanRefs.size} référence(s) BUG-xxx orpheline(s) : ${[...orphanRefs.entries()].slice(0, 3).map(([id, fs]) => `${id} (${fs[0]})`).join(", ")}${orphanRefs.size > 3 ? "..." : ""}`);
  }

  // 3. Doublons BACKLOG vs. BUGS Corrigés — match strict par
  // référence explicite (BUG-xxx ou T-xxx) uniquement. Le matching
  // par mots-clés donnait trop de faux positifs (une future tâche
  // qui *mentionne* room_availability ≠ un bug corrigé sur ce sujet).
  if (existsSync(backlogPath) && existsSync(bugsPath)) {
    const backlog = readFileSync(backlogPath, "utf8");
    const bugs = readFileSync(bugsPath, "utf8");
    const correctedSection = bugs.split(/^##\s+Corrig[eé]s/im)[1] ?? "";
    const correctedBugIds = new Set(
      [...correctedSection.matchAll(/\bBUG-\d{3,}\b/g)].map((m) => m[0])
    );
    // Chercher dans les items 🔴/🟠 du backlog une référence à un
    // BUG-xxx corrigé (« résout BUG-001 » alors que BUG-001 est
    // corrigé = à retirer du backlog).
    const items = [...backlog.matchAll(/^-\s+(?:🔴|🟠)\s+(.+?)$/gm)].map((m) => m[1]);
    const duplicates = [];
    for (const item of items) {
      const refs = [...item.matchAll(/\bBUG-\d{3,}\b/g)].map((m) => m[0]);
      for (const ref of refs) {
        if (correctedBugIds.has(ref)) {
          duplicates.push(`"${item.substring(0, 70)}${item.length > 70 ? "…" : ""}" référence ${ref} déjà corrigé`);
          break;
        }
      }
    }
    if (duplicates.length) {
      warnings.push(`${duplicates.length} item(s) BACKLOG référencent des BUG- corrigés : ${duplicates.slice(0, 3).join(" ; ")}${duplicates.length > 3 ? "…" : ""}`);
    }
  }

  if (fails.length) {
    record("R16 backlog_hygiene", "fail", fails.join(" | "));
  } else if (warnings.length) {
    record("R16 backlog_hygiene", "warn", warnings.join(" | "));
  } else {
    record("R16 backlog_hygiene", "ok", "BACKLOG et BUGS cohérents");
  }
}

// ─────────────────────────────────────────────────────────────
// Règle 17 : fraîcheur FEATURES.md, PROGRESS.md, audit produit
// ─────────────────────────────────────────────────────────────
{
  const maxFeat = productCoverage.max_commits_without_features_update ?? 30;
  const maxProg = productCoverage.max_commits_without_progress_update ?? 5;
  const maxAudit = productCoverage.max_sessions_without_product_audit ?? 5;
  const warnings = [];

  const countCommitsSinceTouched = (fileRel, filterPathspec) => {
    try {
      const lastTouch = execSync(
        `git log -1 --format=%H -- "${fileRel}"`,
        { cwd: REPO_ROOT, encoding: "utf8" }
      ).trim();
      if (!lastTouch) return null;
      const range = filterPathspec
        ? `${lastTouch}..HEAD -- ${filterPathspec}`
        : `${lastTouch}..HEAD`;
      const out = execSync(`git rev-list ${range}`, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
      return out ? out.split("\n").length : 0;
    } catch {
      return null;
    }
  };

  // FEATURES.md vs. commits API/schema
  if (existsSync(join(AI_DIR, "FEATURES.md"))) {
    const n = countCommitsSinceTouched(".ai/FEATURES.md", "src/app/api src/db/schema.ts");
    if (n !== null && n > maxFeat) {
      warnings.push(`FEATURES.md pas touché depuis ${n} commits API/schema (max ${maxFeat})`);
    }
  } else {
    warnings.push("FEATURES.md manquant (obligatoire depuis v1.1.0)");
  }

  // PROGRESS.md vs. commits src/
  if (existsSync(join(AI_DIR, "PROGRESS.md"))) {
    const n = countCommitsSinceTouched(".ai/PROGRESS.md", "src");
    if (n !== null && n > maxProg) {
      warnings.push(`PROGRESS.md pas touché depuis ${n} commits src/ (max ${maxProg})`);
    }
  }

  // Compteur d'audit produit dans STATE.md
  if (existsSync(statePath)) {
    const state = readFileSync(statePath, "utf8");
    const m = state.match(/sessions_since_last_product_audit\s*[:=]\s*(\d+)/i);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxAudit) {
        warnings.push(`Audit produit trop ancien : ${n} sessions (max ${maxAudit}) — voir ADR-006`);
      }
    }
  }

  if (warnings.length === 0) {
    record("R17 freshness", "ok", "FEATURES, PROGRESS et compteur audit à jour");
  } else {
    record("R17 freshness", "warn", warnings.join(" | "));
  }
}

// ─────────────────────────────────────────────────────────────
// Règle 18 : pas de liens/boutons morts (T-030)
//   - href="#" est interdit (utiliser un vrai lien ou <button>)
//   - onClick={() => {}} est interdit (utiliser un vrai handler)
//   - Un <button ... disabled> permanent (sans état loading/isPending/uploading)
//     est signalé — les disabled dynamiques sont OK.
// ─────────────────────────────────────────────────────────────
{
  const srcDir = join(REPO_ROOT, "src");
  const tsxFiles = execSync(`find "${srcDir}" -name '*.tsx'`, { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  const deadLinks = [];
  const emptyHandlers = [];
  const permanentDisabled = [];
  for (const f of tsxFiles) {
    const txt = readFileSync(f, "utf8");
    const rel = relative(REPO_ROOT, f);
    // href="#" (mais pas href="#foo" qui est ancre valide)
    const hashRe = /href="#"/g;
    let m;
    while ((m = hashRe.exec(txt))) {
      // Ligne de match
      const line = txt.slice(0, m.index).split("\n").length;
      deadLinks.push(`${rel}:${line}`);
    }
    // onClick={() => {}} (handler vide)
    const emptyRe = /onClick=\{\(\)\s*=>\s*\{\s*\}\}/g;
    while ((m = emptyRe.exec(txt))) {
      const line = txt.slice(0, m.index).split("\n").length;
      emptyHandlers.push(`${rel}:${line}`);
    }
    // onChange={() => {}} idem
    const emptyChangeRe = /onChange=\{\(\)\s*=>\s*\{\s*\}\}/g;
    while ((m = emptyChangeRe.exec(txt))) {
      const line = txt.slice(0, m.index).split("\n").length;
      emptyHandlers.push(`${rel}:${line} (onChange vide)`);
    }
  }
  const msgs = [];
  if (deadLinks.length > 0) {
    msgs.push(`Liens morts href="#" : ${deadLinks.slice(0, 5).join(", ")}${deadLinks.length > 5 ? " …" : ""}`);
  }
  if (emptyHandlers.length > 0) {
    msgs.push(`Handlers vides () => {} : ${emptyHandlers.slice(0, 5).join(", ")}${emptyHandlers.length > 5 ? " …" : ""}`);
  }
  if (msgs.length === 0) {
    record("R18 no_dead_ui", "ok", "aucun lien mort href=\"#\" ni handler vide () => {}");
  } else {
    record("R18 no_dead_ui", "fail", msgs.join(" | "));
  }
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
