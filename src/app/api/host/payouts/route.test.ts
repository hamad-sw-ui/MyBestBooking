import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

/**
 * Test d'intégration — T-195 : POST /api/host/payouts.
 *
 * Vérifie : (1) un POST sur une période avec bookings payés crée un payout
 * persistant `pending` puis bascule `paid` via le PayoutProvider mock ; (2)
 * l'idempotence (même clé → pas de doublon) ; (3) un accès customer → 403.
 * `getCurrentUser` est mocké (auth), la persistance est réelle sur la base seedée.
 */

let dbAvailable = false;
try {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://postgres:postgres@127.0.0.1:55432/app_db",
  });
  const c = await pool.connect();
  await c.query("SELECT 1");
  c.release();
  await pool.end();
  dbAvailable = true;
} catch {
  dbAvailable = false;
}

const dbTest = dbAvailable ? describe : describe.skip;

/** Fabrique une NextRequest (type attendu par le handler de route). */
async function makeReq(body: unknown, method = "POST") {
  const { NextRequest } = await import("next/server");
  return new NextRequest("http://localhost/api/host/payouts", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return { ...actual, getCurrentUser: vi.fn() };
});

describe("T-209/F5 — payouts legacy non actionnables", () => {
  let POST: typeof import("./route").POST;
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let prevPayoutFlag: string | undefined;

  beforeAll(async () => {
    prevPayoutFlag = process.env.PLATFORM_PAYOUTS_ENABLED;
    delete process.env.PLATFORM_PAYOUTS_ENABLED;
    const routeMod = await import("./route");
    POST = routeMod.POST;
    const auth = await import("@/lib/auth");
    getCurrentUser = (auth as any).getCurrentUser;
  });

  afterAll(() => {
    if (prevPayoutFlag === undefined) delete process.env.PLATFORM_PAYOUTS_ENABLED;
    else process.env.PLATFORM_PAYOUTS_ENABLED = prevPayoutFlag;
  });

  it("refuse le POST host quand les paiements plateforme sont désactivés", async () => {
    getCurrentUser.mockResolvedValue({ id: "host-id", role: "host", currency: "EUR" });
    const res = await POST(await makeReq({ periodStart: "2026-01-01", periodEnd: "2026-01-31" }));
    const body = await res.json();
    expect(res.status).toBe(410);
    expect(body.code).toBe("PLATFORM_PAYOUTS_DISABLED");
    expect(body.platformPayoutsDisabled).toBe(true);
  });
});

dbTest("T-195 — POST /api/host/payouts (versement idempotent)", () => {
  let POST: typeof import("./route").POST;
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let hostId = "";
  let periodStart = "";
  let periodEnd = "";
  let seededBookingId = "";
  let prevPayoutFlag: string | undefined;

  beforeAll(async () => {
    prevPayoutFlag = process.env.PLATFORM_PAYOUTS_ENABLED;
    process.env.PLATFORM_PAYOUTS_ENABLED = "true";
    const routeMod = await import("./route");
    POST = routeMod.POST;
    const auth = await import("@/lib/auth");
    getCurrentUser = (auth as any).getCurrentUser;
    const schema = await import("@/db/schema");
    const { db } = await import("@/db");
    const { eq, and, sql } = await import("drizzle-orm");
    const [host] = await db
      .select({ id: schema.users.id, country: schema.users.country })
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    if (!host) throw new Error("Seed non appliqué (host introuvable)");
    hostId = host.id;
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    periodStart = first.toISOString().slice(0, 10);
    periodEnd = last.toISOString().slice(0, 10);

    // Booking payé DÉTERMINISTE pour la période : garantit qu'un versement est créé.
    // On rattache à la première propriété de l'hôte + 1 chambre.
    const [prop] = await db
      .select({ id: schema.properties.id })
      .from(schema.properties)
      .where(eq(schema.properties.hostId, hostId))
      .limit(1);
    const [room] = prop
      ? await db.select({ id: schema.rooms.id }).from(schema.rooms).where(eq(schema.rooms.propertyId, prop.id)).limit(1)
      : [];
    const [customer] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, "customer@mybestbooking.com"))
      .limit(1);
    if (!prop || !room || !customer) throw new Error("Seed incomplet (propriété/chambre/utilisateur)");
    const [seeded] = await db
      .insert(schema.bookings)
      .values({
        bookingReference: `PAYTEST${Date.now().toString().slice(-6)}`,
        userId: customer.id,
        propertyId: prop.id,
        roomId: room.id,
        status: "confirmed",
        checkIn: periodStart,
        checkOut: periodEnd,
        numNights: 1,
        numAdults: 1,
        numChildren: 0,
        guestFirstName: "Test",
        guestLastName: "Payout",
        guestEmail: "payout@test.dev",
        guestCountry: host.country ?? "FR",
        subtotal: "100.00",
        taxes: "0",
        fees: "0",
        discount: "0",
        total: "100.00",
        currency: "EUR",
        paymentStatus: "paid",
        paymentMethod: "mock_card",
        commissionRate: "15.00",
        commissionAmount: "15.00",
        netToHost: "85.00",
        createdAt: new Date(first.getFullYear(), first.getMonth(), 15),
      })
      .returning();
    seededBookingId = seeded.id;
  });

  afterAll(async () => {
    const schema = await import("@/db/schema");
    const { db } = await import("@/db");
    const { eq, inArray } = await import("drizzle-orm");
    const payouts = await db
      .select({ id: schema.payouts.id })
      .from(schema.payouts)
      .where(eq(schema.payouts.hostId, hostId));
    if (payouts.length) {
      await db.delete(schema.payouts).where(inArray(schema.payouts.id, payouts.map((p) => p.id)));
    }
    if (seededBookingId) {
      await db.delete(schema.bookings).where(eq(schema.bookings.id, seededBookingId));
    }
    if (prevPayoutFlag === undefined) delete process.env.PLATFORM_PAYOUTS_ENABLED;
    else process.env.PLATFORM_PAYOUTS_ENABLED = prevPayoutFlag;
  });

  it("customer → 403 (accès hébergeur/admin requis)", async () => {
    getCurrentUser.mockResolvedValue({ id: "customer-id", role: "customer", currency: "EUR" });
    const res = await POST(await makeReq({ periodStart, periodEnd }));
    expect(res.status).toBe(403);
  });

  it("host → crée un payout idempotent puis le marque payé (mock provider)", async () => {
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host", currency: "EUR" });
    const res = await POST(await makeReq({ periodStart, periodEnd }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.payouts)).toBe(true);
    expect(body.payouts[0].status).toBe("paid");
    // G7 : sans compte de versement configuré, hasAccount=false et l'UI
    // affichera la note ; le comportement mock n'est PAS bloqué (non-régression).
    expect(body.hasAccount).toBe(false);
  });

  it("host → re-POST même période ne crée pas de doublon (idempotence)", async () => {
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host", currency: "EUR" });
    const schema = await import("@/db/schema");
    const { db } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    const countBefore = (await db.select().from(schema.payouts).where(eq(schema.payouts.hostId, hostId))).length;
    const res = await POST(await makeReq({ periodStart, periodEnd }));
    expect(res.status).toBe(200);
    const countAfter = (await db.select().from(schema.payouts).where(eq(schema.payouts.hostId, hostId))).length;
    // Le re-POST renvoie l'existant (created=false) et n'ajoute pas de ligne.
    expect(countAfter).toBe(countBefore);
  });

  it("période invalide → 400", async () => {
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host", currency: "EUR" });
    const bad = await POST(await makeReq({ periodStart: "2026/08/01", periodEnd: "2026-08-31" }));
    expect(bad.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────
// P2 / P3 — garde-fou devise + chemin admin (multi-hôte).
// Période distincte (2026-07) pour éviter la fusion avec la période du bloc
// précédent (mois courant - 1). Une clé maître de TEST est posée pour le vault.
// ─────────────────────────────────────────────────────────────
const TEST_KEY = "a".repeat(64);
dbTest("T-195/P2P3 — garde-fou devise + projection admin (multi-hôte)", () => {
  let POST: typeof import("./route").POST;
  let GET: typeof import("./route").GET;
  let getCurrentUser: ReturnType<typeof vi.fn>;
  let hostId = "";
  let adminId = "";
  let periodStart = "";
  let periodEnd = "";
  let seededBookingIds: string[] = [];
  let accountId = "";
  let prevKey: string | undefined;
  let prevPayoutFlag: string | undefined;

  beforeAll(async () => {
    prevKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
    prevPayoutFlag = process.env.PLATFORM_PAYOUTS_ENABLED;
    process.env.PLATFORM_PAYOUTS_ENABLED = "true";
    process.env.CREDENTIALS_ENCRYPTION_KEY = TEST_KEY;
    const routeMod = await import("./route");
    POST = routeMod.POST;
    GET = routeMod.GET;
    const auth = await import("@/lib/auth");
    getCurrentUser = (auth as any).getCurrentUser;
    const schema = await import("@/db/schema");
    const { db } = await import("@/db");
    const { eq, and, sql } = await import("drizzle-orm");
    const [host] = await db.select({ id: schema.users.id, country: schema.users.country }).from(schema.users).where(eq(schema.users.email, "host@mybestbooking.com")).limit(1);
    if (!host) throw new Error("Seed non appliqué (host introuvable)");
    hostId = host.id;
    const [admin] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.role, "admin")).limit(1);
    adminId = admin.id;
    const [prop] = await db.select({ id: schema.properties.id }).from(schema.properties).where(eq(schema.properties.hostId, hostId)).limit(1);
    const [room] = prop ? await db.select({ id: schema.rooms.id }).from(schema.rooms).where(eq(schema.rooms.propertyId, prop.id)).limit(1) : [];
    const [customer] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.email, "customer@mybestbooking.com")).limit(1);
    if (!prop || !room || !customer) throw new Error("Seed incomplet");
    periodStart = "2026-07-01";
    periodEnd = "2026-07-31";
    // Deux bookings payés : un EUR et un XAF (même période) → G6 produit un payout par devise.
    for (const [i, cur] of ["EUR", "XAF"].entries()) {
      const total = cur === "EUR" ? "100.00" : "100000.00";
      const net = cur === "EUR" ? "85.00" : "85000.00";
      const [b] = await db.insert(schema.bookings).values({
        bookingReference: `PAYP2P3${Date.now().toString().slice(-5)}${i}`,
        userId: customer.id, propertyId: prop.id, roomId: room.id, status: "confirmed",
        checkIn: periodStart, checkOut: periodEnd, numNights: 1, numAdults: 1, numChildren: 0,
        guestFirstName: "P2", guestLastName: "P3", guestEmail: "p2p3@test.dev", guestCountry: host.country ?? "FR",
        subtotal: total, taxes: "0", fees: "0", discount: "0", total, currency: cur,
        paymentStatus: "paid", paymentMethod: "mock_card",
        commissionRate: "15.00", commissionAmount: cur === "EUR" ? "15.00" : "15000.00", netToHost: net,
        createdAt: new Date(2026, 6, 15), // 2026-07-15 (dans les 6 mois de projection)
      }).returning();
      seededBookingIds.push(b.id);
    }
    // Compte de versement EUR pour l'hôte (P2 : devise à croiser).
    const svc = await import("@/lib/payout-service");
    const up = await svc.upsertPayoutAccount(hostId, { provider: "sepa", reference: "FR7630006000011234567890189", currency: "EUR" });
    accountId = up.account.id;
  });

  afterAll(async () => {
    const schema = await import("@/db/schema");
    const { db } = await import("@/db");
    const { eq, inArray, and } = await import("drizzle-orm");
    const payouts = await db.select({ id: schema.payouts.id }).from(schema.payouts).where(and(eq(schema.payouts.hostId, hostId), eq(schema.payouts.periodStart, periodStart)));
    if (payouts.length) await db.delete(schema.payouts).where(inArray(schema.payouts.id, payouts.map((p) => p.id)));
    if (seededBookingIds.length) await db.delete(schema.bookings).where(inArray(schema.bookings.id, seededBookingIds));
    if (accountId) await db.delete(schema.payoutAccounts).where(eq(schema.payoutAccounts.id, accountId));
    const audit = await db.select({ id: schema.auditLog.id }).from(schema.auditLog).where(eq(schema.auditLog.action, "payout.request"));
    if (audit.length) await db.delete(schema.auditLog).where(inArray(schema.auditLog.id, audit.map((a) => a.id)));
    if (prevKey === undefined) delete process.env.CREDENTIALS_ENCRYPTION_KEY;
    else process.env.CREDENTIALS_ENCRYPTION_KEY = prevKey;
    if (prevPayoutFlag === undefined) delete process.env.PLATFORM_PAYOUTS_ENABLED;
    else process.env.PLATFORM_PAYOUTS_ENABLED = prevPayoutFlag;
  });

  it("host avec compte EUR → le payout XAF est SKIPPED (devise incompatible), EUR exécuté", async () => {
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host", currency: "EUR", email: "host@mybestbooking.com" });
    const res = await POST(await makeReq({ periodStart, periodEnd }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.hasAccount).toBe(true);
    // EUR → payé (compte EUR), XAF → skipped (garde-fou devise).
    expect(body.payouts.find((p: any) => p.currency === "EUR")?.status).toBe("paid");
    const skippedXaf = body.skipped.find((s: any) => s.currency === "XAF");
    expect(skippedXaf).toBeTruthy();
    expect(skippedXaf.reason).toContain("incompatible");
    // Le payout XAF reste en base en `pending` (non exécuté).
    const schema = await import("@/db/schema");
    const { db } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    const xaf = await db.select().from(schema.payouts).where(eq(schema.payouts.periodStart, periodStart));
    expect(xaf.find((p) => p.currency === "XAF")?.status).toBe("pending");
  });

  it("admin → la projection n'est PLUS vide (P3) et POST persiste sans exécuter les payouts d'autrui", async () => {
    // GET projeté admin : contient désormais les payouts de tous les hôtes.
    getCurrentUser.mockResolvedValue({ id: adminId, role: "admin", currency: "EUR" });
    const getRes = await GET();
    const getBody = await getRes.json();
    expect(getRes.status).toBe(200);
    expect(getBody.projected.length).toBeGreaterThan(0);

    // POST admin : crée les payouts par (hôte, devise) mais ne les exécute pas
    // (hôte ≠ admin → skipped, non-propriétaire), aucun payout marqué payé.
    const res = await POST(await makeReq({ periodStart, periodEnd }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.payouts.length).toBe(0);
    expect(body.skipped.length).toBeGreaterThanOrEqual(1);
    expect(body.skipped.every((s: any) => s.reason.includes("propriétaire"))).toBe(true);
  });

  it("P6 — POST avec `currency` ne traite QUE la devise demandée (fini le multi-devise en un clic)", async () => {
    // Hôte (compte EUR) demande uniquement le versement XAF sur la même période :
    // ne traite QUE le payout XAF (skipped devise) — le EUR n'entre pas dans la boucle.
    getCurrentUser.mockResolvedValue({ id: hostId, role: "host", currency: "EUR", email: "host@mybestbooking.com" });
    const res = await POST(await makeReq({ periodStart, periodEnd, currency: "XAF" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    // Seul XAF est évalué : il est skipé (devise ≠ compte EUR), aucun EUR exécuté.
    expect(body.payouts.length).toBe(0);
    expect(body.skipped.map((s: any) => s.currency)).toEqual(["XAF"]);
  });
});
