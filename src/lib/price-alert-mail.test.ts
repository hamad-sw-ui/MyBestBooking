import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";

/**
 * Test d'intégration — e-mail d'alerte de prix (cron /api/cron/price-alerts).
 *
 * Reproduit la logique d'envoi du cron (template `priceAlert` + enqueue +
 * deliver via l'outbox idempotente) pour garantir que l'alerte déclenchée
 * aboutit à UN e-mail localisé (langue du destinataire : fr ici), vers le bon
 * destinataire, avec un eventKey déterministe et sans doublon. Skip automatique
 * si la DB n'est pas accessible. Ne modifie que la ligne d'outbox créée puis
 * nettoyée ici.
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

dbTest("T-161 — e-mail d'alerte de prix envoyé, localisé fr, sans doublon", () => {
  let db: typeof import("@/db").db;
  let emailOutbox: typeof import("@/db/schema").emailOutbox;
  let templates: typeof import("@/lib/mail").templates;
  let enqueueEmail: typeof import("@/lib/email-outbox").enqueueEmail;
  let deliverEmail: typeof import("@/lib/email-outbox").deliverEmail;
  const eventKey = `price-alert:pa-${Date.now()}:trip:150.00`;

  beforeAll(async () => {
    const dbMod = await import("@/db");
    db = dbMod.db;
    emailOutbox = (await import("@/db/schema")).emailOutbox;
    templates = (await import("@/lib/mail")).templates;
    ({ enqueueEmail, deliverEmail } = await import("@/lib/email-outbox"));
  });

  afterAll(async () => {
    try {
      await db.delete(emailOutbox).where(eq(emailOutbox.eventKey, eventKey));
    } catch {
      // best-effort
    }
  });

  it("émet un e-mail fr vers le bon destinataire et ne duplique pas", async () => {
    const mail = await templates.priceAlert({
      firstName: "Marie",
      propertyName: "Villa Test",
      price: "150.00",
      currency: "EUR",
      maxPrice: "160.00",
      offerLabel: "pour votre séjour (hors taxes et réductions personnelles)",
      url: "/hebergement/villa-test",
      language: "fr",
    });

    // Localisation fr : sujet + corps en français.
    expect(mail.subject).toBe("Alerte prix : Villa Test");
    expect(mail.text).toMatch(/Bonjour Marie/);
    expect(mail.text).toMatch(/150\.00 EUR/);

    // Enqueue deux fois : l'eventKey unique empêche le doublon.
    await enqueueEmail({ eventKey, to: "marie@test.local", ...mail });
    await enqueueEmail({ eventKey, to: "marie@test.local", ...mail });
    const rowsBefore = await db.select().from(emailOutbox).where(eq(emailOutbox.eventKey, eventKey));
    expect(rowsBefore).toHaveLength(1);

    const sent = await deliverEmail(eventKey);
    expect(sent).toBe(true);

    const rows = await db.select().from(emailOutbox).where(eq(emailOutbox.eventKey, eventKey));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("sent");
    expect(rows[0].to).toBe("marie@test.local");
    expect(rows[0].sentAt).not.toBeNull();
  });
});
