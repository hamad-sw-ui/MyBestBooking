import { describe, it, expect } from "vitest";
import { hasOverlap } from "./availability";

describe("hasOverlap (T-012, §13.5)", () => {
  const a = { checkIn: "2026-09-10", checkOut: "2026-09-15" };

  it("chevauchement total", () => {
    expect(hasOverlap(a, { checkIn: "2026-09-11", checkOut: "2026-09-14" })).toBe(true);
  });

  it("chevauchement partiel début", () => {
    expect(hasOverlap(a, { checkIn: "2026-09-08", checkOut: "2026-09-12" })).toBe(true);
  });

  it("chevauchement partiel fin", () => {
    expect(hasOverlap(a, { checkIn: "2026-09-13", checkOut: "2026-09-18" })).toBe(true);
  });

  it("englobant (b contient a)", () => {
    expect(hasOverlap(a, { checkIn: "2026-09-01", checkOut: "2026-09-30" })).toBe(true);
  });

  it("adjacent (checkOut = checkIn) → PAS de chevauchement", () => {
    expect(hasOverlap(a, { checkIn: "2026-09-15", checkOut: "2026-09-20" })).toBe(false);
    expect(hasOverlap(a, { checkIn: "2026-09-05", checkOut: "2026-09-10" })).toBe(false);
  });

  it("complètement disjoint", () => {
    expect(hasOverlap(a, { checkIn: "2026-10-01", checkOut: "2026-10-10" })).toBe(false);
    expect(hasOverlap(a, { checkIn: "2026-08-01", checkOut: "2026-08-15" })).toBe(false);
  });

  it("commutatif", () => {
    const b = { checkIn: "2026-09-11", checkOut: "2026-09-14" };
    expect(hasOverlap(a, b)).toBe(hasOverlap(b, a));
  });
});
