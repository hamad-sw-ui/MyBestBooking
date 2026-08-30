import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
import { existsSync } from "node:fs";

// Charge .env.local si présent (dev), sinon .env, sinon rien (CI).
// Dotenv est déjà déclaré comme dépendance (voir DEPENDENCIES.md).
if (existsSync(".env.local")) config({ path: ".env.local" });
else if (existsSync(".env")) config({ path: ".env" });

const url =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@127.0.0.1:55432/app_db";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
});
