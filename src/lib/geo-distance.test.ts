import { describe, it, expect } from "vitest";
import {
  NEAR_RADIUS_KM,
  buildNearHref,
  haversineKm,
  normalizeNear,
  parseNear,
} from "./geo-distance";

/**
 * T-260 (audit n°6, B7) — « Autour de moi ».
 *
 * L'API gérait déjà `?near=lat,lng,km` (T-026) ; le bouton de la page de
 * recherche devait produire une position exploitable SANS jamais casser les
 * filtres en cours. Ces tests fixent les bornes, la distance de référence
 * (Paris–Lyon ≈ 392 km) et la conservation des paramètres dans l'URL.
 */

describe("parseNear (T-260)", () => {
  it("accepte trois nombres valides", () => {
    expect(parseNear("48.86,2.35,25")).toEqual({ lat: 48.86, lng: 2.35, km: 25 });
    expect(parseNear(" -33.87 , 151.21 , 5.5 ")).toEqual({ lat: -33.87, lng: 151.21, km: 5.5 });
  });

  it("refuse ce qui ne peut pas filtrer (aucune exception)", () => {
    for (const raw of [
      null,
      undefined,
      "",
      "48.86",
      "48.86,2.35",
      "48.86,2.35,25,1",
      "abc,2.35,25",
      "48.86,abc,25",
      "48.86,2.35,abc",
      "91,2.35,25",
      "-91,2.35,25",
      "48.86,181,25",
      "48.86,-181,25",
      "48.86,2.35,0",
      "48.86,2.35,-5",
    ]) {
      expect(parseNear(raw as string | null | undefined)).toBeNull();
    }
  });

  it("normalise pour la clé de cache", () => {
    expect(normalizeNear({ lat: 48.86, lng: 2.35, km: 25 })).toBe("48.86,2.35,25");
  });
});

describe("haversineKm (T-260)", () => {
  it("donne 0 sur un point identique (sans NaN)", () => {
    expect(haversineKm(48.86, 2.35, 48.86, 2.35)).toBe(0);
  });

  it("retrouve les distances connues", () => {
    // Paris (48,8566 / 2,3522) → Lyon (45,7644 / 4,8358) ≈ 392 km.
    expect(haversineKm(48.8566, 2.3522, 45.7644, 4.8358)).toBeGreaterThan(385);
    expect(haversineKm(48.8566, 2.3522, 45.7644, 4.8358)).toBeLessThan(400);
    // Paris → Marseille ≈ 660 km.
    expect(haversineKm(48.8566, 2.3522, 43.2965, 5.3698)).toBeGreaterThan(650);
    expect(haversineKm(48.8566, 2.3522, 43.2965, 5.3698)).toBeLessThan(670);
  });
});

describe("buildNearHref (T-260)", () => {
  it("ajoute `near` et conserve les filtres saisis", () => {
    const href = buildNearHref(
      new URLSearchParams({ search: "toscana", minRating: "8", guests: "2" }),
      { lat: 43.7696, lng: 11.2558 },
    );
    expect(href.startsWith("/recherche?")).toBe(true);
    const query = new URLSearchParams(href.slice("/recherche?".length));
    expect(query.get("search")).toBe("toscana");
    expect(query.get("minRating")).toBe("8");
    expect(query.get("guests")).toBe("2");
    expect(query.get("near")).toBe(`43.7696,11.2558,${NEAR_RADIUS_KM}`);
  });

  it("conserve un rayon explicite et écrase un `near`/`page` précédent", () => {
    const href = buildNearHref("page=3&near=1,2,3&city=Nice", { lat: 48.8, lng: 2.3 }, 50);
    const query = new URLSearchParams(href.slice("/recherche?".length));
    expect(query.get("near")).toBe("48.8000,2.3000,50");
    expect(query.get("city")).toBe("Nice");
    expect(query.get("page")).toBeNull();
  });

  it("écarte les champs vides pour garder des liens lisibles", () => {
    const href = buildNearHref(new URLSearchParams({ city: "", search: "  ", guests: "4" }), {
      lat: 45.76,
      lng: 4.83,
    });
    const query = new URLSearchParams(href.slice("/recherche?".length));
    expect([...query.keys()]).toEqual(["guests", "near"]);
    expect(query.get("near")).toBe("45.7600,4.8300,25");
  });
});
