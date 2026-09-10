import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users, sessions, properties } from "@/db/schema";
import { reactivateHostListings, suspendHostListings } from "@/lib/host-suspension";
import { invalidatePublicCatalog } from "@/lib/read-cache";
import { getCurrentUser } from "@/lib/auth";
import { isUuid, frenchZodMessage } from "@/lib/http";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { eq, inArray } from "drizzle-orm";
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

    // T-233 (audit n°3, F2) : la sanction doit avoir un effet sur le catalogue.
    // Tout passe dans une seule transaction — sans quoi un hôte pourrait rester
    // suspendu avec des annonces publiées (ou l'inverse) en cas d'erreur.
    const outcome = await db.transaction(async (tx) => {
      const [row] = await tx
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

      if (!row) return { row: null, listings: [] as string[] };

      // Cascade : un hôte suspendu ne peut plus rien publier ; ses annonces
      // actives passent en `suspended` et sont restaurées à la réactivation.
      const listings = suspended
        ? await suspendHostListings(tx, id)
        : await reactivateHostListings(tx, id);

      if (suspended) {
        await tx.delete(sessions).where(eq(sessions.userId, id));
      } else {
        // Une republication ne vaut que si l'hôte est approuvé (T-202) : sinon
        // les annonces repassent en `pending` et repartent en modération.
        const [account] = await tx
          .select({ approvalStatus: users.approvalStatus })
          .from(users)
          .where(eq(users.id, id))
          .limit(1);
        if (account && account.approvalStatus !== "approved" && listings.length > 0) {
          await tx
            .update(properties)
            .set({ status: "pending", updatedAt: new Date() })
            .where(inArray(properties.id, listings));
        }
      }

      return { row, listings };
    });

    const updated = outcome.row;
    if (!updated) return NextResponse.json({ error: await apiError("Introuvable") }, { status: 404 });

    // T-233 : le catalogue public est mis en cache 60 s — on le purge pour que
    // la sanction (ou la levée) soit visible immédiatement, sans attendre le TTL.
    if (outcome.listings.length > 0) {
      invalidatePublicCatalog(`suspend:${id}`);
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
      metadata: {
        targetEmail: updated.email,
        ...(reason ? { reason } : {}),
        // T-233 : trace explicite de l'effet sur le catalogue.
        listingsAffected: outcome.listings.length,
        listings: outcome.listings,
      },
    });

    return NextResponse.json({
      user: updated,
      // Additif : l'admin sait combien d'annonces ont suivi le mouvement.
      listingsAffected: outcome.listings.length,
    });
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
