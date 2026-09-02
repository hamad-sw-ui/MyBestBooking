import { describe, expect, it } from "vitest";
import { hostEntryHref, initialRoleFromSearchParam } from "./host-entry";

describe("hostEntryHref (T-180)", () => {
  it("hôte et admin gardent la cible historique du dashboard", () => {
    expect(hostEntryHref("host")).toBe("/dashboard/properties/new");
    expect(hostEntryHref("admin")).toBe("/dashboard/properties/new");
  });
  it("client connecté ou anonyme → inscription présélectionnée hôte (plus d'impasse silencieuse)", () => {
    expect(hostEntryHref("customer")).toBe("/inscription?role=host");
    expect(hostEntryHref(null)).toBe("/inscription?role=host");
    expect(hostEntryHref(undefined)).toBe("/inscription?role=host");
  });
  it("rôle inconnu → chemin d'inscription (prudent)", () => {
    expect(hostEntryHref("weirdo")).toBe("/inscription?role=host");
  });
});

describe("initialRoleFromSearchParam (T-180)", () => {
  it("seul role=host présélectionne le rôle hôte", () => {
    expect(initialRoleFromSearchParam("host")).toBe(true);
  });
  it("absence ou valeur parasite → voyageur (comportement historique inchangé)", () => {
    expect(initialRoleFromSearchParam(null)).toBe(false);
    expect(initialRoleFromSearchParam("customer")).toBe(false);
    expect(initialRoleFromSearchParam("HOST")).toBe(false); // sensible à la casse volontairement
    expect(initialRoleFromSearchParam("<script>")).toBe(false);
  });
});
