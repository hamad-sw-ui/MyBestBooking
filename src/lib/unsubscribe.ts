import { createHmac, timingSafeEqual } from "node:crypto";
import { appBaseUrl } from "@/lib/app-url";

/**
 * T-239 (audit n°3, F8) — désabonnement réellement possible.
 *
 * Constat d'audit : la page Confidentialité promettait un « désabonnement
 * possible depuis l'onglet Notifications » et aucun e-mail non transactionnel
 * (les alertes prix) ne portait de lien d'opposition — un destinataire n'avait
 * donc aucun moyen direct de refuser la suite, alors que le texte légal
 * l'affirmait.
 *
 * Choix : un jeton **signé** (HMAC-SHA256 sur `userId|catégorie`), donc
 * impossible à forger pour désabonner un tiers, et limité à une catégorie
 * d'envoi non transactionnelle. Les e-mails transactionnels (confirmation,
 * demande, expiration, sécurité) ne sont pas concernés : ils restent adressés
 * à l'utilisateur parce qu'ils portent l'exécution de son contrat.
 */

export type UnsubscribeCategory = "price_alerts";

export const UNSUBSCRIBE_CATEGORIES: readonly UnsubscribeCategory[] = ["price_alerts"];

export function isUnsubscribeCategory(value: string | null | undefined): value is UnsubscribeCategory {
  return value === "price_alerts";
}

function secret(): string {
  // `JWT_SECRET` est obligatoire au démarrage (ADR-003) ; un repli explicite
  // évite de signer avec une constante silencieuse en environnement de test.
  const value = process.env.JWT_SECRET;
  if (!value) throw new Error("JWT_SECRET manquant : impossible de signer un lien de désabonnement");
  return value;
}

/** Signature stable (base64url, 43 caractères) de `userId|catégorie`. */
export function signUnsubscribeToken(
  userId: string,
  category: UnsubscribeCategory,
  key: string = secret(),
): string {
  return createHmac("sha256", key).update(`${userId}|${category}`).digest("base64url");
}

/** Vérification à temps constant (jamais de comparaison de chaînes naïve). */
export function verifyUnsubscribeToken(
  userId: string,
  category: UnsubscribeCategory,
  token: string | null | undefined,
  key: string = secret(),
): boolean {
  if (!token) return false;
  const expected = signUnsubscribeToken(userId, category, key);
  const received = Buffer.from(token);
  const reference = Buffer.from(expected);
  if (received.length !== reference.length) return false;
  return timingSafeEqual(received, reference);
}

/** URL publique d'opposition, à placer en pied des e-mails non transactionnels. */
export function unsubscribeUrl(
  userId: string,
  category: UnsubscribeCategory,
  base: string = appBaseUrl(),
): string {
  const token = signUnsubscribeToken(userId, category);
  const params = new URLSearchParams({ u: userId, c: category, s: token });
  return `${base}/desabonnement?${params.toString()}`;
}
