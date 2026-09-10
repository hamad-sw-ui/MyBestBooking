import { describe, expect, it } from "vitest";
import { platformPayoutsEnabled } from "./platform-flags";

const env = (values: Record<string, string | undefined>) => values as NodeJS.ProcessEnv;

describe("T-209 — flags plateforme", () => {
  it("désactive les payouts legacy par défaut", () => {
    expect(platformPayoutsEnabled(env({}))).toBe(false);
    expect(platformPayoutsEnabled(env({ PLATFORM_PAYOUTS_ENABLED: "false" }))).toBe(false);
  });

  it("active seulement sur opt-in serveur explicite", () => {
    expect(platformPayoutsEnabled(env({ PLATFORM_PAYOUTS_ENABLED: "true" }))).toBe(true);
    expect(platformPayoutsEnabled(env({ PLATFORM_PAYOUTS_ENABLED: "1" }))).toBe(true);
  });
});
