/**
 * T-217 (P9) — projection d'une ligne `audit_log` vers la forme consommée par
 * `/dashboard/audit`.
 *
 * Le serveur (RSC) et le client (chargement paginé via `GET /api/admin/audit`)
 * doivent produire **exactement** la même forme : la fonction est donc
 * partagée et pure, et ne dépend d'aucun module serveur (importable par un
 * composant client).
 */
export interface AuditEntryRow {
  id: string;
  action: string;
  actorId: string | null;
  actorEmail: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/** Entrée brute (drizzle côté serveur, JSON côté API). */
export interface AuditEntryInput {
  id: string;
  action: string;
  actorId: string | null;
  actorEmail: string | null;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
  createdAt: string | Date;
}

export function toAuditEntryRow(entry: AuditEntryInput): AuditEntryRow {
  return {
    id: entry.id,
    action: entry.action,
    actorId: entry.actorId,
    actorEmail: entry.actorEmail,
    entityType: entry.entityType,
    entityId: entry.entityId,
    metadata:
      entry.metadata && typeof entry.metadata === "object"
        ? (entry.metadata as Record<string, unknown>)
        : null,
    createdAt:
      entry.createdAt instanceof Date
        ? entry.createdAt.toISOString()
        : new Date(entry.createdAt).toISOString(),
  };
}
