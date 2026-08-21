import { describe, it, expect } from "vitest";
import { renderTemplate, escapeHtml } from "./render";

describe("escapeHtml (T-025)", () => {
  it("échappe les 5 caractères HTML sensibles", () => {
    expect(escapeHtml("<script>alert('x')</script>")).toBe(
      "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;",
    );
    expect(escapeHtml('a & b " c')).toBe("a &amp; b &quot; c");
  });

  it("null/undefined → chaîne vide", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("nombres convertis", () => {
    expect(escapeHtml(42)).toBe("42");
  });
});

describe("renderTemplate (T-025)", () => {
  it("substitution basique", () => {
    expect(renderTemplate("Bonjour {firstName}", { firstName: "Marie" })).toBe(
      "Bonjour Marie",
    );
  });

  it("placeholder inconnu → laissé tel quel", () => {
    expect(renderTemplate("Hello {unknown}", { firstName: "M" })).toBe(
      "Hello {unknown}",
    );
  });

  it("injection HTML dans une variable → échappée", () => {
    expect(
      renderTemplate("hi {name}", { name: "<script>alert(1)</script>" }),
    ).toBe("hi &lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("plusieurs placeholders + répétition", () => {
    expect(
      renderTemplate("{a}-{b}-{a}", { a: "X", b: "Y" }),
    ).toBe("X-Y-X");
  });

  it("chaîne vide → chaîne vide", () => {
    expect(renderTemplate("", { a: "x" })).toBe("");
  });

  it("clé avec chiffre acceptée", () => {
    expect(renderTemplate("hey {level2}", { level2: "OK" })).toBe("hey OK");
  });

  it("phrase avec espaces {jour de la semaine} → ignoré", () => {
    expect(
      renderTemplate("le {jour de la semaine}", { jour: "lundi" }),
    ).toBe("le {jour de la semaine}");
  });
});
