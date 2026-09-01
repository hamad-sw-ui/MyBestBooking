import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { apiError } from "@/lib/api-error";
import {
  getAllSettings,
  getProviderStatus,
} from "@/lib/settings";

/**
 * GET /api/admin/settings (T-021, ADR-007)
 *
 * Retourne toutes les sections + l'état des providers externes
 * (configured?, jamais les clés).
 * Admin only.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { error: await apiError("Accès admin requis") },
      { status: 403 },
    );
  }

  try {
    const settings = await getAllSettings();
    const providers = getProviderStatus();
    return NextResponse.json({ settings, providers });
  } catch (error) {
    console.error("[admin/settings] GET error:", error);
    return NextResponse.json(
      { error: await apiError("Une erreur est survenue") },
      { status: 500 },
    );
  }
}
