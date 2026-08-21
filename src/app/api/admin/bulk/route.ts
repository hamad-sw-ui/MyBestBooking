import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users, properties, reviews, bookings, sessions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";
import { eq, inArray, and, ne } from "drizzle-orm";
import { createHash } from "node:crypto";

/**
 * POST /api/admin/bulk (T-033, Session 12)
 *
 * Actions groupées pour les dashboards. Admin-only.
 *
 * Body :
 *   {
 *     entity: "users" | "properties" | "reviews" | "bookings",
 *     action: string,
 *     ids: string[]  // UUIDs, max 100 par batch
 *   }
 *
 * Actions supportées par entité :
 *   users     : suspend, reactivate, anonymize
 *   properties: approve, reject, suspend
 *   reviews   : approve, hide, reject
 *   bookings  : cancel
 *
 * Contrat de retour :
 *   {
 *     entity, action,
 *     requested: N,
 *     succeeded: N,
 *     skipped:   [{ id, reason }],
 *     failed:    [{ id, error }]
 *   }
 *
 * Sécurité :
 *   - Admin uniquement (403 sinon)
 *   - Max 100 IDs par appel
 *   - Un admin ne peut pas s'auto-suspendre/anonymize via bulk
 *   - Chaque item est traité en isolation (une erreur n'annule pas les autres)
 *   - Audit log : une entrée `bulk.action` avec metadata { entity, action, ids, results }
 */

const bulkSchema = z.object({
  entity: z.enum(["users", "properties", "reviews", "bookings"]),
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

async function bulkUsers(
  action: string,
  ids: string[],
  adminId: string,
): Promise<Result> {
  const r: Result = {
    entity: "users",
    action,
    requested: ids.length,
    succeeded: 0,
    skipped: [],
    failed: [],
  };
  const validActions = ["suspend", "reactivate", "anonymize"];
  if (!validActions.includes(action)) {
    throw new Error(`Action invalide pour users : ${action}`);
  }
  // Protection : ne jamais suspendre / anonymize l'admin lui-même
  const filtered = ids.filter((id) => {
    if (id === adminId) {
      r.skipped.push({ id, reason: "L'admin ne peut pas s'auto-modifier via bulk" });
      return false;
    }
    return true;
  });
  for (const id of filtered) {
    try {
      if (action === "suspend") {
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
      } else if (action === "reactivate") {
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
      } else if (action === "anonymize") {
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
  const r: Result = {
    entity: "properties",
    action,
    requested: ids.length,
    succeeded: 0,
    skipped: [],
    failed: [],
  };
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
  const r: Result = {
    entity: "reviews",
    action,
    requested: ids.length,
    succeeded: 0,
    skipped: [],
    failed: [],
  };
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
  const r: Result = {
    entity: "bookings",
    action,
    requested: ids.length,
    succeeded: 0,
    skipped: [],
    failed: [],
  };
  if (action !== "cancel") {
    throw new Error(`Action invalide pour bookings : ${action}`);
  }
  for (const id of ids) {
    try {
      // Machine à états (BUG-022) : seuls pending/confirmed peuvent être cancelled
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
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur bulk" },
      { status: 400 },
    );
  }

  // Audit
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
