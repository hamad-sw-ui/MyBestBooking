import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * B3 (audit n°6) — un lien sortant (e-mail, redirection, métadonnées, sitemap)
 * doit toujours être **absolu**.
 *
 * Constat d'origine : trois stratégies cohabitaient — `appBaseUrl()` (T-165,
 * repli absolu documenté), `process.env.NEXT_PUBLIC_APP_URL ?? ""` (liens
 * *relatifs* dans les e-mails de rappel et de message) et
 * `?? "http://localhost:3000"` (liens *localhost* dans les e-mails de
 * vérification, de réinitialisation et de réclamation de compte). Les sept
 * sites passent désormais par `appBaseUrl()`.
 *
 * Ce test verrouille la règle : **aucun fichier applicatif** ne lit la variable
 * directement, hors `src/lib/app-url.ts` (la source unique) et
 * `src/app/api/auth/verify/route.ts` (repli sur l'origine de la requête, qui est
 * déjà absolue et voulue pour le multi-domaine).
 */

const ALLOWED = new Set([
  "src/lib/app-url.ts",
  "src/app/api/auth/verify/route.ts",
]);

const ROOT = process.cwd();

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry) || /\.test\.(ts|tsx)$/.test(entry)) continue;
    out.push(path.relative(ROOT, full));
  }
  return out;
}

describe("B3 — base URL unique des liens sortants", () => {
  it("aucun fichier applicatif ne lit NEXT_PUBLIC_APP_URL directement", () => {
    const offenders = sourceFiles(path.join(ROOT, "src")).filter((file) => {
      if (ALLOWED.has(file)) return false;
      const src = readFileSync(path.join(ROOT, file), "utf8");
      // La variable n'est autorisée qu'en commentaire (documentation) : on ne
      // cherche que les lectures de code.
      return src
        .split("\n")
        .some((line) => line.includes("NEXT_PUBLIC_APP_URL") && !line.trimStart().startsWith("//") && !line.trimStart().startsWith("*"));
    });
    expect(offenders).toEqual([]);
  });

  it("appBaseUrl() renvoie toujours une base absolue (variable absente ou définie)", async () => {
    const { appBaseUrl } = await import("@/lib/app-url");
    const original = process.env.NEXT_PUBLIC_APP_URL;
    try {
      delete process.env.NEXT_PUBLIC_APP_URL;
      expect(appBaseUrl()).toMatch(/^https?:\/\//);
      process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com///";
      expect(appBaseUrl()).toBe("https://app.example.com");
    } finally {
      if (original === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
      else process.env.NEXT_PUBLIC_APP_URL = original;
    }
  });
});
