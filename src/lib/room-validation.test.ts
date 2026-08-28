import { describe, it, expect } from "vitest";
import { validateRoomCapacity, ROOM_MAX_QUANTITY } from "@/lib/room-validation";

// T-129 (audit n°9 P2/P3) : cohérence capacités chambre.
describe("validateRoomCapacity (T-129)", () => {
  it("accepte une chambre cohérente", () => {
    expect(validateRoomCapacity({ maxOccupancy: 4, maxAdults: 2, maxChildren: 2, basePrice: 80, quantity: 1 })).toBeNull();
    expect(validateRoomCapacity({ maxOccupancy: 1, maxAdults: 1, basePrice: 50 })).toBeNull();
  });

  it("refuse plus d'adultes que la capacité", () => {
    expect(validateRoomCapacity({ maxOccupancy: 1, maxAdults: 4, basePrice: 100 }))
      .toBe("Le nombre d'adultes ne peut pas dépasser la capacité maximale");
  });

  it("refuse adultes + enfants > capacité", () => {
    expect(validateRoomCapacity({ maxOccupancy: 3, maxAdults: 2, maxChildren: 2, basePrice: 100 }))
      .toBe("Adultes + enfants ne peuvent pas dépasser la capacité maximale");
  });

  it("traite maxChildren absent comme 0", () => {
    expect(validateRoomCapacity({ maxOccupancy: 2, maxAdults: 2, basePrice: 60 })).toBeNull();
    expect(validateRoomCapacity({ maxOccupancy: 2, maxAdults: 3, basePrice: 60 })).not.toBeNull();
  });

  it("refuse un prix nul ou négatif", () => {
    expect(validateRoomCapacity({ maxOccupancy: 2, maxAdults: 2, basePrice: 0 }))
      .toBe("Le prix de base doit être strictement positif");
    expect(validateRoomCapacity({ maxOccupancy: 2, maxAdults: 2, basePrice: -10 }))
      .toBe("Le prix de base doit être strictement positif");
  });

  it("refuse une quantité hors plafond", () => {
    expect(validateRoomCapacity({ maxOccupancy: 2, maxAdults: 2, basePrice: 60, quantity: ROOM_MAX_QUANTITY + 1 }))
      .toBe(`La quantité ne peut pas dépasser ${ROOM_MAX_QUANTITY}`);
  });
});
