import { defineConfig, devices } from "@playwright/test";

/**
 * Configuration Playwright (T-011, ADR-006).
 *
 * Exécution :
 *   npm run e2e            → tous les parcours PAR-xxx de PRODUCT_ACCEPTANCE.md
 *   npm run e2e:ui         → interface interactive
 *
 * Prérequis :
 *   - PostgreSQL local (npm run db:dev) OU CI service Postgres
 *   - JWT_SECRET défini dans .env.local
 *   - Serveur dev démarré via webServer ci-dessous
 *
 * En environnement sandbox sans réseau CDN (Google Chromium),
 * les tests E2E sont skippés. Ils sont exécutés en CI GitHub Actions
 * et en local dev.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    navigationTimeout: 120_000,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run start -- -H 0.0.0.0 -p 3100",
        url: "http://localhost:3100",
        reuseExistingServer: true,
        timeout: 300_000,
      },
});
