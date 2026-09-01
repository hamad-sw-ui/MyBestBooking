import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { ProviderCredentialsError, rotateProviderCredentialEncryption } from "@/lib/provider-credentials";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-error";

const bodySchema = z.object({ confirm: z.literal("ROTATE_CREDENTIALS") });

/**
 * POST /api/admin/providers/rotation
 * L’infrastructure fournit les clés; HTTP ne reçoit et ne retourne jamais un
 * secret. Voir ADR-012 pour la procédure de double keyring.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return NextResponse.json({ error: await apiError("Accès admin requis") }, { status: 403 });
  const rl = rateLimit(`admin:provider-rotation:${user.id}`, { limit: 3, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: await apiError("Trop de tentatives de rotation, réessayez plus tard") }, { status: 429 });

  try {
    bodySchema.parse(await request.json());
    const result = await rotateProviderCredentialEncryption();
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: AUDIT_ACTIONS.providerCredentialsRotate,
      entityType: "provider_credentials",
      entityId: "all",
      metadata: { reencrypted: result.reencrypted },
    });
    return NextResponse.json({ ok: true, reencrypted: result.reencrypted });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) return NextResponse.json({ error: await apiError("Confirmation de rotation requise") }, { status: 400 });
    if (error instanceof ProviderCredentialsError) return NextResponse.json({ error: await apiError(error.message) }, { status: 503 });
    console.error("[admin/providers/rotation]", error);
    return NextResponse.json({ error: await apiError("Impossible de réchiffrer les credentials providers") }, { status: 500 });
  }
}
