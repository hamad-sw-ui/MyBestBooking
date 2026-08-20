import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Email, Mailer } from "./types";

/**
 * ConsoleMailer — écrit l'email dans .data/mails/<timestamp>-<to>.txt
 * en dev/test. Aucune dépendance externe. Utilisé automatiquement
 * quand RESEND_API_KEY n'est pas défini.
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
    const id = `${ts}-${this.counter++}-${safeTo}`;
    const path = join(this.dir, `${id}.txt`);
    const content =
      `To: ${email.to}\n` +
      `Subject: ${email.subject}\n` +
      `Date: ${new Date().toISOString()}\n` +
      `Content-Type: text/plain; charset=utf-8\n` +
      `\n${email.text}\n\n` +
      `--- HTML ---\n${email.html}\n`;
    try {
      writeFileSync(path, content, "utf8");
      // eslint-disable-next-line no-console
      console.log(`[mail:console] Sent to ${email.to} → ${path}`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[mail:console] Failed to write ${path}:`, e);
    }
    return { id };
  }
}
