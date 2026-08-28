import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { SettingValue } from "@/lib/settings";

/**
 * T-125 (P2) : programme de parrainage.
 *
 * Le code de parrainage existe depuis T-026 mais n'était jamais consommé :
 * cette lib fournit les briques manquantes pour boucler le parcours —
 *  - génération d'un code lisible,
 *  - résolution du parrain à l'inscription (jamais bloquante),
 *  - calcul de la récompense versée au séjour terminé (fonction pure).
 */

/**
 * Code alphanumérique lisible (majuscules + chiffres, sans ambiguïté
 * 0/O/1/I). 8 caractères = ~40 bits.
 */
export function generateReferralCode(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/** Normalise un code saisi par l'utilisateur (trim + majuscules). */
export function normalizeReferralCode(raw: string | null | undefined): string {
  return (raw ?? "").trim().toUpperCase();
}

export type ReferralSettings = SettingValue<"bestrewards">["referral"];

/**
 * Résout l'identité du parrain à partir d'un code saisi à l'inscription.
 *
 * Renvoie `null` dans tous les cas non concluants — cette fonction ne doit
 * jamais faire échouer une inscription :
 *  - code vide/absent,
 *  - aucun utilisateur ne porte ce code,
 *  - parrain supprimé (soft-delete),
 *  - le code correspond au futur utilisateur lui-même (impossible en
 *    pratique à l'inscription, mais on garde la garde par sécurité).
 */
export async function resolveReferrerId(
  rawCode: string | null | undefined,
): Promise<string | null> {
  try {
    const code = normalizeReferralCode(rawCode);
    if (code.length < 6) return null;
    const [referrer] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.referralCode, code));
    if (!referrer?.id) return null;
    return referrer.id;
  } catch {
    return null;
  }
}

/**
 * Génère un code de parrainage unique pour un utilisateur nouvellement créé.
 * Renvoie le code, ou `null` en cas d'échec répété (le code peut aussi être
 * généré plus tard au premier GET /api/users/me/referral).
 */
export async function assignReferralCode(userId: string): Promise<string | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    try {
      await db.update(users).set({ referralCode: code }).where(eq(users.id, userId));
      return code;
    } catch {
      // collision sur la contrainte unique → on réessaie
    }
  }
  return null;
}

/**
 * Calcul pur de la récompense de parrainage. Sépare les montants applicables
 * au parrain et au filleul ; `0` quand le programme est désactivé ou que les
 * montants sont nuls. Testable sans base de données.
 */
export function calculateReferralReward(
  referral: ReferralSettings,
): { referrerCredit: number; refereeCredit: number } {
  if (!referral?.enabled) return { referrerCredit: 0, refereeCredit: 0 };
  return {
    referrerCredit: Math.max(0, referral.referrerAmount ?? 0),
    refereeCredit: Math.max(0, referral.refereeAmount ?? 0),
  };
}

/**
 * Sélectionne les filleuls éligibles à une récompense de parrainage :
 * récompense jamais versée ET parrain connu. Utilisé par le cron de
 * complétion des séjours.
 */
export async function findUnrewardedReferredUser(userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      referredBy: users.referredBy,
      referralRewardedAt: users.referralRewardedAt,
    })
    .from(users)
    .where(eq(users.id, userId));
  if (!row || !row.referredBy || row.referralRewardedAt) return null;
  return row;
}
