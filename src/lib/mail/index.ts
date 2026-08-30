import { ConsoleMailer } from "./console-mailer";
import { ResendMailer } from "./resend-mailer";
import type { Mailer } from "./types";
import { clearProviderCredentialsCache, resolveProviderCredentials } from "@/lib/provider-credentials";

export type { Mailer, Email } from "./types";
export { templates, stripHtml } from "./templates";
export { ConsoleMailer, ResendMailer };

/**
 * Sélectionne le mailer via coffre chiffré DB puis variables d'environnement.
 * Sans clé Resend, le ConsoleMailer reste le comportement dev/test historique.
 */
export async function getMailer(): Promise<Mailer> {
  const config = await resolveProviderCredentials("resend");
  return config.apiKey
    ? new ResendMailer(config.apiKey, config.mailFrom)
    : new ConsoleMailer();
}

/** Réinitialise le cache de configuration (tests ou mutation admin). */
export function _resetMailer(): void {
  clearProviderCredentialsCache("resend");
}
