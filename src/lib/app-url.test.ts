import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { appBaseUrl } from "./app-url";

describe("appBaseUrl (T-165)", () => {
  const original = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
    else process.env.NEXT_PUBLIC_APP_URL = original;
  });

  it("utilise la variable définie (repli inutilisé)", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.example.com/";
    expect(appBaseUrl()).toBe("https://app.example.com");
  });

  it("repli absolu documenté si la variable manque (jamais de lien relatif)", () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(appBaseUrl()).toBe("https://mybestbooking.com");
  });

  it("traite un espace vide comme absent", () => {
    process.env.NEXT_PUBLIC_APP_URL = "   ";
    expect(appBaseUrl()).toBe("https://mybestbooking.com");
  });
});
