import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { desc, eq, and, gte } from "drizzle-orm";
import { apiError } from "@/lib/api-error";

/**
 * GET /api/admin/audit — journal des actions admin (T-024).
 * Query params : ?action=review.moderate&limit=50&offset=0
 * Admin only. Rate-limit 60/min.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: await apiError("Accès admin requis") }, { status: 403 });
  }

  const rl = rateLimit(`admin:audit-read:${user.id}`, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: await apiError("Trop de requêtes") },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const sinceParam = searchParams.get("since"); // ISO date
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 200);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0", 10) || 0, 0);

    const conds = [];
    if (action) conds.push(eq(auditLog.action, action));
    if (sinceParam) {
      const d = new Date(sinceParam);
      if (!isNaN(d.getTime())) conds.push(gte(auditLog.createdAt, d));
    }

    const rows = await db
      .select()
      .from(auditLog)
      .where(conds.length > 0 ? and(...conds) : undefined)
      .orderBy(desc(auditLog.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({ entries: rows, limit, offset });
  } catch (error) {
    console.error("[admin/audit] GET error:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}
