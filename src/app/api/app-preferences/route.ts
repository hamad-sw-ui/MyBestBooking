import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";

/**
 * GET /api/app-preferences — T-132.
 *
 * Préférences d'affichage publiques (devise + langue par défaut de la
 * plateforme), consommé par les composants clients (prix d'aperçu converti,
 * libellés localisés) y compris pour les visiteurs anonymes qui n'ont pas
 * de préférence utilisateur.
 *
 * Ne contient aucune donnée sensible : uniquement la devise/langue par
 * défaut et les listes supportées (déjà exposées dans le panneau admin).
 * Runtime Node (cache de réglages), sans authentification.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const [general, bestrewards] = await Promise.all([
    getSetting("general"),
    getSetting("bestrewards"),
  ]);
  return NextResponse.json(
    {
      defaultCurrency: general.defaultCurrency,
      defaultLanguage: general.defaultLanguage,
      supportedCurrencies: general.supportedCurrencies,
      supportedLocales: general.supportedLocales,
      // T-143 : réglages d'affichage du programme BestRewards, déjà rendus
      // publiquement sur la page marketing /bestrewards. On expose ici les
      // seuils et taux pour que les écrans clients (Mon compte) affichent les
      // mêmes valeurs que la page publique au lieu de les coder en dur.
      bestrewards: {
        thresholds: bestrewards.thresholds,
        discounts: bestrewards.discounts,
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=30, stale-while-revalidate=60",
      },
    },
  );
}
