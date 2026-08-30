import { describe, expect, it } from "vitest";
import { toPublicProperty, toPublicPropertyCard } from "./public-property";
import type { Property } from "@/db/schema";

const privateProperty = {
  id: "property-id",
  hostId: "host-private",
  name: "Safe hotel",
  slug: "safe-hotel",
  type: "hotel",
  description: "description",
  descriptionEn: null,
  starRating: 4,
  addressLine: "Street",
  city: "Paris",
  state: null,
  country: "FR",
  postalCode: null,
  latitude: null,
  longitude: null,
  timezone: "UTC",
  checkInFrom: "14:00:00",
  checkInUntil: "23:00:00",
  checkOutUntil: "11:00:00",
  cancellationPolicy: "flexible",
  petsAllowed: false,
  smokingAllowed: false,
  isBestrewards: false,
  isPreferred: false,
  isEcoCertified: false,
  averageRating: "9.0",
  totalReviews: 1,
  commissionRate: "15.00",
  status: "active",
  validatedAt: null,
  validatedBy: "admin-private",
  amenities: [],
  images: [],
  mainImage: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as Property;

describe("public property DTO", () => {
  it("n’expose jamais les identifiants et paramètres internes", () => {
    const json = JSON.stringify(toPublicProperty(privateProperty));
    expect(json).not.toContain("host-private");
    expect(json).not.toContain("admin-private");
    expect(json).not.toContain("15.00");
    expect(json).not.toContain("commissionRate");
    expect(json).not.toContain("validatedBy");
  });

  it("conserve uniquement le prix déjà qualifié pour la carte", () => {
    const card = toPublicPropertyCard(privateProperty, { minPrice: 99, minCurrency: "EUR" });
    expect(card).toMatchObject({ id: "property-id", minPrice: 99, minCurrency: "EUR" });
    expect(JSON.stringify(card)).not.toContain("host-private");
  });
});
