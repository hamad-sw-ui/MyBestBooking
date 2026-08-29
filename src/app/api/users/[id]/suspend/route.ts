import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUuid, frenchZodMessage } from "@/lib/http";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { eq } from "drizzle-orm";

const schema = z.object({
  suspended: z.boolean(),
  reason: z.string().max(500).optional(),
});

/**
 * PATCH /api/users/[id]/suspend (T-016) — admin only.
 * suspended:true → deletedAt=now + supprime sessions actives
 * suspended:false → deletedAt=null (réactivation)
 * Ne peut pas se suspendre soi-même.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Accès admin requis" }, { status: 403 });
    }

    const { id } = await params;
    if (!isUuid(id)) {
      return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    }
    if (id === user.id) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas vous suspendre vous-même" },
        { status: 400 },
      );
    }

    const { suspended, reason } = schema.parse(await request.json());
    const [updated] = await db
      .update(users)
      .set({
        deletedAt: suspended ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning({ id: users.id, email: users.email, deletedAt: users.deletedAt });

    if (!updated) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

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
      return NextResponse.json({ error: "Corps de requête invalide ou manquant (JSON attendu)" }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: frenchZodMessage(error) }, { status: 400 });
    }
    console.error("suspend user error:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
