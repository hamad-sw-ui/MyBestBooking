import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { eq } from "drizzle-orm";

const schema = z.object({
  action: z.enum(["approve", "reject", "suspend"]),
  reason: z.string().optional(),
});

/**
 * POST /api/properties/[id]/validate — admin uniquement.
 * approve → status='active' + validatedAt/By.
 * reject  → status='draft' (l'hôte peut re-soumettre).
 * suspend → status='suspended'.
 * (T-015)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Accès admin requis" }, { status: 403 });
    }

    const { id } = await params;
    const { action } = schema.parse(await request.json());

    const [prop] = await db.select().from(properties).where(eq(properties.id, id));
    if (!prop) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

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
      metadata: { previousStatus: prop.status, newStatus: updated.status },
    });

    return NextResponse.json({ property: updated });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Corps de requête invalide ou manquant (JSON attendu)" }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("property validate error:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
