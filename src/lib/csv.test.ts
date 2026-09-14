import { describe, expect, it } from "vitest";
import { csvCell, csvRows } from "./csv";

/** Contrat commun aux exports analytics, revenus et versements. */
describe("csv export helpers", () => {
  it("quote les virgules, guillemets et retours à la ligne", () => {
    expect(csvCell("Riad, \"Océan\"\nNord")).toBe('"Riad, ""Océan""\nNord"');
  });

  it("neutralise une formule tableur sans modifier une valeur numérique", () => {
    expect(csvCell("=HYPERLINK(\"https://evil.test\")")).toBe('"\'=HYPERLINK(""https://evil.test"")"');
    expect(csvCell(123.45)).toBe('"123.45"');
  });

  it("produit des lignes reproductibles", () => {
    expect(csvRows([["native", "display", "USD"], [100, 108, "USD"]])).toBe(
      '"native","display","USD"\n"100","108","USD"',
    );
  });
});
