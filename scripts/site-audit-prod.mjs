#!/usr/bin/env node
/**
 * scripts/site-audit-prod.mjs — T-211 : site-audit sur serveur production.
 *
 * Chemin fiable observé en T-210 : `next build` puis `next start`, pas
 * `next dev`/Turbopack pour les longs crawls multi-profils. Ce wrapper :
 *   1. build l'application (sauf --skip-build) ;
 *   2. lance `next start` sur un port dédié configurable ;
 *   3. attend `/api/health` ;
 *   4. exécute `scripts/site-audit.mjs` contre cette URL ;
 *   5. arrête uniquement le serveur qu'il a lancé.
 *
 * Usage :
 *   npm run site:audit:prod
 *   npm run site:audit:prod -- --skip-build
 *   SITE_AUDIT_PROD_PORT=3200 npm run site:audit:prod
 */
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import net from "node:net";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const skipBuild = args.includes("--skip-build");
const portArgIndex = args.indexOf("--port");
const explicitPort = portArgIndex >= 0 ? args[portArgIndex + 1] : process.env.SITE_AUDIT_PROD_PORT;
const preferredPort = Number.parseInt(explicitPort ?? "3100", 10);
if (!Number.isInteger(preferredPort) || preferredPort < 1 || preferredPort > 65535) {
  console.error(`❌ Port invalide : ${explicitPort ?? preferredPort}`);
  process.exit(2);
}

function log(section) {
  console.log(`\n═══ ${section} ═══`);
}

function run(command, commandArgs, { env = process.env, stdio = "inherit" } = {}) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, commandArgs, { cwd: repo, env, stdio });
    child.on("error", rejectRun);
    child.on("exit", (code, signal) => {
      if (code === 0) resolveRun();
      else rejectRun(new Error(`${command} ${commandArgs.join(" ")} a échoué (${signal ?? `code ${code}`})`));
    });
  });
}

async function portIsBusy(port) {
  return new Promise((resolveBusy) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(400);
    socket.on("connect", () => {
      socket.destroy();
      resolveBusy(true);
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolveBusy(false);
    });
    socket.on("error", () => resolveBusy(false));
  });
}

async function choosePort() {
  if (explicitPort) {
    if (await portIsBusy(preferredPort)) {
      throw new Error(`Le port demandé ${preferredPort} est déjà occupé.`);
    }
    return preferredPort;
  }
  for (let port = preferredPort; port < preferredPort + 20; port += 1) {
    if (!(await portIsBusy(port))) return port;
  }
  throw new Error(`Aucun port libre trouvé entre ${preferredPort} et ${preferredPort + 19}.`);
}

function startNext(port) {
  const child = spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", String(port)], {
    cwd: repo,
    env: process.env,
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const tail = [];
  const capture = (chunk) => {
    const text = chunk.toString("utf8");
    process.stdout.write(text);
    for (const line of text.split(/\r?\n/)) {
      if (!line) continue;
      tail.push(line);
      if (tail.length > 80) tail.shift();
    }
  };
  child.stdout.on("data", capture);
  child.stderr.on("data", capture);
  return { child, tail };
}

async function stopNext(child) {
  if (!child || child.exitCode !== null) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try { child.kill("SIGTERM"); } catch {}
  }
  const timeout = new Promise((resolveTimeout) => setTimeout(resolveTimeout, 2500, "timeout"));
  const exited = once(child, "exit").then(() => "exit").catch(() => "exit");
  if ((await Promise.race([timeout, exited])) === "timeout") {
    try { process.kill(-child.pid, "SIGKILL"); } catch {}
  }
}

async function waitForHealth(baseUrl, child, tail) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`next start s'est arrêté avant /api/health.\n${tail.join("\n")}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`, { cache: "no-store" });
      if (response.ok) return;
    } catch {
      // Le serveur n'écoute pas encore.
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500));
  }
  throw new Error(`Timeout en attendant ${baseUrl}/api/health.\n${tail.join("\n")}`);
}

let server = null;
try {
  if (!skipBuild) {
    log("Build production");
    await run("npx", ["next", "build"]);
  }

  const port = await choosePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  log(`Serveur production (${baseUrl})`);
  server = startNext(port);
  await waitForHealth(baseUrl, server.child, server.tail);
  console.log(`✅ next start prêt sur ${baseUrl}`);

  log("Site audit");
  await run("node", ["scripts/site-audit.mjs", baseUrl]);
  console.log("\n✅ site:audit:prod OK");
} catch (error) {
  console.error(`\n❌ site:audit:prod KO — ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
} finally {
  if (server) {
    log("Arrêt du serveur production");
    await stopNext(server.child);
  }
}
