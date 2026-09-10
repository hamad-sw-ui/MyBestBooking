const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

function readBooleanFlag(value: string | undefined): boolean | null {
  if (value == null || value.trim() === "") return null;
  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return null;
}

function publicDemoFlag(value: string | undefined, nodeEnv: string | undefined): boolean {
  const explicit = readBooleanFlag(value);
  if (explicit !== null) return explicit;
  return nodeEnv !== "production";
}

export function publicDemoLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return publicDemoFlag(env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN, env.NODE_ENV);
}

export function publicDemoSeedEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return publicDemoFlag(env.NEXT_PUBLIC_ENABLE_DEMO_SEED, env.NODE_ENV);
}

/**
 * Garde serveur du seed de démonstration : même logique que les comptes démo,
 * avec opt-in serveur obligatoire en production en plus d'un éventuel SEED_TOKEN.
 */
export function serverDemoSeedEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const explicitServer = readBooleanFlag(env.DEMO_SEED_ENABLED);
  if (explicitServer !== null) return explicitServer;
  if (env.NODE_ENV === "production") return false;
  return publicDemoSeedEnabled(env);
}

/**
 * Garde serveur : en production réelle, les comptes démo ne sont utilisables
 * que si l'opérateur a posé un opt-in serveur explicite. Le flag public sert à
 * masquer/afficher l'UI, jamais à autoriser seul une connexion admin en prod.
 */
export function serverDemoLoginEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const explicitServer = readBooleanFlag(env.DEMO_LOGIN_ENABLED);
  if (explicitServer !== null) return explicitServer;
  if (env.NODE_ENV === "production") return false;
  return publicDemoLoginEnabled(env);
}

export const DEMO_ACCOUNT_EMAILS = new Set([
  "admin@mybestbooking.com",
  "host@mybestbooking.com",
  "customer@mybestbooking.com",
]);

export function isDemoAccountEmail(email: string): boolean {
  return DEMO_ACCOUNT_EMAILS.has(email.trim().toLowerCase());
}
