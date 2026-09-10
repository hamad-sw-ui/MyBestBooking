import { NextResponse } from "next/server";

/**
 * T-207 — Paiement en ligne retiré du parcours réservation.
 *
 * La route publique legacy ne renvoie plus jamais de clé publiable Stripe, afin
 * qu'aucun composant navigateur ne puisse reconstruire un formulaire de carte.
 */
export async function GET() {
  return NextResponse.json({ configured: false, onlinePaymentDisabled: true });
}
