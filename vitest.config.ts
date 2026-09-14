import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
    exclude: ["node_modules", "tests/e2e/**", ".next/**"],
    setupFiles: ["tests/setup.ts"],
    // Disque lent (I/O synchronisées / volume réseau) : le pool par défaut
    // sature et Vitest ne parvient plus à terminer ses workers à temps
    // (« Timeout terminating forks worker »), ce qui fait échouer des suites
    // dont les assertions passent pourtant. On borne donc la parallélisation
    // et on laisse davantage de temps au teardown.
    maxWorkers: 2,
    teardownTimeout: 60_000,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**", "src/db/**", "src/app/api/**"],
    },
    testTimeout: 15000,
  },
});
