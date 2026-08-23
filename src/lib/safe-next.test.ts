import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next";

describe("safeNextPath", () => {
  it("accepte un chemin interne et sa query", () => {
    expect(safeNextPath("/reservation?property=a&room=b")).toBe("/reservation?property=a&room=b");
  });
  it("refuse les redirections externes et ambiguës", () => {
    expect(safeNextPath("//evil.example")).toBeNull();
    expect(safeNextPath("https://evil.example")).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });
});
