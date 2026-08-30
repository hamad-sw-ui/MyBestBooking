import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Email, Mailer } from "./types";

/**
 * ConsoleMailer — écrit dans .data/mails en dev/test. Avec une clé outbox,
 * le nom de fichier est stable : une reprise ne crée pas une seconde copie.
 */
export class ConsoleMailer implements Mailer {
  private dir: string;
  private counter = 0;

  constructor(dir?: string) {
    this.dir = dir ?? join(process.cwd(), ".data", "mails");
    try {
      mkdirSync(this.dir, { recursive: true });
    } catch {
      // ignore
    }
  }

  async send(email: Email): Promise<{ id: string }> {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const safeTo = email.to
      .replace(/[^a-zA-Z0-9@_-]/g, "_")
      .replace(/_+/g, "_");
    const keyHash = email.idempotencyKey
      ? createHash("sha256").update(email.idempotencyKey).digest("hex").slice(0, 24)
      : null;
    const id = keyHash ? `console_${keyHash}` : `${ts}-${this.counter++}-${safeTo}`;
    const path = join(this.dir, `${id}.txt`);
    const content =
      `To: ${email.to}\n` +
      `Subject: ${email.subject}\n` +
      `Date: ${new Date().toISOString()}\n` +
      `Content-Type: text/plain; charset=utf-8\n` +
      `\n${email.text}\n\n` +
      `--- HTML ---\n${email.html}\n`;
    try {
      // Une reprise du même eventKey représente déjà un envoi accepté.
      if (!existsSync(path)) writeFileSync(path, content, "utf8");
      // eslint-disable-next-line no-console
      console.log(`[mail:console] Sent to ${email.to} → ${path}`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[mail:console] Failed to write ${path}:`, e);
    }
    return { id };
  }
}
