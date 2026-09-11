import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import { countWalletEntries, listWalletEntries } from "@/lib/wallet-ledger";
import { parseApiPagination } from "@/lib/page-window";

export const dynamic = "force-dynamic";

/**
 * GET /api/wallet/transactions — T-248 (audit n°5, constat A6).
 *
 * Historique **du wallet de l'appelant** (jamais celui d'un tiers). Lecture
 * seule, strictement additive : aucun écran existant n'en dépend.
 *
 * Pagination opt-in, comme `GET /api/bookings` : sans `limit`/`offset`, les 20
 * derniers mouvements ; avec, bornes 1-100 et en-tête `X-Total-Count`.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
  }

  const { pagination, error } = parseApiPagination(request.nextUrl.searchParams);
  if (error) {
    return NextResponse.json({ error: await apiError(error) }, { status: 400 });
  }
  const limit = pagination?.limit ?? 20;

  try {
    const [entries, total] = await Promise.all([
      listWalletEntries(user.id, limit),
      countWalletEntries(user.id),
    ]);
    return NextResponse.json(
      { transactions: entries, total, balance: user.walletBalance ?? "0.00" },
      { headers: { "X-Total-Count": String(total) } },
    );
  } catch (error) {
    console.error("[wallet/transactions] GET", error);
    return NextResponse.json(
      { error: await apiError("Une erreur est survenue") },
      { status: 500 },
    );
  }
}
