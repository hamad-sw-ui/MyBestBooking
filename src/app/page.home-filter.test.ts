import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("T-210 — filtre de la page d'accueil", () => {
  const source = readFileSync(join(process.cwd(), "src/app/page.tsx"), "utf8");

  it("ne demande plus dates ni voyageurs dans le hero", () => {
    expect(source).not.toContain('name="checkIn"');
    expect(source).not.toContain('name="checkOut"');
    expect(source).not.toContain('name="guests"');
    expect(source).not.toContain('id="home-guests"');
  });

  it("conserve une recherche destination vers /recherche", () => {
    expect(source).toContain('action="/recherche"');
    expect(source).toContain('name="city"');
    expect(source).toContain('t("search.destination")');
  });
});
