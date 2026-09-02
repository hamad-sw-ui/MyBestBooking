import { describe, expect, it } from "vitest";
import { isLocallyServedImage } from "./local-image";

describe("isLocallyServedImage (T-188)", () => {
  it("accepte les chemins statiques auto-hébergés", () => {
    expect(isLocallyServedImage("/seed-images/villa-azure-1.jpg")).toBe(true);
    expect(isLocallyServedImage("/uploads/abc/photo.png")).toBe(true);
  });

  it("refuse les URLs distantes (optimizer ne doit pas les traiter)", () => {
    expect(isLocallyServedImage("https://images.unsplash.com/x")).toBe(false);
    expect(isLocallyServedImage("http://cdn.example.com/a.jpg")).toBe(false);
  });

  it("refuse les forms protocol-relative et data/blob", () => {
    expect(isLocallyServedImage("//cdn.example.com/a.jpg")).toBe(false);
    expect(isLocallyServedImage("data:image/png;base64,AAAA")).toBe(false);
    expect(isLocallyServedImage("blob:https://app/id")).toBe(false);
  });

  it("refuse null/undefined/vide/espaces", () => {
    expect(isLocallyServedImage(null)).toBe(false);
    expect(isLocallyServedImage(undefined)).toBe(false);
    expect(isLocallyServedImage("")).toBe(false);
    expect(isLocallyServedImage("   ")).toBe(false);
  });

  it("tolère les espaces autour du chemin", () => {
    expect(isLocallyServedImage("  /uploads/x.jpg  ")).toBe(true);
  });
});
