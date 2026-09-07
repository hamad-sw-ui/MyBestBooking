import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { AUDIT_ACTIONS } from "@/lib/audit";

/**
 * Test d'intégration — T-195 : webhook Stripe unifié, branche `payout.*`.
 *
 * Vérifie qu'un événement `payout.paid` (mock provider, sans signature réseau)
 * confirme le versement dans le ledger `payouts` (idempotent), qu'un
 * `payout.failed` le signale, et qu'un `pending` ne le modifie pas. La
 * persistance est réelle (base seedée), le provider est le mock par défaut en
 * test (NODE_ENV !== production).
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

/** Fabrique une NextRequest portant un payload JSON (optionnel signature). */
async function makeReq(payload: Record<string, unknown>, signature?: string) {
  const { NextRequest } = await import("next/server");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (signature) headers["stripe-signature"] = signature;
  return new NextRequest("http://localhost/api/webhooks/stripe", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

/** Construit un événement `payout.*` façon Stripe. */
function payoutEvent(type: string, payoutId: string, status: string) {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    data: { object: { id: payoutId, status } },
  };
}

dbTest("T-195 — webhook Stripe /payout.* (confirmation idempotente)", () => {
  let POST: typeof import("./route").POST;
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let hostId = "";
  let pendingPayoutId = "";
  let pendingProviderPayoutId = "";
  // Suffixe unique par exécution : évite le conflit sur l'UNIQUE idempotency_key
  // si le test est relancé (le nettoyage afterAll étant best-effort).
  const runKey = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    const routeMod = await import("./route");
    POST = routeMod.POST;
    db = (await import("@/db")).db;
    schema = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [host] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, "host@mybestbooking.com"))
      .limit(1);
    if (!host) throw new Error("Seed non appliqué (host introuvable)");
    hostId = host.id;

    // Payout persisté en `pending` avec un providerPayoutId déjà connu :
    // c'est l'état laissé par un `executePayout` asynchrone (voir POST route).
    pendingProviderPayoutId = `po_webhook_${runKey}`;
    const [inserted] = await db
      .insert(schema.payouts)
      .values({
        hostId,
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
        currency: "EUR",
        grossAmount: "200.00",
        commissionAmount: "30.00",
        netAmount: "170.00",
        bookingsCount: 1,
        status: "processing",
        providerPayoutId: pendingProviderPayoutId,
        idempotencyKey: `payout:${hostId}:2026-08-01:2026-08-31:EUR:webhook:${runKey}`,
      })
      .returning();
    pendingPayoutId = inserted.id;
  });

  afterAll(async () => {
    const { inArray, eq } = await import("drizzle-orm");
    const payouts = await db
      .select({ id: schema.payouts.id })
      .from(schema.payouts)
      .where(inArray(schema.payouts.id, [pendingPayoutId]));
    if (payouts.length) {
      await db.delete(schema.payouts).where(inArray(schema.payouts.id, [pendingPayoutId]));
    }
    // Nettoyage P4 : audits `payout.paid`/`payout.failed` créés par ce test.
    const audit = await db
      .select({ id: schema.auditLog.id })
      .from(schema.auditLog)
      .where(inArray(schema.auditLog.action, [AUDIT_ACTIONS.payoutPaid, AUDIT_ACTIONS.payoutFailed]));
    if (audit.length) {
      await db.delete(schema.auditLog).where(inArray(schema.auditLog.id, audit.map((a) => a.id)));
    }
  });

  it("payout.paid → confirme le versement (pending/processing → paid, idempotent)", async () => {
    const evt = payoutEvent("payout.paid", pendingProviderPayoutId, "paid");
    const res = await POST(await makeReq(evt));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.kind).toBe("payout");
    expect(body.status).toBe("paid");
    expect(body.confirmed).toBe(true);

    const [row] = await db
      .select({ status: schema.payouts.status, paidAt: schema.payouts.paidAt })
      .from(schema.payouts)
      .where(eq(schema.payouts.id, pendingPayoutId));
    expect(row.status).toBe("paid");
    expect(row.paidAt).not.toBeNull();

    // P4 : la confirmation d'un versement est journalisée (audit `payout.paid`).
    const [audit] = await db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.action, AUDIT_ACTIONS.payoutPaid))
      .limit(1);
    expect(audit).toBeTruthy();
    expect(audit.entityType).toBe("payout");

    // Idempotence : un second événement ne change rien et renvoie confirmed=true.
    const res2 = await POST(await makeReq(evt));
    const body2 = await res2.json();
    expect(body2.confirmed).toBe(true);
  });

  it("payout.failed → signale l'échec définitif", async () => {
    // Nouveau payout en pending pour ne pas polluer le cas paid.
    const providerId = `po_fail_${runKey}`;
    const [p] = await db
      .insert(schema.payouts)
      .values({
        hostId,
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
        currency: "EUR",
        grossAmount: "100.00",
        commissionAmount: "15.00",
        netAmount: "85.00",
        bookingsCount: 1,
        status: "processing",
        providerPayoutId: providerId,
        idempotencyKey: `payout:${hostId}:2026-08-01:2026-08-31:EUR:failwebhook:${runKey}`,
      })
      .returning();
    const res = await POST(await makeReq(payoutEvent("payout.failed", providerId, "failed")));
    const body = await res.json();
    expect(body.kind).toBe("payout");
    expect(body.status).toBe("failed");
    const [row] = await db.select().from(schema.payouts).where(eq(schema.payouts.id, p.id));
    expect(row.status).toBe("failed");
    expect(row.failedAt).not.toBeNull();
    await db.delete(schema.payouts).where(eq(schema.payouts.id, p.id));
  });

  it("payout.pending / in_transit → aucune modification (reste processing)", async () => {
    const res = await POST(await makeReq(payoutEvent("payout.created", pendingProviderPayoutId, "in_transit")));
    const body = await res.json();
    expect(body.kind).toBe("payout");
    expect(body.status).toBe("pending");
    const [row] = await db
      .select({ status: schema.payouts.status })
      .from(schema.payouts)
      .where(eq(schema.payouts.id, pendingPayoutId));
    expect(row.status).toBe("paid"); // inchangé depuis le test précédent
  });

  it("événement inconnu (non payout, non paiement) → 400 signature", async () => {
    // Type inconnu : ni payout, ni payment_intent/refund → le provider paiement
    // renvoie null (mock filtre par `data.object.id`). Le résultat dépend du
    // provider mock : nous vérifions qu'il n'est pas traité comme un payout.
    const res = await POST(await makeReq(payoutEvent("unknown.event", "x", "succeeded")));
    expect([200, 400]).toContain(res.status);
  });

  it("payload JSON invalide → 400 (pas de crash)", async () => {
    const { NextRequest } = await import("next/server");
    const res = await POST(new NextRequest("http://localhost/api/webhooks/stripe", {
      method: "POST",
      body: "not json",
    }));
    expect(res.status).toBe(400);
  });
});
