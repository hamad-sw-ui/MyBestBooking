import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { isUuid, frenchZodMessage } from "@/lib/http";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { apiError } from "@/lib/api-error";

const schema = z.object({
  action: z.enum(["approve", "reject"]),
  // T-202 — pourcentage de commission fixé à l'approbation (%). Optionnel :
  // s'il est omis, le taux hôte reste NULL (hérite du global/propriété).
  commissionRate: z.number().min(0).max(100).optional(),
}).refine((d) => d.action !== "approve" || d.commissionRate === undefined || d.commissionRate >= 0, {
  message: "Commission invalide",
});

/**
 * PATCH /api/admin/hosts/[id] — admin uniquement (T-202).
 *
 * Approuve ou rejette un compte hôte. À l'approbation, l'admin peut fixer le
 * pourcentage de commission de cet hôte (`users.commissionRate`), qui prime sur
 * le taux global mais reste inférieur à un taux de propriété explicite.
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

    const body = await request.json();
    const data = schema.parse(body);

    const [target] = await db
      .select({ id: users.id, role: users.role, approvalStatus: users.approvalStatus })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!target) {
      return NextResponse.json({ error: await apiError("Hôte introuvable") }, { status: 404 });
    }
    if (target.role !== "host") {
      return NextResponse.json({ error: await apiError("Ce compte n'est pas un hôte") }, { status: 400 });
    }

    const isApprove = data.action === "approve";
    const [updated] = await db
      .update(users)
      .set({
        approvalStatus: isApprove ? "approved" : "rejected",
        // À l'approbation, si un taux est fourni on le fixe ; sinon on laisse
        // NULL (hérite du global). Au rejet on ne touche pas au taux.
        ...(isApprove && data.commissionRate !== undefined
          ? { commissionRate: data.commissionRate.toFixed(2) }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: isApprove ? AUDIT_ACTIONS.hostApprove : AUDIT_ACTIONS.hostReject,
      entityType: "user",
      entityId: id,
      metadata: { hostId: id, previousStatus: target.approvalStatus, newStatus: updated.approvalStatus, commissionRate: updated.commissionRate },
    });

    return NextResponse.json({ host: updated });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: await apiError(frenchZodMessage(error)) }, { status: 400 });
    }
    console.error("[admin/hosts] PATCH error:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}
