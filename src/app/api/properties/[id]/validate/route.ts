import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUuid, frenchZodMessage } from "@/lib/http";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { eq } from "drizzle-orm";
import { apiError } from "@/lib/api-error";
import { requireApprovedHost } from "@/lib/host-approval";

const schema = z.object({
  action: z.enum(["approve", "reject", "suspend"]),
  reason: z.string().optional(),
});

/**
 * POST /api/properties/[id]/validate — admin uniquement.
 * approve → status='active' + validatedAt/By. **Gate T-202** : le propriétaire
 *           doit être un hôte approuvé, sinon l'annonce ne peut pas être active.
 * reject  → status='draft' (l'hôte peut re-soumettre).
 * suspend → status='suspended'.
 * (T-015 + T-202)
 */
export async function POST(
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
    const { action, reason } = schema.parse(await request.json());

    const [prop] = await db.select().from(properties).where(eq(properties.id, id));
    if (!prop) return NextResponse.json({ error: await apiError("Introuvable") }, { status: 404 });

    // T-202 : un hébergement ne peut JAMAIS être publié (`active`) tant que son
    // hôte n'est pas approuvé par l'admin. On bloque l'approbation (pas le
    // rejet ni la suspension) avec un message explicite.
    if (action === "approve") {
      const gate = await requireApprovedHost(prop.hostId);
      if (!gate.ok) {
        const suffix =
          gate.messageKey === "host.pendingApproval"
            ? " La commission et la validation du compte hôte doivent être définies avant publication."
            : "";
        return NextResponse.json(
          { error: await apiError(gate.defaultMessage + suffix) },
          { status: 409 },
        );
      }
    }

    const updates: Partial<typeof properties.$inferInsert> = {};
    if (action === "approve") {
      updates.status = "active";
      updates.validatedAt = new Date();
      updates.validatedBy = user.id;
    } else if (action === "reject") {
      updates.status = "draft";
    } else if (action === "suspend") {
      updates.status = "suspended";
    }

    const [updated] = await db
      .update(properties)
      .set(updates)
      .where(eq(properties.id, id))
      .returning();

    // T-024 : audit log
    const auditAction =
      action === "approve"
        ? AUDIT_ACTIONS.propertyValidate
        : action === "reject"
          ? AUDIT_ACTIONS.propertyReject
          : AUDIT_ACTIONS.propertySuspend;
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: auditAction,
      entityType: "property",
      entityId: id,
      metadata: { previousStatus: prop.status, newStatus: updated.status, ...(reason ? { reason } : {}) },
    });

    return NextResponse.json({ property: updated });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: await apiError(frenchZodMessage(error)) }, { status: 400 });
    }
    console.error("property validate error:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}
