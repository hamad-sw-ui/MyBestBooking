import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

/**
 * Outbox réelle (DB) + ConsoleMailer : enqueue → deliver → status sent + fichier.
 * Skip si Postgres indisponible. Aucune clé Resend (tests/setup.ts).
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
const eventKey = `test-mail-pipeline:${Date.now()}`;

dbTest("outbox + ConsoleMailer (tests uniquement)", () => {
  let db: typeof import("@/db").db;
  let emailOutbox: typeof import("@/db/schema").emailOutbox;
  let enqueueEmail: typeof import("@/lib/email-outbox").enqueueEmail;
  let deliverEmail: typeof import("@/lib/email-outbox").deliverEmail;
  let getMailer: typeof import("@/lib/mail").getMailer;

  beforeAll(async () => {
    db = (await import("@/db")).db;
    emailOutbox = (await import("@/db/schema")).emailOutbox;
    ({ enqueueEmail, deliverEmail } = await import("@/lib/email-outbox"));
    ({ getMailer } = await import("@/lib/mail"));
  });

  afterAll(async () => {
    try {
      await db.delete(emailOutbox).where(eq(emailOutbox.eventKey, eventKey));
    } catch {
      // best-effort
    }
  });

  it("getMailer en test = ConsoleMailer (pas Resend)", async () => {
    expect(process.env.RESEND_API_KEY).toBeUndefined();
    const m = await getMailer();
    expect(m.constructor.name).toBe("ConsoleMailer");
  });

  it("enqueue + deliver → sent + fichier .data/mails", async () => {
    await enqueueEmail({
      eventKey,
      to: "pipeline@test.local",
      subject: "Pipeline test MyBestBooking",
      html: "<p>Corps HTML pipeline</p>",
      text: "Corps HTML pipeline",
    });
    const ok = await deliverEmail(eventKey);
    expect(ok).toBe(true);

    const [row] = await db.select().from(emailOutbox).where(eq(emailOutbox.eventKey, eventKey));
    expect(row.status).toBe("sent");
    expect(row.to).toBe("pipeline@test.local");
    expect(row.providerMessageId).toMatch(/^console_/);
    expect(row.sentAt).not.toBeNull();

    const hash = createHash("sha256").update(eventKey).digest("hex").slice(0, 24);
    const path = join(process.cwd(), ".data", "mails", `console_${hash}.txt`);
    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, "utf8");
    expect(content).toContain("To: pipeline@test.local");
    expect(content).toContain("Subject: Pipeline test MyBestBooking");
    expect(content).toContain("Corps HTML pipeline");
    expect(readdirSync(join(process.cwd(), ".data", "mails")).some((f) => f.includes(hash))).toBe(true);
  });
});
