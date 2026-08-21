// Fournit les env vars minimales aux tests unitaires.
// Les tests qui vérifient l'absence d'une variable (ex : JWT_SECRET dans
// src/lib/auth.test.ts) sont libres de la supprimer avant l'import via
// process.env.<VAR> = undefined ou delete process.env.<VAR>, à condition
// d'appeler vi.resetModules() au préalable.

process.env.DATABASE_URL ??=
  "postgresql://postgres:postgres@127.0.0.1:55432/app_db";
process.env.JWT_SECRET ??=
  "test-secret-64chars-abcdefghijklmnopqrstuvwxyz0123456789ABCDEF";
process.env.NEXT_PUBLIC_APP_URL ??= "http://localhost:3000";
