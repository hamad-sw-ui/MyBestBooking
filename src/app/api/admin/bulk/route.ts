import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  users,
  properties,
  reviews,
  bookings,
  sessions,
  rooms,
  promotions,
  wishlistItems,
  priceAlerts,
  ratePlans,
  roomAvailability,
  conversations,
  messages,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { eq, inArray, and, ne, or, sql, gte } from "drizzle-orm";
import { createHash } from "node:crypto";

/**
 * POST /api/admin/bulk (T-033, étendu T-034)
 *
 * Actions groupées pour les dashboards. Admin-only.
 *
 * Body :
 *   {
 *     entity: "users" | "properties" | "reviews" | "bookings"
 *            | "rooms" | "promotions",
 *     action: string,
 *     ids: string[]  // UUIDs, max 100 par batch
 *   }
 *
 * Actions supportées par entité :
 *   users     : suspend, reactivate, anonymize, delete (alias anonymize)
 *   properties: approve, reject, suspend, delete
 *   reviews   : approve, hide, reject, delete
 *   bookings  : cancel
 *   rooms     : activate, deactivate, delete  (T-034)
 *   promotions: activate, deactivate, delete  (T-034)
 *
 * Contrat de retour identique T-033 :
 *   { entity, action, requested, succeeded, skipped[], failed[] }
 */

const bulkSchema = z.object({
  entity: z.enum([
    "users",
    "properties",
    "reviews",
    "bookings",
    "rooms",
    "promotions",
  ]),
  action: z.string().min(1).max(50),
  ids: z.array(z.string().uuid()).min(1).max(100),
});

type Result = {
  entity: string;
  action: string;
  requested: number;
  succeeded: number;
  skipped: Array<{ id: string; reason: string }>;
  failed: Array<{ id: string; error: string }>;
};

function emptyResult(entity: string, action: string, requested: number): Result {
  return { entity, action, requested, succeeded: 0, skipped: [], failed: [] };
}

async function bulkUsers(
  action: string,
  ids: string[],
  adminId: string,
): Promise<Result> {
  const r = emptyResult("users", action, ids.length);
  const effective = action === "delete" ? "anonymize" : action;
  const validActions = ["suspend", "reactivate", "anonymize"];
  if (!validActions.includes(effective)) {
    throw new Error(`Action invalide pour users : ${action}`);
  }
  const filtered = ids.filter((id) => {
    if (id === adminId) {
      r.skipped.push({ id, reason: "L'admin ne peut pas s'auto-modifier via bulk" });
      return false;
    }
    return true;
  });
  for (const id of filtered) {
    try {
      if (effective === "suspend") {
        const [row] = await db
          .update(users)
          .set({ deletedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(users.id, id), ne(users.role, "admin")))
          .returning({ id: users.id });
        if (!row) {
          r.skipped.push({ id, reason: "user introuvable ou est admin" });
          continue;
        }
        await db.delete(sessions).where(eq(sessions.userId, id));
        r.succeeded++;
      } else if (effective === "reactivate") {
        const [row] = await db
          .update(users)
          .set({ deletedAt: null, updatedAt: new Date() })
          .where(eq(users.id, id))
          .returning({ id: users.id });
        if (!row) {
          r.skipped.push({ id, reason: "user introuvable" });
          continue;
        }
        r.succeeded++;
      } else if (effective === "anonymize") {
        const [existing] = await db
          .select({ email: users.email, role: users.role })
          .from(users)
          .where(eq(users.id, id));
        if (!existing) {
          r.skipped.push({ id, reason: "user introuvable" });
          continue;
        }
        if (existing.role === "admin") {
          r.skipped.push({ id, reason: "impossible d'anonymize un admin" });
          continue;
        }
        const emailHash = createHash("sha256")
          .update(existing.email)
          .digest("hex")
          .slice(0, 16);
        await db
          .update(users)
          .set({
            deletedAt: new Date(),
            updatedAt: new Date(),
            email: `deleted-${emailHash}@anonymized.local`,
            firstName: "Supprimé",
            lastName: "Compte",
            phone: null,
            avatarUrl: null,
            twoFactorSecret: null,
            twoFactorEnabled: false,
          })
          .where(eq(users.id, id));
        await db.delete(sessions).where(eq(sessions.userId, id));
        r.succeeded++;
      }
    } catch (err) {
      r.failed.push({
        id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return r;
}

async function bulkProperties(
  action: string,
  ids: string[],
  adminId: string,
): Promise<Result> {
  const r = emptyResult("properties", action, ids.length);
  if (action === "delete") {
    for (const id of ids) {
      try {
        // Refus si booking actif (pending/confirmed)
        const [act] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(bookings)
          .where(
            and(
              eq(bookings.propertyId, id),
              or(eq(bookings.status, "pending"), eq(bookings.status, "confirmed")),
            ),
          );
        if ((act?.count ?? 0) > 0) {
          r.skipped.push({
            id,
            reason: `${act.count} réservation(s) active(s) — impossible de supprimer`,
          });
          continue;
        }
        // Nettoyer les FK enfants avant hard delete
        const roomIds = (
          await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.propertyId, id))
        ).map((x) => x.id);
        if (roomIds.length) {
          await db.delete(roomAvailability).where(inArray(roomAvailability.roomId, roomIds));
          await db.delete(ratePlans).where(inArray(ratePlans.roomId, roomIds));
        }
        await db.delete(rooms).where(eq(rooms.propertyId, id));
        await db.delete(wishlistItems).where(eq(wishlistItems.propertyId, id));
        await db.delete(priceAlerts).where(eq(priceAlerts.propertyId, id));
        await db.delete(reviews).where(eq(reviews.propertyId, id));
        // Conversations & messages
        const convIds = (
          await db.select({ id: conversations.id })
            .from(conversations)
            .where(eq(conversations.propertyId, id))
        ).map((x) => x.id);
        if (convIds.length) {
          await db.delete(messages).where(inArray(messages.conversationId, convIds));
          await db.delete(conversations).where(inArray(conversations.id, convIds));
        }
        // Bookings terminaux (cancelled/completed/no_show) : on ne les supprime
        // pas — on les orphelinise avec propertyId conservé. Alternative :
        // supprimer aussi (perte d'historique). On garde l'historique.
        const [row] = await db
          .delete(properties)
          .where(eq(properties.id, id))
          .returning({ id: properties.id });
        if (!row) {
          r.skipped.push({ id, reason: "property introuvable" });
          continue;
        }
        r.succeeded++;
      } catch (err) {
        r.failed.push({
          id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return r;
  }
  const map: Record<string, string> = {
    approve: "active",
    reject: "draft",
    suspend: "suspended",
  };
  const targetStatus = map[action];
  if (!targetStatus) {
    throw new Error(`Action invalide pour properties : ${action}`);
  }
  for (const id of ids) {
    try {
      const updates: Record<string, unknown> = {
        status: targetStatus,
        updatedAt: new Date(),
      };
      if (action === "approve") {
        updates.validatedAt = new Date();
        updates.validatedBy = adminId;
      }
      const [row] = await db
        .update(properties)
        .set(updates)
        .where(eq(properties.id, id))
        .returning({ id: properties.id });
      if (!row) {
        r.skipped.push({ id, reason: "property introuvable" });
        continue;
      }
      r.succeeded++;
    } catch (err) {
      r.failed.push({
        id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return r;
}

async function bulkReviews(action: string, ids: string[]): Promise<Result> {
  const r = emptyResult("reviews", action, ids.length);
  if (action === "delete") {
    for (const id of ids) {
      try {
        const [row] = await db
          .delete(reviews)
          .where(eq(reviews.id, id))
          .returning({ id: reviews.id });
        if (!row) {
          r.skipped.push({ id, reason: "review introuvable" });
          continue;
        }
        r.succeeded++;
      } catch (err) {
        r.failed.push({
          id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return r;
  }
  const map: Record<string, string> = {
    approve: "approved",
    hide: "hidden",
    reject: "rejected",
    pending: "pending",
  };
  const targetStatus = map[action];
  if (!targetStatus) {
    throw new Error(`Action invalide pour reviews : ${action}`);
  }
  for (const id of ids) {
    try {
      const [row] = await db
        .update(reviews)
        .set({ status: targetStatus, updatedAt: new Date() })
        .where(eq(reviews.id, id))
        .returning({ id: reviews.id });
      if (!row) {
        r.skipped.push({ id, reason: "review introuvable" });
        continue;
      }
      r.succeeded++;
    } catch (err) {
      r.failed.push({
        id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return r;
}

async function bulkBookings(action: string, ids: string[]): Promise<Result> {
  const r = emptyResult("bookings", action, ids.length);
  if (action !== "cancel") {
    throw new Error(`Action invalide pour bookings : ${action}`);
  }
  for (const id of ids) {
    try {
      const [existing] = await db
        .select({ status: bookings.status })
        .from(bookings)
        .where(eq(bookings.id, id));
      if (!existing) {
        r.skipped.push({ id, reason: "booking introuvable" });
        continue;
      }
      if (existing.status !== "pending" && existing.status !== "confirmed") {
        r.skipped.push({
          id,
          reason: `transition invalide depuis '${existing.status}'`,
        });
        continue;
      }
      await db
        .update(bookings)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(bookings.id, id));
      r.succeeded++;
    } catch (err) {
      r.failed.push({
        id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return r;
}

async function bulkRooms(action: string, ids: string[]): Promise<Result> {
  const r = emptyResult("rooms", action, ids.length);
  const valid = ["activate", "deactivate", "delete"];
  if (!valid.includes(action)) {
    throw new Error(`Action invalide pour rooms : ${action}`);
  }
  if (action === "delete") {
    const today = new Date().toISOString().slice(0, 10);
    for (const id of ids) {
      try {
        // Refus si des bookings futurs (checkOut >= aujourd'hui) sur cette room
        const [act] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(bookings)
          .where(
            and(
              eq(bookings.roomId, id),
              gte(bookings.checkOut, today),
              or(eq(bookings.status, "pending"), eq(bookings.status, "confirmed")),
            ),
          );
        if ((act?.count ?? 0) > 0) {
          r.skipped.push({
            id,
            reason: `${act.count} réservation(s) future(s) — impossible de supprimer`,
          });
          continue;
        }
        // Nettoyer FK
        await db.delete(roomAvailability).where(eq(roomAvailability.roomId, id));
        await db.delete(ratePlans).where(eq(ratePlans.roomId, id));
        const [row] = await db
          .delete(rooms)
          .where(eq(rooms.id, id))
          .returning({ id: rooms.id });
        if (!row) {
          r.skipped.push({ id, reason: "room introuvable" });
          continue;
        }
        r.succeeded++;
      } catch (err) {
        r.failed.push({
          id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return r;
  }
  const isActive = action === "activate";
  for (const id of ids) {
    try {
      const [row] = await db
        .update(rooms)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(rooms.id, id))
        .returning({ id: rooms.id });
      if (!row) {
        r.skipped.push({ id, reason: "room introuvable" });
        continue;
      }
      r.succeeded++;
    } catch (err) {
      r.failed.push({
        id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return r;
}

async function bulkPromotions(action: string, ids: string[]): Promise<Result> {
  const r = emptyResult("promotions", action, ids.length);
  const valid = ["activate", "deactivate", "delete"];
  if (!valid.includes(action)) {
    throw new Error(`Action invalide pour promotions : ${action}`);
  }
  if (action === "delete") {
    for (const id of ids) {
      try {
        // Refus si déjà utilisée (garde l'historique)
        const [existing] = await db
          .select({ currentUses: promotions.currentUses })
          .from(promotions)
          .where(eq(promotions.id, id));
        if (!existing) {
          r.skipped.push({ id, reason: "promotion introuvable" });
          continue;
        }
        if ((existing.currentUses ?? 0) > 0) {
          r.skipped.push({
            id,
            reason: `promotion déjà utilisée (${existing.currentUses}× ) — désactivez plutôt`,
          });
          continue;
        }
        const [row] = await db
          .delete(promotions)
          .where(eq(promotions.id, id))
          .returning({ id: promotions.id });
        if (!row) {
          r.skipped.push({ id, reason: "promotion introuvable" });
          continue;
        }
        r.succeeded++;
      } catch (err) {
        r.failed.push({
          id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return r;
  }
  const isActive = action === "activate";
  for (const id of ids) {
    try {
      const [row] = await db
        .update(promotions)
        .set({ isActive })
        .where(eq(promotions.id, id))
        .returning({ id: promotions.id });
      if (!row) {
        r.skipped.push({ id, reason: "promotion introuvable" });
        continue;
      }
      r.succeeded++;
    } catch (err) {
      r.failed.push({
        id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return r;
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Accès admin requis" }, { status: 403 });
  }

  let data: z.infer<typeof bulkSchema>;
  try {
    data = bulkSchema.parse(await request.json());
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json(
        { error: e.issues[0]?.message ?? "Payload invalide" },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  let result: Result;
  try {
    switch (data.entity) {
      case "users":
        result = await bulkUsers(data.action, data.ids, user.id);
        break;
      case "properties":
        result = await bulkProperties(data.action, data.ids, user.id);
        break;
      case "reviews":
        result = await bulkReviews(data.action, data.ids);
        break;
      case "bookings":
        result = await bulkBookings(data.action, data.ids);
        break;
      case "rooms":
        result = await bulkRooms(data.action, data.ids);
        break;
      case "promotions":
        result = await bulkPromotions(data.action, data.ids);
        break;
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur bulk" },
      { status: 400 },
    );
  }

  await recordAudit({
    actorId: user.id,
    actorEmail: user.email,
    action: AUDIT_ACTIONS.bulkAction,
    entityType: data.entity,
    entityId: null,
    metadata: {
      operation: data.action,
      requested: result.requested,
      succeeded: result.succeeded,
      skipped: result.skipped.length,
      failed: result.failed.length,
      ids: data.ids,
    },
  });

  return NextResponse.json(result);
}
