import { describe, expect, it } from "vitest";
import {
  isDemoAccountEmail,
  publicDemoLoginEnabled,
  publicDemoSeedEnabled,
  serverDemoLoginEnabled,
  serverDemoSeedEnabled,
} from "./demo-flags";

const env = (values: Record<string, string | undefined>) => values as NodeJS.ProcessEnv;

describe("T-209 — flags de démonstration", () => {
  it("active l'UI démo par défaut hors production, mais pas en production", () => {
    expect(publicDemoLoginEnabled(env({ NODE_ENV: "development" }))).toBe(true);
    expect(publicDemoSeedEnabled(env({ NODE_ENV: "test" }))).toBe(true);
    expect(publicDemoLoginEnabled(env({ NODE_ENV: "production" }))).toBe(false);
    expect(publicDemoSeedEnabled(env({ NODE_ENV: "production" }))).toBe(false);
  });

  it("respecte les flags publics explicites", () => {
    expect(publicDemoLoginEnabled(env({ NODE_ENV: "production", NEXT_PUBLIC_ENABLE_DEMO_LOGIN: "true" }))).toBe(true);
    expect(publicDemoSeedEnabled(env({ NODE_ENV: "development", NEXT_PUBLIC_ENABLE_DEMO_SEED: "false" }))).toBe(false);
  });

  it("refuse les comptes/seed démo en production sans opt-in serveur", () => {
    expect(serverDemoLoginEnabled(env({ NODE_ENV: "production", NEXT_PUBLIC_ENABLE_DEMO_LOGIN: "true" }))).toBe(false);
    expect(serverDemoLoginEnabled(env({ NODE_ENV: "production", DEMO_LOGIN_ENABLED: "true" }))).toBe(true);
    expect(serverDemoLoginEnabled(env({ NODE_ENV: "development" }))).toBe(true);
    expect(serverDemoSeedEnabled(env({ NODE_ENV: "production", NEXT_PUBLIC_ENABLE_DEMO_SEED: "true" }))).toBe(false);
    expect(serverDemoSeedEnabled(env({ NODE_ENV: "production", DEMO_SEED_ENABLED: "true" }))).toBe(true);
  });

  it("reconnaît uniquement les emails de seed démo", () => {
    expect(isDemoAccountEmail("ADMIN@mybestbooking.com")).toBe(true);
    expect(isDemoAccountEmail("user@mybestbooking.com")).toBe(false);
  });
});
