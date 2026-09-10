import { describe, it, expect } from "vitest";
import { toAuditEntryRow } from "./audit-rows";

/**
 * T-217/P9 — la page `/dashboard/audit` (serveur) et le chargement paginé
 * (client, `GET /api/admin/audit`) doivent produire la même forme : la
 * projection est donc testée sur les deux représentations de `createdAt`
 * (Date côté drizzle, chaîne ISO côté JSON).
 */
describe("toAuditEntryRow (T-217/P9)", () => {
  const base = {
    id: "11111111-1111-4111-8111-111111111111",
    action: "setting.update",
    actorId: null,
    actorEmail: "admin@mybestbooking.com",
    entityType: "settings",
    entityId: "reviews",
    metadata: { requireModeration: true },
  };

  it("normalise une date drizzle (Date) en ISO", () => {
    const row = toAuditEntryRow({ ...base, createdAt: new Date("2026-09-10T10:00:00.000Z") });
    expect(row.createdAt).toBe("2026-09-10T10:00:00.000Z");
    expect(row.metadata).toEqual({ requireModeration: true });
  });

  it("accepte la chaîne ISO renvoyée par l'API", () => {
    const row = toAuditEntryRow({ ...base, createdAt: "2026-09-10T10:00:00.000Z" });
    expect(row.createdAt).toBe("2026-09-10T10:00:00.000Z");
  });

  it("convertit tout metadata non objet en null (contrat du composant)", () => {
    expect(toAuditEntryRow({ ...base, metadata: "texte", createdAt: new Date() }).metadata).toBeNull();
    expect(toAuditEntryRow({ ...base, metadata: null, createdAt: new Date() }).metadata).toBeNull();
  });
});
