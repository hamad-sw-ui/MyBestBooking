import { describe, it, expect } from "vitest";
import {
  langInitInlineScript,
  readUiLanguageCookie,
  UI_LANGUAGE_COOKIE,
  UI_LANGUAGE_COOKIE_ALT,
} from "./ui-language";

describe("langInitInlineScript", () => {
  it("produit du JS parseable (accolades équilibrées)", () => {
    expect(() => new Function(langInitInlineScript(false))).not.toThrow();
    expect(() => new Function(langInitInlineScript(true))).not.toThrow();
  });

  it("ne lit pas le localStorage si un compte est connecté", () => {
    const src = langInitInlineScript(true);
    expect(src).toContain("hasAccount=true");
    expect(src).toContain("if(!hasAccount)");
  });

  it("recopie localStorage → cookies (historique + RFC) pour un visiteur anonyme", () => {
    const src = langInitInlineScript(false);
    expect(src).toContain("hasAccount=false");
    expect(src).toContain(`document.cookie='${UI_LANGUAGE_COOKIE}='`);
    expect(src).toContain(`document.cookie='${UI_LANGUAGE_COOKIE_ALT}='`);
    expect(src).toContain('localStorage.getItem("mybb:ui-language")');
    expect(src).toContain("SameSite=");
  });
});

describe("readUiLanguageCookie", () => {
  it("lit le cookie RFC sans deux-points", () => {
    expect(readUiLanguageCookie("foo=1; mybb-ui-language=en; bar=2")).toBe("en");
  });
  it("lit le cookie historique avec deux-points", () => {
    expect(readUiLanguageCookie("mybb:ui-language=fr")).toBe("fr");
  });
  it("ignore une valeur inconnue", () => {
    expect(readUiLanguageCookie("mybb-ui-language=de")).toBeNull();
  });
});
