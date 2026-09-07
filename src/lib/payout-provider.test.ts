import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import {
  MockPayoutProvider,
  StripePayoutProvider,
  webhookEventType,
  _resetPayoutProvider,
} from "./payout-provider";

/** signe exactement ce que Stripe signe : `${timestamp}.${payload}`. */
function sign(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)) {
  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${expected}`;
}

function payoutPayload(type: string, payoutId: string, status: string) {
  return {
    id: "evt_provider_1",
    type,
    data: { object: { id: payoutId, status } },
  };
}

describe("data — webhookEventType", () => {
  it("extrait le type d'un payload JSON", () => {
    expect(webhookEventType(JSON.stringify(payoutPayload("payout.paid", "po_1", "paid")))).toBe("payout.paid");
  });
  it("retourne null sur JSON invalide", () => {
    expect(webhookEventType("not json")).toBeNull();
  });
  it("retourne null si aucun type", () => {
    expect(webhookEventType(JSON.stringify({ id: "x" }))).toBeNull();
  });
});

describe("MockPayoutProvider — verifyWebhook", () => {
  beforeEach(() => _resetPayoutProvider());

  it("reconnaît `payout.paid` et retourne l'événement normalisé", async () => {
    const p = new MockPayoutProvider();
    const evt = await p.verifyWebhook(JSON.stringify(payoutPayload("payout.paid", "po_1", "paid")), null);
    expect(evt).toMatchObject({ kind: "payout", type: "payout.paid", payoutId: "po_1", status: "paid" });
  });

  it("normalise `canceled`/`failed` → failed", async () => {
    const p = new MockPayoutProvider();
    const evt = await p.verifyWebhook(JSON.stringify(payoutPayload("payout.failed", "po_2", "canceled")), null);
    expect(evt?.status).toBe("failed");
  });

  it("retourne null pour un événement non-payout (payment_intent)", async () => {
    const p = new MockPayoutProvider();
    const evt = await p.verifyWebhook(JSON.stringify({ type: "payment_intent.succeeded", data: { object: { id: "pi_1", status: "succeeded" } } }), null);
    expect(evt).toBeNull();
  });

  it("retourne null sur JSON invalide", async () => {
    const p = new MockPayoutProvider();
    expect(await p.verifyWebhook("not json", null)).toBeNull();
  });
});

describe("StripePayoutProvider — verifyWebhook (signature HMAC-SHA256)", () => {
  const secret = "whsec_test_secret";

  it("accepte un `payout.paid` signé valide", async () => {
    const p = new StripePayoutProvider("sk_test", secret);
    const payload = JSON.stringify(payoutPayload("payout.paid", "po_3", "paid"));
    const evt = await p.verifyWebhook(payload, sign(payload, secret));
    expect(evt?.payoutId).toBe("po_3");
    expect(evt?.status).toBe("paid");
  });

  it("rejette une signature invalide (mauvais secret)", async () => {
    const p = new StripePayoutProvider("sk_test", secret);
    const payload = JSON.stringify(payoutPayload("payout.paid", "po_3", "paid"));
    const bad = sign(payload, "another_secret");
    expect(await p.verifyWebhook(payload, bad)).toBeNull();
  });

  it("rejette l'absence de signature", async () => {
    const p = new StripePayoutProvider("sk_test", secret);
    const payload = JSON.stringify(payoutPayload("payout.paid", "po_3", "paid"));
    expect(await p.verifyWebhook(payload, null)).toBeNull();
  });

  it("rejette une signature expirée (> 5 min)", async () => {
    const p = new StripePayoutProvider("sk_test", secret);
    const payload = JSON.stringify(payoutPayload("payout.failed", "po_4", "failed"));
    const old = Math.floor(Date.now() / 1000) - 400;
    expect(await p.verifyWebhook(payload, sign(payload, secret, old))).toBeNull();
  });

  it("rejette un événement non-payout même signé", async () => {
    const p = new StripePayoutProvider("sk_test", secret);
    const payload = JSON.stringify({ type: "payment_intent.succeeded", data: { object: { id: "pi_1", status: "succeeded" } } });
    expect(await p.verifyWebhook(payload, sign(payload, secret))).toBeNull();
  });
});
