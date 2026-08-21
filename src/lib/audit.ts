/**
 * T-024 — Audit log global.
 *
 * `recordAudit()` insère une ligne dans `audit_log`. **Best-effort** :
 * ne throw jamais, log stderr en cas d'échec. Les callers l'appellent
 * après la mutation métier réussie (sinon on trace une action qui
 * n'a pas eu lieu).
 */

import { db } from "@/db";
import { auditLog } from "@/db/schema";

export interface AuditEntry {
  actorId: string | null;
  actorEmail?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.insert(auditLog).values({
      actorId: entry.actorId,
      actorEmail: entry.actorEmail ?? null,
      action: entry.action,
      entityType: entry.entityType ?? null,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata ?? null,
    });
  } catch (err) {
    console.error("[audit] insert failed", {
      action: entry.action,
      entity: `${entry.entityType ?? "?"}:${entry.entityId ?? "?"}`,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Actions typées (whitelist) — utilisée par les callers pour éviter
 * les typos.
 */
export const AUDIT_ACTIONS = {
  settingUpdate: "setting.update",
  reviewModerate: "review.moderate",
  userSuspend: "user.suspend",
  userReactivate: "user.reactivate",
  propertyValidate: "property.validate",
  propertyReject: "property.reject",
  propertySuspend: "property.suspend",
  // T-033 (Session 12) — actions groupées
  bulkAction: "bulk.action",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
