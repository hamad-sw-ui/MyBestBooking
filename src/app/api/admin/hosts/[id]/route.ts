import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, properties } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { z } from "zod";
import { eq, and, isNull, inArray } from "drizzle-orm";
import { isUuid, zodErrorResponse } from "@/lib/http";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { apiError } from "@/lib/api-error";
import { getSetting } from "@/lib/settings";

/**
 * T-215 — schéma d'actions.
 *
 * `approve` / `reject` conservent **exactement** leur contrat T-202
 * (`commissionRate` optionnel à l'approbation) : aucune régression pour les
 * appelants existants, y compris les tests d'intégration live.
 *
 * `updateCommission` est une action **additive** : elle permet à l'admin de
 * changer le pourcentage de commission d'un hôte **déjà approuvé** (ou de le
 * remettre en héritage avec `null`), indépendamment de l'état d'approbation.
 */
const baseFields = {
  // Taux de commission de l'hôte (%) : 0–100, deux décimales.
  commissionRate: z.number().min(0).max(100),
  // Propagation optionnelle aux hébergements. Jamais implicite :
  //  - "inherited" : uniquement les hébergements sans taux explicite (NULL),
  //  - "listed"    : uniquement les `propertyIds` transmis.
  applyTo: z.enum(["inherited", "listed"]).optional(),
  propertyIds: z.array(z.string().uuid()).max(100).optional(),
};

const schema = z
  .discriminatedUnion("action", [
    z.object({
      action: z.literal("approve"),
      commissionRate: baseFields.commissionRate.optional(),
    }),
    z.object({
      action: z.literal("reject"),
    }),
    z.object({
      action: z.literal("updateCommission"),
      commissionRate: baseFields.commissionRate.nullable(),
      applyTo: baseFields.applyTo,
      propertyIds: baseFields.propertyIds,
    }),
  ])
  .refine(
    (d) => d.action !== "updateCommission" || d.applyTo !== "listed" || (d.propertyIds?.length ?? 0) > 0,
    { message: "Sélectionnez au moins un hébergement à mettre à jour" },
  );

/**
 * PATCH /api/admin/hosts/[id] — admin uniquement (T-202, étendu T-215).
 *
 * - `action: "approve" | "reject"` : approuve ou rejette un compte hôte.
 * - `action: "updateCommission"` : fixe (ou remet en héritage avec `null`) le
 *   pourcentage de commission `users.commissionRate`, qui prime sur le taux
 *   global mais reste inférieur à un taux de propriété explicite.
 *
 * `applyTo` propage **explicitement** le taux aux hébergements concernés :
 * sans `applyTo`, seule la ligne `users` est touchée. Aucune réservation
 * existante n'est jamais recalculée (montants figés à la vente, ADR-009).
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
      .select({
        id: users.id,
        role: users.role,
        approvalStatus: users.approvalStatus,
        commissionRate: users.commissionRate,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!target) {
      return NextResponse.json({ error: await apiError("Hôte introuvable") }, { status: 404 });
    }
    if (target.role !== "host") {
      return NextResponse.json({ error: await apiError("Ce compte n'est pas un hôte") }, { status: 400 });
    }

    // ── T-215 : édition du taux, indépendante de l'approbation ────────────
    if (data.action === "updateCommission") {
      const nextRate = data.commissionRate === null ? null : data.commissionRate.toFixed(2);
      const [updated] = await db
        .update(users)
        .set({ commissionRate: nextRate, updatedAt: new Date() })
        .where(eq(users.id, id))
        .returning();

      await recordAudit({
        actorId: user.id,
        actorEmail: user.email,
        action: AUDIT_ACTIONS.hostCommissionUpdate,
        entityType: "user",
        entityId: id,
        metadata: {
          hostId: id,
          previousRate: target.commissionRate,
          newRate: updated.commissionRate,
        },
      });

      // Propagation : uniquement si l'admin l'a demandée explicitement.
      let propertiesUpdated = 0;
      if (data.applyTo === "inherited") {
        const rows = await db
          .update(properties)
          .set({ commissionRate: nextRate })
          .where(and(eq(properties.hostId, id), isNull(properties.commissionRate)))
          .returning({ id: properties.id });
        propertiesUpdated = rows.length;
        for (const row of rows) {
          await recordAudit({
            actorId: user.id,
            actorEmail: user.email,
            action: AUDIT_ACTIONS.propertyCommissionUpdate,
            entityType: "property",
            entityId: row.id,
            metadata: { propertyId: row.id, newRate: nextRate, reason: "host.inherited" },
          });
        }
      } else if (data.applyTo === "listed") {
        const rows = await db
          .update(properties)
          .set({ commissionRate: nextRate })
          .where(and(eq(properties.hostId, id), inArray(properties.id, data.propertyIds ?? [])))
          .returning({ id: properties.id });
        propertiesUpdated = rows.length;
        for (const row of rows) {
          await recordAudit({
            actorId: user.id,
            actorEmail: user.email,
            action: AUDIT_ACTIONS.propertyCommissionUpdate,
            entityType: "property",
            entityId: row.id,
            metadata: { propertyId: row.id, newRate: nextRate, reason: "host.listed" },
          });
        }
      }

      return NextResponse.json({ host: updated, propertiesUpdated });
    }

    // ── T-202 : approbation / rejet (comportement inchangé) ───────────────
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
    if (error instanceof z.ZodError) return zodErrorResponse(error);
    console.error("[admin/hosts] PATCH error:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}

/**
 * GET /api/admin/hosts/[id] — admin uniquement (T-215).
 *
 * Renvoie l'état de commission d'un hôte **et l'impact réel** d'une
 * modification, en lecture seule (aucune écriture) :
 *  - `hostRate` : taux hôte (`null` = hérite),
 *  - `globalRate` : taux global `settings.billing.defaultCommissionRate`,
 *  - `effectiveRate` : taux appliqué aux hébergements qui héritent,
 *  - `inheritCount` / `explicitCount` : nombre d'hébergements qui hériteraient
 *    (`commission_rate IS NULL`) ou non d'un changement de taux hôte.
 */
export async function GET(
  _request: NextRequest,
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

    const [target] = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        approvalStatus: users.approvalStatus,
        commissionRate: users.commissionRate,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    if (!target) {
      return NextResponse.json({ error: await apiError("Hôte introuvable") }, { status: 404 });
    }
    if (target.role !== "host") {
      return NextResponse.json({ error: await apiError("Ce compte n'est pas un hôte") }, { status: 400 });
    }

    const propertiesOfHost = await db
      .select({ id: properties.id, name: properties.name, commissionRate: properties.commissionRate })
      .from(properties)
      .where(eq(properties.hostId, id));

    let globalRate = 15;
    try {
      const billing = await getSetting("billing");
      globalRate = Number(billing.defaultCommissionRate);
    } catch {
      globalRate = 15;
    }

    const hostRate = target.commissionRate === null ? null : Number(target.commissionRate);
    const inheritCount = propertiesOfHost.filter((p) => p.commissionRate === null).length;

    return NextResponse.json({
      host: {
        id: target.id,
        email: target.email,
        approvalStatus: target.approvalStatus,
        commissionRate: target.commissionRate,
      },
      globalRate,
      // Taux appliqué aux hébergements qui héritent : hôte s'il existe, sinon global.
      effectiveRate: hostRate ?? globalRate,
      inheritCount,
      explicitCount: propertiesOfHost.length - inheritCount,
      propertyCount: propertiesOfHost.length,
      properties: propertiesOfHost.map((p) => ({
        id: p.id,
        name: p.name,
        commissionRate: p.commissionRate,
        // Taux réellement appliqué aujourd'hui (propriété > hôte > global).
        effectiveRate: p.commissionRate === null ? hostRate ?? globalRate : Number(p.commissionRate),
      })),
    });
  } catch (error) {
    console.error("[admin/hosts/[id]] GET error:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}
