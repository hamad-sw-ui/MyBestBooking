import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { bookings, promotions, users } from "@/db/schema";
import { recordWalletEntry } from "@/lib/wallet-ledger";

/**
 * Relâche exactement une fois les ressources consommées au hold (promotion et
 * wallet) lorsqu’un paiement n’aboutit pas. Cette fonction ne touche jamais
 * une réservation active ou déjà compensée.
 */
export async function releaseBookingBenefits(bookingId: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [booking] = await tx.select().from(bookings).where(eq(bookings.id, bookingId)).for("update");
    if (!booking || booking.status !== "cancelled" || booking.benefitsReleasedAt) return false;

    if (booking.promotionId) {
      await tx.update(promotions)
        .set({ currentUses: sql`GREATEST(${promotions.currentUses} - 1, 0)` })
        .where(eq(promotions.id, booking.promotionId));
    }
    const walletUsed = Number(booking.walletCreditsUsed ?? "0");
    if (walletUsed > 0) {
      const [user] = await tx.select().from(users).where(eq(users.id, booking.userId)).for("update");
      if (user) {
        const balanceAfter = (Number(user.walletBalance ?? "0") + walletUsed).toFixed(2);
        await tx.update(users).set({
          walletBalance: balanceAfter,
          updatedAt: new Date(),
        }).where(eq(users.id, user.id));
        // T-248 : le remboursement est journalisé dans la même transaction.
        await recordWalletEntry(tx, {
          userId: user.id,
          amount: walletUsed,
          balanceAfter,
          kind: "booking_refund",
          bookingId: booking.id,
          note: booking.bookingReference,
        });
      }
    }
    await tx.update(bookings).set({ benefitsReleasedAt: new Date(), updatedAt: new Date() }).where(eq(bookings.id, booking.id));
    return true;
  });
}
