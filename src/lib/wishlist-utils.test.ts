import { describe, it, expect } from "vitest";
import {
  uniqueProperties,
  countUniqueProperties,
  aggregateWishlistItems,
} from "./wishlist-utils";

describe("wishlist-utils (T-160)", () => {
  const a = { id: "a", name: "A" };
  const b = { id: "b", name: "B" };

  it("uniqueProperties : déduplique par id en gardant l'ordre d'apparition", () => {
    expect(uniqueProperties([a, b, a, null, undefined, b])).toEqual([a, b]);
  });

  it("countUniqueProperties : un bien dans 2 listes compte une fois", () => {
    expect(countUniqueProperties([a, a, b])).toBe(2);
    expect(countUniqueProperties([a, b])).toBe(2);
    expect(countUniqueProperties([])).toBe(0);
  });

  it("aggregateWishlistItems : groupes par liste, itemCount réel, items non null", () => {
    const map = aggregateWishlistItems(["w1", "w2", "w3"], [
      { wishlistId: "w1", property: a },
      { wishlistId: "w1", property: null }, // propriété supprimée : itemCount gardé, items filtré
      { wishlistId: "w1", property: b },
      { wishlistId: "w2", property: a },
    ]);
    expect(map.get("w1")).toEqual({ id: "w1", items: [a, b], itemCount: 3 });
    expect(map.get("w2")).toEqual({ id: "w2", items: [a], itemCount: 1 });
    expect(map.get("w3")).toEqual({ id: "w3", items: [], itemCount: 0 });
  });
});
