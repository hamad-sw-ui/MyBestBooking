import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * T-235 (audit n°3, F4) — le quota de réservation ne punit plus les erreurs de
 * saisie.
 *
 * Constat d'audit : un compteur unique de 10/h était incrémenté **avant** la
 * validation. Six essais invalides (email mal saisi, par exemple) suffisaient à
 * bloquer une demande correcte en **429**, avec un message « réessayez plus
 * tard » qui ne disait pas combien de temps attendre.
 *
 * Contrat vérifié ici :
 *   1. dix erreurs de saisie ne consomment pas le quota produit (l'ancien
 *      compteur, incrémenté avant la validation, refusait déjà la 11ᵉ) ;
 *   2. une demande correcte passe encore après plusieurs fautes de frappe ;
 *   3. le quota produit finit par refuser (429) en annonçant le délai réel
 *      (`Retry-After` + message chiffré) ;
 *   4. le visiteur non connecté reçoit un cookie de quota (l'IP partagée n'est
 *      plus la seule clé).
 */

let dbAvailable = false;
try {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/app_db",
  });
  const connection = await pool.connect();
  await connection.query("SELECT 1");
  connection.release();
  await pool.end();
  dbAvailable = true;
} catch {
  dbAvailable = false;
}

const dbTest = dbAvailable ? describe : describe.skip;

// Visiteur non connecté : c'est le cas du constat F4 (quota par IP). Le mock
// évite l'appel à `cookies()` de Next, hors contexte de requête en test.
vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, getCurrentUser: vi.fn().mockResolvedValue(null) };
});

dbTest("T-235 — quota de réservation après validation", () => {
  let POST: (req: unknown) => Promise<Response>;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let _resetRateLimit: typeof import("@/lib/rate-limit")._resetRateLimit;
  let propertyId = "";
  let roomId = "";
  const created: string[] = [];

  /** Payload syntaxiquement valide (les dates sont celles du seed). */
  function payload(overrides: Record<string, unknown> = {}) {
    return {
      propertyId,
      roomId,
      checkIn: "2027-05-20",
      checkOut: "2027-05-23",
      numAdults: 2,
      guestFirstName: "Quota",
      guestLastName: "T235",
      guestEmail: `t235-${Date.now()}@test.local`,
      isGuestBooking: true,
      ...overrides,
    };
  }

  async function post(body: unknown, cookie?: string) {
    const { NextRequest } = await import("next/server");
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (cookie) headers.cookie = cookie;
    return POST(
      new NextRequest("http://localhost/api/bookings", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }),
    );
  }

  beforeAll(async () => {
    POST = (await import("./route")).POST as unknown as typeof POST;
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");
    _resetRateLimit = (await import("@/lib/rate-limit"))._resetRateLimit;

    const { eq } = await import("drizzle-orm");
    const [host] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    const [property] = await db
      .select()
      .from(schema.properties)
      .where(eq(schema.properties.hostId, host.id))
      .limit(1);
    propertyId = property.id;
    const [room] = await db
      .select()
      .from(schema.rooms)
      .where(eq(schema.rooms.propertyId, propertyId))
      .limit(1);
    roomId = room.id;
  });

  afterAll(async () => {
    if (!db) return;
    const { inArray } = await import("drizzle-orm");
    if (created.length > 0) {
      await db.delete(schema.bookings).where(inArray(schema.bookings.id, created));
    }
    _resetRateLimit?.();
  });

  it("dix erreurs de saisie ne bloquent pas une demande correcte", async () => {
    _resetRateLimit();
    const cookie = `mbb_guest=t235a-${Date.now()}`;

    // 1. Dix fautes de frappe : email invalide → 400 (validation Zod). Le quota
    //    produit étant de 10/h, dix essais épuisaient l'ancien compteur.
    for (let i = 0; i < 10; i += 1) {
      const res = await post(payload({ guestEmail: "pas-un-email" }), cookie);
      expect(res.status).toBe(400);
    }

    // 2. La demande correcte passe (avant le correctif : 429).
    const accepted = await post(payload(), cookie);
    expect(accepted.status).toBe(201);
    const body = (await accepted.json()) as { booking?: { id: string } };
    if (body.booking?.id) created.push(body.booking.id);
  });

  it("le quota produit refuse avec un délai lisible et un cookie visiteur", async () => {
    _resetRateLimit();
    const cookie = `mbb_guest=t235b-${Date.now()}`;

    // Dix demandes bien formées mais impossibles (bien inexistant → 400) :
    // elles consomment le quota produit, pas le garde-fou anti-abus (60/h).
    for (let i = 0; i < 10; i += 1) {
      const res = await post(
        payload({ propertyId: "00000000-0000-4000-8000-000000000000", guestEmail: `t235-${i}@test.local` }),
        cookie,
      );
      expect(res.status).toBe(400);
    }

    // La onzième est refusée par le quota, avec le délai réel.
    const denied = await post(payload({ guestEmail: "t235-six@test.local" }), cookie);
    expect(denied.status).toBe(429);
    const retryAfter = Number(denied.headers.get("retry-after"));
    expect(Number.isFinite(retryAfter)).toBe(true);
    expect(retryAfter).toBeGreaterThan(0);
    const body = (await denied.json()) as { error: string };
    expect(body.error).toMatch(/Trop de tentatives, réessayez dans \d+ (seconde|minute)/);
  });

  it("le tunnel pose un cookie de quota au visiteur non connecté", async () => {
    _resetRateLimit();
    const accepted = await post(payload({ guestEmail: `t235-cookie-${Date.now()}@test.local` }));
    expect(accepted.status).toBe(201);
    const body = (await accepted.json()) as { booking?: { id: string } };
    if (body.booking?.id) created.push(body.booking.id);

    const setCookie = accepted.headers.getSetCookie?.() ?? [];
    const guestCookie = setCookie.find((c) => c.startsWith("mbb_guest="));
    expect(guestCookie).toBeDefined();
    expect(guestCookie).toContain("HttpOnly");
    expect(guestCookie).toContain("Path=/");
  });
});
