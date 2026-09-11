import { describe, it, expect, beforeAll, vi } from "vitest";

/**
 * T-241 (F13, volet « erreurs d'API ») — un champ inconnu n'est plus un
 * succès silencieux, et la validation rend **toutes** les erreurs.
 *
 * Constat d'audit : `PUT /api/bookings/[id]` avec `{ "paymentStatus": "paid" }`
 * répondait **200 OK** en ignorant le champ (statut inchangé en base) : le
 * client croyait avoir changé un état. Par ailleurs la réponse ne portait que
 * la première erreur de validation, obligeant l'utilisateur à corriger champ
 * après champ.
 *
 * Contrat vérifié ici :
 *   1. champ inconnu → **400** avec `issues` nommant le champ (`paymentStatus`) ;
 *   2. plusieurs erreurs → **autant d'`issues`** que de champs fautifs ;
 *   3. un corps légitime reste accepté (la route va jusqu'à la lecture en base
 *      → 404 sur un identifiant inexistant), donc aucune sur-restriction.
 *
 * Le schéma est validé **avant** toute écriture : aucun test ne modifie une
 * réservation réelle — un UUID inexistant mais valide suffit à prouver le
 * contrat, et la base reste intacte.
 */

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    getCurrentUser: vi.fn(async () => ({
      id: "11111111-1111-1111-1111-111111111111",
      email: "t241@test.local",
      role: "customer",
    })),
  };
});

describe("T-241 — erreurs d'API : issues détaillées et schémas stricts", () => {
  let PUT: (req: import("next/server").NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
  const unknownId = "99999999-9999-4999-8999-999999999999";

  beforeAll(async () => {
    ({ PUT } = await import("./route"));
  });

  async function put(body: unknown) {
    const { NextRequest } = await import("next/server");
    const res = await PUT(
      new NextRequest(`http://localhost/api/bookings/${unknownId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
      { params: Promise.resolve({ id: unknownId }) },
    );
    return { status: res.status, body: (await res.json()) as { error?: string; issues?: Array<{ field: string; message: string }> } };
  }

  it("refuse un champ inconnu en 400 au lieu d'un 200 silencieux", async () => {
    const { status, body } = await put({ paymentStatus: "paid" });
    expect(status).toBe(400);
    expect(body.issues?.map((i) => i.field)).toContain("paymentStatus");
    expect(body.error).toBeTruthy();
  });

  it("renvoie une issue par champ fautif (plus seulement la première)", async () => {
    const { status, body } = await put({ status: "pas-un-statut", cancellationReason: 12345 });
    expect(status).toBe(400);
    expect(body.issues?.length).toBeGreaterThanOrEqual(2);
    expect(body.issues?.map((i) => i.field)).toEqual(
      expect.arrayContaining(["status", "cancellationReason"]),
    );
    // Libellés français (jamais « Invalid enum value » / « Expected string »)
    for (const issue of body.issues ?? []) {
      expect(issue.message).not.toMatch(/\b(Invalid|Expected|Required|Unrecognized)\b/);
    }
  });

  it("accepte toujours un corps légitime (404 sur réservation inexistante)", async () => {
    const { status, body } = await put({ status: "cancelled", cancellationReason: "Test T-241" });
    expect(status).toBe(404);
    expect(body.error).toBeTruthy();
  });
});
