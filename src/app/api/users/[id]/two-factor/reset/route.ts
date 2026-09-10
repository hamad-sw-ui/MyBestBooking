import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/http";
import { eq } from "drizzle-orm";
import { apiError } from "@/lib/api-error";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { templates } from "@/lib/mail";
import { enqueueEmail } from "@/lib/email-outbox";
import { appBaseUrl } from "@/lib/app-url";

/**
 * POST /api/users/[id]/two-factor/reset (T-231, audit n°2 A11) — admin only.
 *
 * Dernier recours du support : un utilisateur qui a perdu son application
 * d'authentification **et** ses codes de secours n'avait aucune issue (le seul
 * « reset » existant anonymisait le compte). Ici, l'admin révoque le second
 * facteur de la cible, coupe ses sessions (un facteur qui a pu fuiter ne doit
 * pas rester utilisable) et l'informe par e-mail — le tout tracé sous
 * `user.2fa.reset`.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await getCurrentUser();
    if (!admin || admin.role !== "admin") {
      return NextResponse.json({ error: await apiError("Accès admin requis") }, { status: 403 });
    }
    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: await apiError("Identifiant invalide") }, { status: 400 });
    }

    const [target] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        language: users.language,
        twoFactorEnabled: users.twoFactorEnabled,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!target) return NextResponse.json({ error: await apiError("Introuvable") }, { status: 404 });
    if (target.deletedAt) {
      return NextResponse.json(
        { error: await apiError("Compte supprimé (anonymisé) : aucune 2FA à réinitialiser") },
        { status: 409 },
      );
    }
    if (!target.twoFactorEnabled) {
      return NextResponse.json(
        { error: await apiError("La 2FA n'est pas active sur ce compte") },
        { status: 400 },
      );
    }

    await db
      .update(users)
      .set({
        twoFactorEnabled: false,
        twoFactorSecret: null,
        twoFactorPendingSecret: null,
        twoFactorBackupCodes: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id));
    await db.delete(sessions).where(eq(sessions.userId, id));

    await recordAudit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: AUDIT_ACTIONS.user2faReset,
      entityType: "user",
      entityId: id,
      metadata: { targetEmail: target.email, sessionsRevoked: true },
    });

    // Information de l'intéressé : un facteur retiré à son insu doit être
    // visible immédiatement (best-effort, jamais bloquant pour l'action admin).
    try {
      const mail = await templates.twoFactorReset({
        firstName: target.firstName,
        url: `${appBaseUrl()}/connexion`,
        language: target.language ?? null,
      });
      await enqueueEmail({ eventKey: `two-factor-reset:${id}:${Date.now()}`, to: target.email, ...mail });
    } catch (error) {
      console.error("[2fa-reset] email", error);
    }

    return NextResponse.json({ reset: true, sessionsRevoked: true });
  } catch (error) {
    console.error("[2fa-reset]", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}
