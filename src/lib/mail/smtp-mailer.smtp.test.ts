import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { createServer, type Socket, type AddressInfo } from "node:net";
import { eq, inArray } from "drizzle-orm";

/**
 * SMTP (audit demande utilisateur, 2026-09-12) — preuve que la configuration
 * SMTP est fonctionnelle de bout en bout, SANS fournisseur externe.
 *
 * Un sink SMTP minimal (node:net, port éphémère 127.0.0.1) joue le serveur ;
 * les variables SMTP_* sont posées pour la durée du test :
 *   1. `getMailer()` sélectionne bien `SmtpMailer` (et ConsoleMailer sans env —
 *      non-régression du mode dev) ;
 *   2. une ligne `email_outbox` réelle est livrée par `deliverEmail` : le sink
 *      reçoit la transaction complète (EHLO, AUTH PLAIN, MAIL FROM, RCPT TO,
 *      DATA) avec l'en-tête d'idempotence `X-MyBestBooking-Event-Key`, et la
 *      ligne passe `sent` avec `providerMessageId` ;
 *   3. le mode 587 impose STARTTLS par défaut : face à un sink qui ne le
 *      propose pas, l'envoi échoue PROPREMENT (ligne repasse `pending` +
 *      `lastError`, aucun crash, retry conservé) ;
 *   4. `SMTP_REQUIRE_TLS=false` (relais local en clair, documenté) fonctionne.
 *
 * Test d'intégration : DB réelle (auto-skip si absente). Fixtures outbox purgées.
 */

let dbAvailable = false;
try {
  const { Pool } = await import("pg");
  const pool = new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:55432/app_db",
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

interface Captured {
  ehlo: string | null;
  authUser: string | null;
  mailFrom: string | null;
  rcptTo: string[];
  data: string;
  messageId: string | null;
}

/** Sink SMTP minimal : 220, EHLO (AUTH PLAIN), AUTH, MAIL, RCPT, DATA, QUIT. */
function startSmtpSink(): Promise<{
  port: number;
  captured: Captured;
  stop: () => Promise<void>;
}> {
  return new Promise((resolve) => {
    const captured: Captured = { ehlo: null, authUser: null, mailFrom: null, rcptTo: [], data: "", messageId: null };
    const server = createServer((socket: Socket) => {
      let buffer = "";
      let inData = false;
      socket.write("220 smtp-sink ESMTP\r\n");
      socket.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        // Traitement ligne par ligne (ou octet par octet en mode DATA).
        for (;;) {
          if (inData) {
            const idx = buffer.indexOf("\r\n");
            if (idx === -1) return;
            const line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            if (line === ".") {
              inData = false;
              captured.messageId = `SINK-${Date.now()}`;
              socket.write(`250 2.0.0 Ok: queued as ${captured.messageId}\r\n`);
            } else {
              // Dé-stuffing des points (RFC 5321 §4.5.2) — le texte du test
              // n'en contient pas, mais on reste fidèle au protocole.
              captured.data += (line.startsWith("..") ? line.slice(1) : line) + "\r\n";
            }
            continue;
          }
          const idx = buffer.indexOf("\r\n");
          if (idx === -1) return;
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (line === "") continue;
          const [cmd, ...rest] = line.split(" ");
          switch (cmd.toUpperCase()) {
            case "EHLO":
              captured.ehlo = rest.join(" ");
              socket.write("250-smtp-sink\r\n250 AUTH PLAIN LOGIN\r\n");
              break;
            case "AUTH": {
              const mech = rest[0]?.toUpperCase();
              if (mech === "PLAIN" && rest[1]) {
                const decoded = Buffer.from(rest[1], "base64").toString("utf8");
                captured.authUser = decoded.split("\u0000")[1] ?? null;
                socket.write("235 Authentication successful\r\n");
              } else if (mech === "LOGIN") {
                socket.write("334 VXNlcm5hbWU6\r\n");
              } else {
                socket.write("504 Authentication mechanism not supported\r\n");
              }
              break;
            }
            case "MAIL":
              captured.mailFrom = line.slice(line.indexOf(":") + 1).trim();
              socket.write("250 OK\r\n");
              break;
            case "RCPT":
              captured.rcptTo.push(line.slice(line.indexOf(":") + 1).trim());
              socket.write("250 OK\r\n");
              break;
            case "DATA":
              inData = true;
              socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
              break;
            case "RSET":
              socket.write("250 OK\r\n");
              break;
            case "NOOP":
              socket.write("250 OK\r\n");
              break;
            case "QUIT":
              socket.write("221 Bye\r\n");
              socket.end();
              break;
            default:
              socket.write("502 Command not implemented\r\n");
          }
        }
      });
      socket.on("error", () => socket.destroy());
    });
    server.listen(0, "127.0.0.1", () => {
      resolve({
        port: (server.address() as AddressInfo).port,
        captured,
        stop: () =>
          new Promise<void>((r) => {
            server.close(() => r());
          }),
      });
    });
  });
}

dbTest("SMTP — configuration et livraison de bout en bout", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let deliverEmail: typeof import("@/lib/email-outbox").deliverEmail;
  let getMailer: typeof import("@/lib/mail").getMailer;
  let SmtpMailerCtor: typeof import("@/lib/mail/smtp-mailer").SmtpMailer;
  let ConsoleMailerCtor: typeof import("@/lib/mail").ConsoleMailer;
  const eventKeys: string[] = [];

  beforeAll(async () => {
    const dbMod = await import("@/db");
    db = dbMod.db;
    schema = await import("@/db/schema");
    const outbox = await import("@/lib/email-outbox");
    deliverEmail = outbox.deliverEmail;
    const mail = await import("@/lib/mail");
    getMailer = mail.getMailer;
    ConsoleMailerCtor = mail.ConsoleMailer;
    const smtp = await import("@/lib/mail/smtp-mailer");
    SmtpMailerCtor = smtp.SmtpMailer;
  });

  beforeEach(() => {
    vi.stubEnv("SMTP_HOST", "127.0.0.1");
    vi.stubEnv("SMTP_USER", "smtp-test@example.com");
    vi.stubEnv("SMTP_PASSWORD", "smtp-test-secret");
    vi.stubEnv("SMTP_FROM", "MyBestBooking <smtp-test@example.com>");
  });
  afterEach(async () => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    if (eventKeys.length) {
      await db
        .delete(schema.emailOutbox)
        .where(eq(schema.emailOutbox.eventKey, eventKeys[0]));
      for (const key of eventKeys.slice(1)) {
        await db.delete(schema.emailOutbox).where(eq(schema.emailOutbox.eventKey, key));
      }
    }
  });

  it("getMailer() sélectionne SmtpMailer quand SMTP_USER/SMTP_PASSWORD sont posés", async () => {
    vi.stubEnv("SMTP_PORT", "2525");
    vi.stubEnv("SMTP_SECURE", "false");
    const m = await getMailer();
    expect(m).toBeInstanceOf(SmtpMailerCtor);
  });

  it("sans variables SMTP : le mode dev historique (ConsoleMailer) est conservé", async () => {
    vi.unstubAllEnvs();
    const m = await getMailer();
    expect(m).toBeInstanceOf(ConsoleMailerCtor);
  });

  it("livraison réelle : outbox → transaction SMTP complète → ligne sent + providerMessageId", async () => {
    const sink = await startSmtpSink();
    try {
      vi.stubEnv("SMTP_PORT", String(sink.port));
      vi.stubEnv("SMTP_SECURE", "false");
      // Relais local en clair (documenté) : STARTTLS désactivé explicitement.
      vi.stubEnv("SMTP_REQUIRE_TLS", "false");

      const stamp = Date.now();
      const eventKey = `smtp-e2e:${stamp}`;
      eventKeys.push(eventKey);
      await db.insert(schema.emailOutbox).values({
        eventKey,
        to: "destinataire@example.com",
        subject: `Objet SMTP test ${stamp}`,
        html: "<p>Corps du message SMTP</p>",
        text: "Corps du message SMTP",
      });

      const ok = await deliverEmail(eventKey);
      expect(ok).toBe(true);

      // Transaction complète reçue par le sink.
      expect(sink.captured.ehlo).toBeTruthy();
      expect(sink.captured.authUser).toBe("smtp-test@example.com");
      // Enveloppe SMTP (reverse path) = adresse seule, sans display name
      // (RFC 5321) ; le « From: » avec display name est dans le DATA.
      expect(sink.captured.mailFrom).toBe("<smtp-test@example.com>");
      expect(sink.captured.rcptTo).toEqual(["<destinataire@example.com>"]);
      expect(sink.captured.data).toContain("From: MyBestBooking <smtp-test@example.com>");
      expect(sink.captured.data).toContain(`Subject: Objet SMTP test ${stamp}`);
      expect(sink.captured.data).toContain("Corps du message SMTP");
      // Deuxième niveau d'idempotence transmis au mailer (le nom
      // d'en-tête est insensible à la casse — RFC 5322 ; nodemailer
      // normalise en minuscules).
      expect(sink.captured.data.toLowerCase()).toContain(
        `x-mybestbooking-event-key: ${eventKey}`,
      );

      // Ligne outbox : sent + messageId du provider.
      const [row] = await db
        .select()
        .from(schema.emailOutbox)
        .where(eq(schema.emailOutbox.eventKey, eventKey));
      expect(row?.status).toBe("sent");
      expect(row?.providerMessageId).toBeTruthy();
      expect(row?.lastError).toBeNull();
    } finally {
      await sink.stop();
    }
  });

  it("port 587 : STARTTLS imposé par défaut — serveur sans STARTTLS → échec propre (pending + lastError, retry conservé)", async () => {
    const sink = await startSmtpSink();
    try {
      vi.stubEnv("SMTP_PORT", String(sink.port));
      vi.stubEnv("SMTP_SECURE", "false");
      // Pas de SMTP_REQUIRE_TLS → défaut strict (STARTTLS obligatoire).
      // Le sink ne propose pas STARTTLS → l'envoi DOIT échouer proprement.

      const stamp = Date.now();
      const eventKey = `smtp-strict:${stamp}`;
      eventKeys.push(eventKey);
      await db.insert(schema.emailOutbox).values({
        eventKey,
        to: "destinataire@example.com",
        subject: "Objet SMTP strict",
        html: "<p>Strict</p>",
        text: "Strict",
      });

      const ok = await deliverEmail(eventKey);
      expect(ok).toBe(false);

      const [row] = await db
        .select()
        .from(schema.emailOutbox)
        .where(eq(schema.emailOutbox.eventKey, eventKey));
      expect(row?.status).toBe("pending");
      expect(row?.attempts).toBe(1);
      expect(row?.lastError).toBeTruthy();
      expect(row!.lastError!.toLowerCase()).toContain("starttls");
    } finally {
      await sink.stop();
    }
  });
});
