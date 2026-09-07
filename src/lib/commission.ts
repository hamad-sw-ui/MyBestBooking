import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSetting } from "@/lib/settings";

/**
 * T-202 — résolution du taux de commission effectif pour un hôte, avec la
 * priorité : **propriété > hôte > global**.
 *
 * - `propertyRate` : taux explicite de la propriété (si renseigné). Comme les
 *   propriétés existantes portent une valeur (ex : "15.00"), elles gardent leur
 *   taux (aucune régression). Un `null`/`undefined` = hérite.
 * - `hostRate`      : taux fixé par l'admin à l'approbation de l'hôte
 *   (`users.commissionRate`). `null` = hérite.
 * - `globalRate`    : `settings.billing.defaultCommissionRate` (défaut 15).
 *
 * Retourne un nombre (pourcentage 0–100).
 */
export async function resolveEffectiveCommissionRate(
  hostId: string,
  propertyRate: string | number | null | undefined,
): Promise<number> {
  // 1. Taux explicite de la propriété.
  const propRate = toNumberOrNull(propertyRate);
  if (propRate !== null) return clampRate(propRate);

  // 2. Taux hôte (fixé à l'approbation).
  const [host] = await db
    .select({ commissionRate: users.commissionRate })
    .from(users)
    .where(eq(users.id, hostId))
    .limit(1);
  const hostRate = toNumberOrNull(host?.commissionRate);

  // 3. Taux global (settings). La lecture est faite APRÈS l'accès hôte pour ne
  // charger le setting que si nécessaire.
  let globalRate: number;
  try {
    const billing = await getSetting("billing");
    globalRate = Number(billing.defaultCommissionRate);
  } catch {
    globalRate = 15;
  }

  return resolveCommissionRate(propertyRate, hostRate, globalRate);
}

export function toNumberOrNull(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function clampRate(n: number): number {
  return Math.max(0, Math.min(100, n));
}

/**
 * Fonction pure : applique la priorité propriété > hôte > global.
 * Exportée pour tests unitaires sans DB.
 */
export function resolveCommissionRate(
  propertyRate: string | number | null | undefined,
  hostRate: string | number | null | undefined,
  globalRate: number,
): number {
  const prop = toNumberOrNull(propertyRate);
  if (prop !== null) return clampRate(prop);
  const host = toNumberOrNull(hostRate);
  if (host !== null) return clampRate(host);
  return clampRate(Number(globalRate));
}
