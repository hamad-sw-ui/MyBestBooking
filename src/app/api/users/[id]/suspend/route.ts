import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUuid, frenchZodMessage } from "@/lib/http";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { eq } from "drizzle-orm";
import { apiError } from "@/lib/api-error";

const schema = z.object({
  suspended: z.boolean(),
  reason: z.string().max(500).optional(),
});

/**
 * PATCH /api/users/[id]/suspend (T-016) — admin only.
 *
 * T-230 (audit n°2, A10) : la suspension écrivait `deletedAt`, exactement comme
 * la suppression — un compte anonymisé affichait donc « Suspendu » avec un
 * bouton « Réactiver », et une réactivation le faisait réapparaître avec une
 * adresse `deleted-…@anonymized.local`. Désormais :
 *   - suspended:true  → `suspendedAt = now` (+ motif) et sessions révoquées ;
 *   - suspended:false → `suspendedAt = null` (réactivation d'une sanction) ;
 *   - un compte **supprimé** (`deletedAt` renseigné) ne peut pas être « réactivé »
 *     → 409 explicite.
 * Ne peut pas se suspendre soi-même.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: await apiError("Accès admin requis") }, { status: 403 });
    }

    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: await apiError("Identifiant invalide") }, { status: 400 });
    }
    if (id === user.id) {
      return NextResponse.json(
        { error: await apiError("Vous ne pouvez pas vous suspendre vous-même") },
        { status: 400 },
      );
    }

    const { suspended, reason } = schema.parse(await request.json());

    const [target] = await db
      .select({ id: users.id, email: users.email, deletedAt: users.deletedAt, suspendedAt: users.suspendedAt })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!target) return NextResponse.json({ error: await apiError("Introuvable") }, { status: 404 });

    // T-230 : un compte supprimé (anonymisé) n'est pas réactivable — c'est le
    // cas « zombie » relevé par l'audit (réactivation 200 sur un compte
    // effacé). On demande explicitement une restauration de sauvegarde.
    if (!suspended && target.deletedAt) {
      return NextResponse.json(
        { error: await apiError("Ce compte est supprimé (anonymisé) : il n'est pas réactivable. Restaurez une sauvegarde si nécessaire.") },
        { status: 409 },
      );
    }
    if (suspended && target.deletedAt) {
      return NextResponse.json(
        { error: await apiError("Ce compte est déjà supprimé (anonymisé) : aucune suspension à poser.") },
        { status: 409 },
      );
    }

    const [updated] = await db
      .update(users)
      .set({
        suspendedAt: suspended ? new Date() : null,
        suspendedReason: suspended ? (reason ?? null) : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        email: users.email,
        deletedAt: users.deletedAt,
        suspendedAt: users.suspendedAt,
        suspendedReason: users.suspendedReason,
      });

    if (!updated) return NextResponse.json({ error: await apiError("Introuvable") }, { status: 404 });

    if (suspended) {
      await db.delete(sessions).where(eq(sessions.userId, id));
    }

    // T-024 : audit log
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: suspended ? AUDIT_ACTIONS.userSuspend : AUDIT_ACTIONS.userReactivate,
      entityType: "user",
      entityId: id,
      // T-125 (P3) : on conserve le motif saisi par l'admin (déjà validé,
      // max 500 caractères) pour la traçabilité des sanctions.
      metadata: { targetEmail: updated.email, ...(reason ? { reason } : {}) },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: await apiError(frenchZodMessage(error)) }, { status: 400 });
    }
    console.error("suspend user error:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}
