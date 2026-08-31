import { describe, it, expect } from "vitest";
import { langInitInlineScript, UI_LANGUAGE_COOKIE } from "./ui-language";

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

  it("recopie localStorage → cookie pour un visiteur anonyme", () => {
    const src = langInitInlineScript(false);
    expect(src).toContain("hasAccount=false");
    expect(src).toContain(`document.cookie='${UI_LANGUAGE_COOKIE}='`);
    expect(src).toContain('localStorage.getItem("mybb:ui-language")');
  });
});
