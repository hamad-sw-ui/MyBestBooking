/**
 * T-186 — tests unitaires de la résolution des visuels de seed.
 * On pilote `existsSync` (mock du module fs) : fichier présent → chemin
 * local ; absent → URL historique (rollout progressif sans 404).
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { seedImageUrl } from "./seed-images";

vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  return { ...actual, existsSync: vi.fn() };
});

const { existsSync } = await import("node:fs");
const mockedExists = vi.mocked(existsSync);

describe("seedImageUrl (T-186)", () => {
  afterEach(() => {
    mockedExists.mockReset();
  });

  it("renvoie le chemin local quand le fichier existe", () => {
    mockedExists.mockReturnValue(true);
    expect(seedImageUrl("hero-home", "https://images.unsplash.com/x")).toBe(
      "/seed-images/hero-home.jpg",
    );
    // le chemin vérifié pointe bien dans public/seed-images/
    expect(mockedExists).toHaveBeenCalledWith(
      expect.stringContaining("seed-images"),
    );
  });

  it("retombe sur l'URL historique quand le fichier est absent", () => {
    mockedExists.mockReturnValue(false);
    expect(
      seedImageUrl("bb-toscana-1", "https://images.unsplash.com/legacy"),
    ).toBe("https://images.unsplash.com/legacy");
  });

  it("la résolution est par clé (un fichier n'en couvre pas un autre)", () => {
    mockedExists.mockImplementation((p) =>
      String(p).endsWith("dest-paris.jpg"),
    );
    expect(seedImageUrl("dest-paris", "https://u.test/a")).toBe(
      "/seed-images/dest-paris.jpg",
    );
    expect(seedImageUrl("dest-rome", "https://u.test/b")).toBe(
      "https://u.test/b",
    );
  });
});
