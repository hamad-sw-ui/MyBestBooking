import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { desc } from "drizzle-orm";
import { AuditFilter } from "@/components/bulk/audit-filter";
import { toAuditEntryRow, type AuditEntryRow } from "@/lib/audit-rows";

/** Taille de page partagée avec le client (l'API accepte `limit` ≤ 200). */
const AUDIT_PAGE_SIZE = 100;

/**
 * /dashboard/audit (refactoré T-034, paginé T-217/P9) — Server Component qui
 * charge la **première page** du journal (100 entrées, même requête qu'avant)
 * puis délègue au <AuditFilter> client : recherche, filtres action/entity,
 * raccourcis clavier et « charger plus » branché sur `GET /api/admin/audit`
 * (pagination `limit`/`offset`), qui existait déjà sans appelant.
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
    .limit(AUDIT_PAGE_SIZE);
  const mapped: AuditEntryRow[] = rows.map(toAuditEntryRow);
  return <AuditFilter entries={mapped} pageSize={AUDIT_PAGE_SIZE} />;
}
