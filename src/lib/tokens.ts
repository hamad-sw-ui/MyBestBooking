import { createHash, randomUUID } from "node:crypto";
import { db } from "@/db";
import { verificationTokens } from "@/db/schema";
import { and, eq, isNull, gt } from "drizzle-orm";

/**
 * Utilitaires de tokens pour email verification + password reset
 * (T-013). Le token clair est envoyé par email, la base ne stocke
 * qu'un hash SHA-256 pour limiter l'impact d'une fuite.
 */

export type TokenPurpose = "email_verification" | "password_reset" | "guest_claim";

export function hashToken(clear: string): string {
  return createHash("sha256").update(clear).digest("hex");
}

export interface IssuedToken {
  clear: string; // à envoyer par email UNIQUEMENT
  hash: string;
  expiresAt: Date;
}

const DEFAULT_TTL_MS: Record<TokenPurpose, number> = {
  email_verification: 24 * 60 * 60 * 1000, // 24h
  password_reset: 60 * 60 * 1000,           // 1h
  guest_claim: 24 * 60 * 60 * 1000,          // 24h
};

export async function issueToken(
  userId: string,
  purpose: TokenPurpose,
  ttlMs?: number,
): Promise<IssuedToken> {
  const clear = randomUUID() + randomUUID().replace(/-/g, "");
  const hash = hashToken(clear);
  const expiresAt = new Date(Date.now() + (ttlMs ?? DEFAULT_TTL_MS[purpose]));
  await db.insert(verificationTokens).values({
    userId,
    tokenHash: hash,
    purpose,
    expiresAt,
  });
  return { clear, hash, expiresAt };
}

/**
 * Consomme un token clair : le trouve, vérifie qu'il n'est pas
 * utilisé ni expiré, le marque `usedAt`, et renvoie le userId.
 * Retourne null si invalide.
 */
export async function consumeToken(
  clear: string,
  purpose: TokenPurpose,
): Promise<string | null> {
  const hash = hashToken(clear);
  const [row] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.tokenHash, hash),
        eq(verificationTokens.purpose, purpose),
        isNull(verificationTokens.usedAt),
        gt(verificationTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) return null;
  await db
    .update(verificationTokens)
    .set({ usedAt: new Date() })
    .where(eq(verificationTokens.id, row.id));
  return row.userId;
}
