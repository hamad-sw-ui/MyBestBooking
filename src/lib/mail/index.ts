import { ConsoleMailer } from "./console-mailer";
import { ResendMailer } from "./resend-mailer";
import type { Mailer } from "./types";

export type { Mailer, Email } from "./types";
export { templates, stripHtml } from "./templates";
export { ConsoleMailer, ResendMailer };

/**
 * Singleton mailer sélectionné selon l'environnement.
 * - RESEND_API_KEY présent → ResendMailer (prod).
 * - Sinon → ConsoleMailer (dev/test, écrit dans .data/mails/).
 *
 * Voir `.env.example` et ADR (T-013).
 */
let cached: Mailer | null = null;

export function getMailer(): Mailer {
  if (cached) return cached;
  const key = process.env.RESEND_API_KEY;
  cached = key
    ? new ResendMailer(key, process.env.MAIL_FROM)
    : new ConsoleMailer();
  return cached;
}

/** Réinitialise le singleton (tests). */
export function _resetMailer(): void {
  cached = null;
}
