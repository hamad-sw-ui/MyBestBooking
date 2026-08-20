import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/utils";
import { ScrollText } from "lucide-react";

/**
 * /dashboard/audit — Journal des actions admin (T-024).
 * Admin only. Liste chronologique paginée (50 dernières).
 */
export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, { label: string; variant: "success" | "warning" | "info" | "danger" | "default" }> = {
  "setting.update": { label: "Réglage modifié", variant: "info" },
  "review.moderate": { label: "Avis modéré", variant: "warning" },
  "user.suspend": { label: "Utilisateur suspendu", variant: "danger" },
  "user.reactivate": { label: "Utilisateur réactivé", variant: "success" },
  "property.validate": { label: "Property validée", variant: "success" },
  "property.reject": { label: "Property rejetée", variant: "warning" },
  "property.suspend": { label: "Property suspendue", variant: "danger" },
};

export default async function AuditPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }

  const entries = await db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.createdAt))
    .limit(100);

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          Journal d&apos;audit
        </h1>
        <p className="text-gray-600 mt-1">
          100 dernières actions admin sensibles (réglages, modérations,
          suspensions, validations).
        </p>
      </div>

      <Card padding="none">
        {entries.length === 0 ? (
          <EmptyState
            icon={<ScrollText className="w-8 h-8" />}
            title="Aucune entrée"
            description="Le journal se remplit dès qu'une action admin est effectuée."
            className="py-16"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                  <th className="px-6 py-4 font-medium">Date</th>
                  <th className="px-6 py-4 font-medium">Acteur</th>
                  <th className="px-6 py-4 font-medium">Action</th>
                  <th className="px-6 py-4 font-medium">Entité</th>
                  <th className="px-6 py-4 font-medium">Détails</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const info = ACTION_LABELS[e.action] ?? { label: e.action, variant: "default" as const };
                  return (
                    <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50 align-top">
                      <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                        {formatDate(e.createdAt, {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {e.actorEmail ?? <span className="text-gray-400 italic">système</span>}
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={info.variant}>{info.label}</Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {e.entityType && (
                          <>
                            <span className="text-xs uppercase tracking-wide text-gray-400">
                              {e.entityType}
                            </span>
                            <br />
                            <code className="text-xs">{e.entityId}</code>
                          </>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500 max-w-md">
                        {e.metadata ? (
                          <pre className="whitespace-pre-wrap break-all font-mono text-[10px] leading-tight">
                            {JSON.stringify(e.metadata, null, 2)}
                          </pre>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
