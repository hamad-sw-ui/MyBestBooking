import { describe, it, expect, beforeAll, afterAll } from "vitest";

let dbAvailable = false;
try {
  const { Pool } = await import("pg");
  const p = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:55432/app_db",
  });
  const c = await p.connect();
  await c.query("SELECT 1");
  c.release();
  await p.end();
  dbAvailable = true;
} catch {}

const dbTest = dbAvailable ? describe : describe.skip;

dbTest("GET /api/promotions/apply (T-019, §13.5)", () => {
  let GET: typeof import("./route").GET;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  const testIds: string[] = [];

  beforeAll(async () => {
    GET = (await import("./route")).GET;
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");

    // 3 promos : active percentage 20%, expirée, épuisée
    const now = new Date();
    const future = new Date(now.getTime() + 30 * 86400_000);
    const past = new Date(now.getTime() - 30 * 86400_000);
    const codes = [
      { code: "TEST-ACTIVE", value: "20", validFrom: past, validUntil: future, isActive: true },
      { code: "TEST-EXPIRED", value: "10", validFrom: past, validUntil: past, isActive: true },
      { code: "TEST-INACTIVE", value: "10", validFrom: past, validUntil: future, isActive: false },
    ];
    for (const c of codes) {
      const [r] = await db
        .insert(schema.promotions)
        .values({
          code: c.code, name: c.code, type: "percentage",
          value: c.value, minBookingAmount: "0",
          validFrom: c.validFrom, validUntil: c.validUntil,
          isActive: c.isActive,
        })
        .returning({ id: schema.promotions.id });
      testIds.push(r.id);
    }
  });

  afterAll(async () => {
    const { inArray } = await import("drizzle-orm");
    if (testIds.length) await db.delete(schema.promotions).where(inArray(schema.promotions.id, testIds));
  });

  async function call(url: string): Promise<Response> {
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(url);
    return GET(req);
  }

  it("code inconnu → 404 { ok:false }", async () => {
    const res = await call("http://x/api/promotions/apply?code=NOPE&amount=100");
    expect(res.status).toBe(404);
    const b = await res.json();
    expect(b.ok).toBe(false);
  });

  it("code actif 20% sur 200 → discount 40, finalTotal 160", async () => {
    const res = await call("http://x/api/promotions/apply?code=TEST-ACTIVE&amount=200");
    expect(res.status).toBe(200);
    const b = await res.json();
    expect(b.ok).toBe(true);
    expect(b.discount).toBe(40);
    expect(b.finalTotal).toBe(160);
    expect(b.promotion.code).toBe("TEST-ACTIVE");
  });

  it("code expiré → 400 { ok:false, error }", async () => {
    const res = await call("http://x/api/promotions/apply?code=TEST-EXPIRED&amount=100");
    expect(res.status).toBe(400);
    const b = await res.json();
    expect(b.ok).toBe(false);
    expect(b.error).toMatch(/expiré/i);
  });

  it("code inactif → 400", async () => {
    const res = await call("http://x/api/promotions/apply?code=TEST-INACTIVE&amount=100");
    expect(res.status).toBe(400);
    const b = await res.json();
    expect(b.error).toMatch(/inactif/i);
  });

  it("montant invalide → 400", async () => {
    const res = await call("http://x/api/promotions/apply?code=TEST-ACTIVE&amount=-5");
    expect(res.status).toBe(400);
  });

  it("code manquant → 400", async () => {
    const res = await call("http://x/api/promotions/apply?amount=100");
    expect(res.status).toBe(400);
  });
});
