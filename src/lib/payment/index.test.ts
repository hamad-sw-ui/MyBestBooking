import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  MockPaymentProvider,
  StripePaymentProvider,
  getPaymentProvider,
  _resetPaymentProvider,
} from "./index";

describe("MockPaymentProvider (T-020, §13.5)", () => {
  it("create → payment intent 'succeeded' immédiat", async () => {
    const p = new MockPaymentProvider();
    const r = await p.create({
      amount: 20000,
      currency: "EUR",
      bookingReference: "MBB-TEST",
      guestEmail: "t@t.fr",
    });
    expect(r.id).toMatch(/^pi_mock_/);
    expect(r.status).toBe("succeeded");
    expect(r.clientSecret).toBeNull();
  });

  it("retrieve retrouve le même intent mock pour une reprise", async () => {
    const p = new MockPaymentProvider();
    const created = await p.create({ amount: 1000, currency: "EUR", bookingReference: "MBB-RESUME", guestEmail: "resume@example.test", idempotencyKey: "resume-key" });
    await expect(p.retrieve(created.id)).resolves.toMatchObject({ id: created.id, amount: 1000 });
  });

  it("cancel annule un intent mock en attente", async () => {
    const p = new MockPaymentProvider();
    await expect(p.cancel("pi_mock_any")).resolves.toBe("succeeded");
  });

  it("refund → remboursement mock immédiatement réussi", async () => {
    const p = new MockPaymentProvider();
    const refund = await p.refund("pi_mock_any", 1250);
    expect(refund).toMatchObject({ status: "succeeded", amount: 1250 });
    expect(refund.id).toMatch(/^re_mock_/);
  });

  it("verifyWebhook accepte n'importe quel JSON payload", async () => {
    const p = new MockPaymentProvider();
    const evt = await p.verifyWebhook(
      JSON.stringify({ type: "payment_intent.succeeded", data: { object: { id: "pi_x", status: "succeeded" } } }),
    );
    expect(evt?.paymentIntentId).toBe("pi_x");
  });

  it("verifyWebhook retourne null sur JSON invalide", async () => {
    const p = new MockPaymentProvider();
    expect(await p.verifyWebhook("not json")).toBeNull();
  });
});

describe("StripePaymentProvider — verifyWebhook (§13.5)", () => {
  const secret = "whsec_test_dummy";
  const provider = new StripePaymentProvider("sk_test_dummy", secret);

  function sign(payload: string, ts: number = Math.floor(Date.now() / 1000)) {
    const sig = createHmac("sha256", secret).update(`${ts}.${payload}`).digest("hex");
    return `t=${ts},v1=${sig}`;
  }

  it("signature valide + payload valide → event retourné", async () => {
    const payload = JSON.stringify({
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_stripe_1", status: "succeeded" } },
    });
    const evt = await provider.verifyWebhook(payload, sign(payload));
    expect(evt?.paymentIntentId).toBe("pi_stripe_1");
    expect(evt?.type).toBe("payment_intent.succeeded");
  });

  it("refund.updated valide → événement refund typé", async () => {
    const payload = JSON.stringify({
      type: "refund.updated",
      data: { object: { id: "re_123", payment_intent: "pi_stripe_1", status: "succeeded" } },
    });
    const evt = await provider.verifyWebhook(payload, sign(payload));
    expect(evt).toMatchObject({ kind: "refund", refundId: "re_123", paymentIntentId: "pi_stripe_1", status: "succeeded" });
  });

  it("signature absente → null", async () => {
    expect(await provider.verifyWebhook("{}", null)).toBeNull();
  });

  it("signature invalide → null", async () => {
    const p = JSON.stringify({ type: "x", data: { object: { id: "y" } } });
    expect(await provider.verifyWebhook(p, "t=1,v1=deadbeef")).toBeNull();
  });

  it("accepte une signature v1 valide parmi plusieurs pendant une rotation", async () => {
    const payload = JSON.stringify({ type: "payment_intent.succeeded", data: { object: { id: "pi_rotate", status: "succeeded" } } });
    const valid = sign(payload);
    expect(await provider.verifyWebhook(payload, `${valid},v1=${"0".repeat(64)}`)).toMatchObject({ paymentIntentId: "pi_rotate" });
  });

  it("ignore les événements Stripe hors contrat payment/refund", async () => {
    const payload = JSON.stringify({ type: "charge.dispute.created", data: { object: { id: "dp_1", status: "open" } } });
    expect(await provider.verifyWebhook(payload, sign(payload))).toBeNull();
  });

  it("timestamp trop vieux (> 5min) → null", async () => {
    const old = Math.floor(Date.now() / 1000) - 3600;
    const payload = JSON.stringify({ type: "x", data: { object: { id: "y" } } });
    expect(await provider.verifyWebhook(payload, sign(payload, old))).toBeNull();
  });

  it("porte la même clé d’idempotence sur création et remboursement", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "pi_idem", client_secret: "secret", status: "requires_payment_method" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "re_idem", status: "succeeded", amount: 500 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const p = new StripePaymentProvider("sk_test_dummy", secret);
    await p.create({ amount: 500, currency: "EUR", bookingReference: "MBB-IDEM", guestEmail: "x@example.test", idempotencyKey: "booking-intent:MBB-IDEM" });
    await p.refund("pi_idem", 500, "late-capture-refund:booking");
    expect(fetchMock.mock.calls[0][1].headers["Idempotency-Key"]).toBe("booking-intent:MBB-IDEM");
    expect(fetchMock.mock.calls[1][1].headers["Idempotency-Key"]).toBe("late-capture-refund:booking");
    vi.unstubAllGlobals();
  });
});

describe("getPaymentProvider factory", () => {
  beforeEach(() => _resetPaymentProvider());
  afterEach(() => {
    _resetPaymentProvider();
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    vi.unstubAllEnvs();
  });

  it("sans variables → Mock", async () => {
    expect((await getPaymentProvider()).kind).toBe("mock");
  });

  it("avec STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET → Stripe", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
    _resetPaymentProvider();
    expect((await getPaymentProvider()).kind).toBe("stripe");
  });

  it("uniquement STRIPE_SECRET_KEY (webhook manquant) → Mock (dégradé)", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    _resetPaymentProvider();
    expect((await getPaymentProvider()).kind).toBe("mock");
  });

  it("refuse le mock lorsqu'un runtime production n'a pas toutes les clés Stripe", async () => {
    vi.stubEnv("NODE_ENV", "production");
    _resetPaymentProvider();
    await expect(getPaymentProvider()).rejects.toThrow(/exige les clés Stripe/);
  });
});
