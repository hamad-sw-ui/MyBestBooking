import { describe, it, expect, beforeEach, afterEach } from "vitest";
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

  it("signature absente → null", async () => {
    expect(await provider.verifyWebhook("{}", null)).toBeNull();
  });

  it("signature invalide → null", async () => {
    const p = JSON.stringify({ type: "x", data: { object: { id: "y" } } });
    expect(await provider.verifyWebhook(p, "t=1,v1=deadbeef")).toBeNull();
  });

  it("timestamp trop vieux (> 5min) → null", async () => {
    const old = Math.floor(Date.now() / 1000) - 3600;
    const payload = JSON.stringify({ type: "x", data: { object: { id: "y" } } });
    expect(await provider.verifyWebhook(payload, sign(payload, old))).toBeNull();
  });
});

describe("getPaymentProvider factory", () => {
  beforeEach(() => _resetPaymentProvider());
  afterEach(() => {
    _resetPaymentProvider();
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("sans variables → Mock", () => {
    expect(getPaymentProvider().kind).toBe("mock");
  });

  it("avec STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET → Stripe", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
    _resetPaymentProvider();
    expect(getPaymentProvider().kind).toBe("stripe");
  });

  it("uniquement STRIPE_SECRET_KEY (webhook manquant) → Mock (dégradé)", () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    _resetPaymentProvider();
    expect(getPaymentProvider().kind).toBe("mock");
  });
});
