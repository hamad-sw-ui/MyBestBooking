import { describe, it, expect } from "vitest";
import {
  formatPrice,
  formatDate,
  formatDateShort,
  generateBookingReference,
  generateSlug,
  getRatingLabel,
  getPropertyTypeLabel,
  getStatusBadgeColor,
  calculateNights,
  cn,
} from "./utils";

describe("cn", () => {
  it("merge Tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });
  it("gère les valeurs conditionnelles", () => {
    expect(cn("a", false && "b", "c")).toBe("a c");
  });
});

describe("formatPrice", () => {
  it("formate EUR par défaut", () => {
    const s = formatPrice(120);
    expect(s).toMatch(/120/);
    expect(s).toMatch(/€/);
  });
  it("accepte une chaîne", () => {
    expect(formatPrice("49.99")).toMatch(/49,99/);
  });
  it("T-152 (B) : la devise passée en argument est respectée (USD ≠ EUR)", () => {
    const usd = formatPrice(100, "USD");
    const eur = formatPrice(100, "EUR");
    expect(usd).toMatch(/100/);
    expect(usd).toMatch(/\$US/);
    expect(eur).toMatch(/€/);
    expect(usd).not.toBe(eur);
  });
});

describe("formatDate / formatDateShort", () => {
  it("formate une date longue en fr", () => {
    const s = formatDate("2026-08-20");
    expect(s).toMatch(/août/);
  });
  it("formate une date courte", () => {
    const s = formatDateShort("2026-08-20");
    expect(s).toMatch(/20/);
  });
});

describe("generateBookingReference", () => {
  it("respecte le format MBB-YYYY-XXXXXX", () => {
    const ref = generateBookingReference();
    expect(ref).toMatch(/^MBB-\d{4}-[A-Z0-9]{6}$/);
  });
  it("génère des références différentes", () => {
    const set = new Set(Array.from({ length: 20 }, () => generateBookingReference()));
    expect(set.size).toBeGreaterThan(15);
  });
});

describe("generateSlug", () => {
  it("supprime les accents", () => {
    expect(generateSlug("Hôtel Épatant")).toBe("hotel-epatant");
  });
  it("gère les caractères spéciaux", () => {
    expect(generateSlug("Villa d'Azur — 5*")).toBe("villa-d-azur-5");
  });
});

describe("getRatingLabel", () => {
  it("classe correctement", () => {
    expect(getRatingLabel(9.5).label).toBe("Exceptionnel");
    expect(getRatingLabel(8.2).label).toBe("Superbe");
    expect(getRatingLabel(7).label).toBe("Bien");
    expect(getRatingLabel(4).label).toBe("À améliorer");
  });
});

describe("getPropertyTypeLabel", () => {
  it("traduit les types connus", () => {
    expect(getPropertyTypeLabel("hotel")).toBe("Hôtel");
    expect(getPropertyTypeLabel("riad")).toBe("Riad");
  });
  it("retourne l'entrée telle quelle pour type inconnu", () => {
    expect(getPropertyTypeLabel("mystery")).toBe("mystery");
  });
});

describe("getStatusBadgeColor", () => {
  it("retourne une classe utilitaire pour un statut connu", () => {
    expect(getStatusBadgeColor("confirmed")).toContain("green");
  });
  it("fallback gris pour statut inconnu", () => {
    expect(getStatusBadgeColor("nope")).toContain("gray");
  });
});

describe("calculateNights", () => {
  it("calcule le nombre de nuits entre deux dates", () => {
    expect(calculateNights("2026-08-20", "2026-08-23")).toBe(3);
  });
  it("gère les Date natifs", () => {
    expect(calculateNights(new Date("2026-01-01"), new Date("2026-01-08"))).toBe(7);
  });
});
