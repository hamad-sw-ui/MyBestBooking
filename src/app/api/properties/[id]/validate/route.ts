import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { properties, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { isUuid, zodErrorResponse } from "@/lib/http";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { eq } from "drizzle-orm";
import { apiError } from "@/lib/api-error";
import { requireApprovedHost } from "@/lib/host-approval";
import { getSetting } from "@/lib/settings";
import { appBaseUrl } from "@/lib/app-url";
import { templates } from "@/lib/mail";
import { enqueueEmail } from "@/lib/email-outbox";

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
/**
 * T-237 — e-mail à l'hôte après une décision de validation.
 *
 * Silencieux si l'admin a coupé l'interrupteur correspondant
 * (`notifications.propertyApproved` / `notifications.propertyRejected`), et si
 * le statut n'a pas réellement changé (rejouer « reject » sur une annonce déjà
 * refusée ne spamme pas l'hôte : l'`eventKey` couvre la décision, le statut
 * identique coupe l'envoi).
 */
async function notifyHostOfDecision(input: {
  action: "approve" | "reject" | "suspend";
  property: typeof properties.$inferSelect;
  previousStatus: string | null;
  adminId: string;
}): Promise<void> {
  const { action, property, previousStatus, adminId } = input;
  try {
    const notifications = await getSetting("notifications");
    if (action === "approve" && !notifications.propertyApproved) return;
    if (action === "reject" && !notifications.propertyRejected) return;
    if (action === "suspend") return; // pas de gabarit : l'hôte garde son éditeur
    // Une décision qui ne change pas le statut n'ouvre pas de nouvel envoi.
    if (previousStatus === property.status) return;

    const [host] = await db
      .select({ email: users.email, firstName: users.firstName, language: users.language })
      .from(users)
      .where(eq(users.id, property.hostId))
      .limit(1);
    if (!host?.email) return;

    const url = `${appBaseUrl()}/dashboard/properties/${property.id}`;
    const mail = action === "approve"
      ? templates.propertyApproved({
          hostFirstName: host.firstName,
          propertyName: property.name,
          url,
          language: host.language ?? null,
        })
      : templates.propertyRejected({
          hostFirstName: host.firstName,
          propertyName: property.name,
          reason: property.reviewReason,
          url,
          language: host.language ?? null,
        });

    // Idempotence : une décision (admin + action + statut atteint) = un envoi.
    const eventKey = `property-decision:${property.id}:${action}:${property.status}:${adminId}`;
    await enqueueEmail({ eventKey, to: host.email, ...mail });
  } catch (mailError) {
    // La décision reste appliquée : l'outbox/le support peut reprendre l'envoi.
    console.error("[property.validate] notification hôte impossible :", mailError);
  }
}

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
      // T-237 : le motif ne survit pas à une mise en ligne.
      updates.reviewReason = null;
    } else if (action === "reject") {
      updates.status = "draft";
      // T-237 : le motif est désormais visible par l'hôte (éditeur + e-mail),
      // au lieu de rester dans `audit_log` seul.
      updates.reviewReason = reason?.trim() ? reason.trim().slice(0, 500) : null;
    } else if (action === "suspend") {
      updates.status = "suspended";
      updates.reviewReason = reason?.trim() ? reason.trim().slice(0, 500) : null;
    }

    const [updated] = await db
      .update(properties)
      .set(updates)
      .where(eq(properties.id, id))
      .returning();

    // T-237 (audit n°3, F6) : informer l'hôte de la décision, avec le motif.
    // Best-effort et idempotent (`eventKey` déterministe) : rejouer la même
    // décision ne renvoie pas un second e-mail.
    await notifyHostOfDecision({
      action,
      property: updated,
      previousStatus: prop.status,
      adminId: user.id,
    });

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
    if (error instanceof z.ZodError) return zodErrorResponse(error);
    console.error("property validate error:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}
