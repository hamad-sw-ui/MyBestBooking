import { ConsoleMailer } from "./console-mailer";
import { ResendMailer } from "./resend-mailer";
import { SmtpMailer, smtpFromEnv } from "./smtp-mailer";
import type { Mailer } from "./types";
import { clearProviderCredentialsCache, resolveProviderCredentials } from "@/lib/provider-credentials";

export type { Mailer, Email } from "./types";
export { templates, stripHtml } from "./templates";
export { ConsoleMailer, ResendMailer, SmtpMailer };

/**
 * SMTP (Gmail) prioritaire, puis Resend (coffre/env), sinon ConsoleMailer.
 */
export async function getMailer(): Promise<Mailer> {
  const smtp = smtpFromEnv();
  if (smtp) return smtp;
  const config = await resolveProviderCredentials("resend");
  return config.apiKey
    ? new ResendMailer(config.apiKey, config.mailFrom)
    : new ConsoleMailer();
}

/** Réinitialise le cache de configuration (tests ou mutation admin). */
export function _resetMailer(): void {
  clearProviderCredentialsCache("resend");
}
