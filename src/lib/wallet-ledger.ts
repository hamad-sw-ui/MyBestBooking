import { db } from "@/db";
import { walletTransactions } from "@/db/schema";
import { count, desc, eq } from "drizzle-orm";

/**
 * T-248 (audit n°5, constat A6 — reprise de O1) — journal du wallet.
 *
 * Constat : `users.wallet_balance` était une colonne scalaire mutée par 4
 * familles de code (cashback BestRewards, bonus de parrainage, remboursements
 * de `booking-benefits` et de `booking-request-expiration`) **sans aucune
 * trace** : impossible d'expliquer un solde, de détecter un doublon de crédit
 * ou d'auditer le programme.
 *
 * Principe retenu (strictement additif) :
 *   - `users.wallet_balance` **reste la source de vérité** — aucun écran ni
 *     calcul ne change ;
 *   - chaque mutation écrit une ligne `wallet_transactions` **dans la même
 *     transaction** que la mise à jour du solde : soit les deux passent, soit
 *     aucune (pas de journal orphelin ni de crédit non tracé) ;
 *   - le journal est append-only (aucune mise à jour ni suppression
 *     applicative) ;
 *   - `amount` est **signé** : crédit > 0, débit < 0 (les débits existent déjà
 *     en base sous forme de `walletCreditsUsed` remboursés).
 */

export type WalletEntryKind =
  | "cashback"
  | "referral_referee"
  | "referral_referrer"
  | "booking_refund"
  /** Réservé à la consommation du solde (décision produit T-248 §3). */
  | "booking_payment"
  | "manual_adjustment"
  /**
   * T-262 (audit n°6, B8) : trace de clôture de compte. **Jamais un
   * mouvement** — le solde gelé reste attaché au compte anonymisé.
   */
  | "account_closed";

/**
 * Exécuteur : `db` ou la transaction courante. Le journal doit être écrit dans
 * la transaction de l'appelant, sinon il pourrait diverger du solde.
 */
export type WalletExecutor = Pick<typeof db, "insert">;

export interface WalletEntryInput {
  userId: string;
  /** Montant signé, en EUR (crédit > 0, débit < 0). */
  amount: number;
  /** Solde **après** l'opération (le journal porte l'état, pas le delta seul). */
  balanceAfter: string | number;
  kind: WalletEntryKind;
  bookingId?: string | null;
  actorId?: string | null;
  note?: string | null;
}

/**
 * Enregistre un mouvement de wallet. **Lève** en cas d'échec : appelée dans la
 * transaction du solde, l'erreur annule l'ensemble (le solde ne peut pas
 * bouger sans sa ligne de journal).
 */
export async function recordWalletEntry(
  executor: WalletExecutor,
  entry: WalletEntryInput,
): Promise<void> {
  const amount = Number(entry.amount);
  if (!Number.isFinite(amount) || amount === 0) {
    // Un mouvement nul n'a pas de sens dans un journal (les crédits à 0
    // seraient innombrables) : on n'écrit rien, sans erreur.
    return;
  }
  await executor.insert(walletTransactions).values({
    userId: entry.userId,
    amount: amount.toFixed(2),
    balanceAfter: Number(entry.balanceAfter).toFixed(2),
    kind: entry.kind,
    bookingId: entry.bookingId ?? null,
    actorId: entry.actorId ?? null,
    note: entry.note ?? null,
  });
}

/**
 * T-262 (audit n°6, B8) — trace la clôture d'un compte qui laisse un solde
 * positif derrière lui.
 *
 * Le gel T-248 §3 interdit toute consommation : cette ligne **ne modifie pas
 * `users.wallet_balance`**, elle consigne seulement qu'un crédit de
 * `balanceAfter` subsiste sur un compte anonymisé (ni visible, ni utilisable).
 * `recordWalletEntry` ignore volontairement les mouvements nuls (un journal de
 * zéros serait illisible) : cette écriture a donc sa propre fonction, appelée
 * **dans la transaction de suppression**, et uniquement si un solde disparaît.
 */
export async function recordAccountClosureEntry(
  executor: WalletExecutor,
  input: { userId: string; balance: string | number },
): Promise<void> {
  await executor.insert(walletTransactions).values({
    userId: input.userId,
    amount: "0.00",
    balanceAfter: Number(input.balance).toFixed(2),
    kind: "account_closed",
    note: "Suppression de compte — crédit gelé conservé sur le solde (non consommé)",
  });
}

/** Nombre total de mouvements (pour `X-Total-Count`) — lecture seule. */
export async function countWalletEntries(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(walletTransactions)
    .where(eq(walletTransactions.userId, userId));
  return row?.total ?? 0;
}

export interface WalletStatementLine {
  id: string;
  amount: string;
  balanceAfter: string;
  kind: string;
  bookingId: string | null;
  note: string | null;
  createdAt: string;
}

/** Historique d'un utilisateur (le plus récent d'abord) — lecture seule. */
export async function listWalletEntries(
  userId: string,
  limit = 20,
): Promise<WalletStatementLine[]> {
  const rows = await db
    .select()
    .from(walletTransactions)
    .where(eq(walletTransactions.userId, userId))
    .orderBy(desc(walletTransactions.createdAt))
    .limit(limit);
  return rows.map((row) => ({
    id: row.id,
    amount: String(row.amount),
    balanceAfter: String(row.balanceAfter),
    kind: row.kind,
    bookingId: row.bookingId,
    note: row.note,
    createdAt:
      row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  }));
}
