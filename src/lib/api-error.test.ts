import { describe, it, expect } from "vitest";
import { localizeApiMessage } from "./api-error";

describe("localizeApiMessage (T-168)", () => {
  it("conserve le français par défaut", () => {
    expect(localizeApiMessage("Non autorisé", "fr")).toBe("Non autorisé");
    expect(localizeApiMessage("Non autorisé", null)).toBe("Non autorisé");
    expect(localizeApiMessage("Identifiant invalide", undefined)).toBe("Identifiant invalide");
  });

  it("traduit les erreurs connues en anglais", () => {
    expect(localizeApiMessage("Non autorisé", "en")).toBe("Unauthorized");
    expect(localizeApiMessage("Identifiant invalide", "en")).toBe("Invalid identifier");
    expect(localizeApiMessage("Valeur trop petite", "en")).toBe("Value too small");
    expect(localizeApiMessage("Adresse email invalide", "en")).toBe("Invalid email address");
  });

  it("laisse intact un message hors dictionnaire", () => {
    expect(localizeApiMessage("Custom upstream", "en")).toBe("Custom upstream");
  });
});
