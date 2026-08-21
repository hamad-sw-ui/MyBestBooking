import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { desc } from "drizzle-orm";
import {
  AuditFilter,
  type AuditEntryRow,
} from "@/components/bulk/audit-filter";

/**
 * /dashboard/audit (refactoré T-034) — Server Component qui charge les
 * 100 dernières entrées puis délègue au <AuditFilter> client (recherche
 * + filtres action/entity + raccourcis clavier).
 */
export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }
  const rows = await db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(100);
  const mapped: AuditEntryRow[] = rows.map((e) => ({
    id: e.id,
    action: e.action,
    actorId: e.actorId,
    actorEmail: e.actorEmail,
    entityType: e.entityType,
    entityId: e.entityId,
    metadata:
      e.metadata && typeof e.metadata === "object"
        ? (e.metadata as Record<string, unknown>)
        : null,
    createdAt: e.createdAt.toISOString(),
  }));
  return <AuditFilter entries={mapped} />;
}
