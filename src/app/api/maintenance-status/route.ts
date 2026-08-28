import { NextResponse } from "next/server";
import { isMaintenanceActive } from "@/lib/maintenance";

/**
 * GET /api/maintenance-status — T-128 (audit n°8, P1).
 *
 * État public (booléen) du mode maintenance, consommé par la garde cliente
 * `<MaintenanceGate/>`. Les écritures restent bloquées par
 * `assertNotMaintenance` (503) côté API ; cette route ne sert qu'à faire
 * basculer l'affichage vers /maintenance lors d'un chargement direct (où la
 * redirection RSC n'émet pas de 307 fiable).
 *
 * Runtime Node (accès base via le cache de réglages), sans authentification :
 * l'écran de maintenance est public et un visiteur non connecté doit pouvoir
 * être redirigé. Un cache de réponse court limite les accès base.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const active = await isMaintenanceActive();
  return NextResponse.json(
    { active },
    {
      headers: {
        // Cache navigateur/CDN très court : l'activation/désactivation reste
        // quasi immédiate, mais on évite un accès base sur chaque ressource.
        "Cache-Control": "public, max-age=10, stale-while-revalidate=20",
      },
    },
  );
}
