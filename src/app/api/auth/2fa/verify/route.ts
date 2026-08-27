import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import speakeasy from "speakeasy";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

const schema = z.object({ code: z.string().regex(/^\d{6}$/, "Code TOTP à 6 chiffres attendu") });

/** Promeut atomiquement le secret pending après validation du nouveau facteur. */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const { code } = schema.parse(await request.json());
    const result = await db.transaction(async (tx) => {
      const [row] = await tx.select({ secret: users.twoFactorSecret, pending: users.twoFactorPendingSecret, enabled: users.twoFactorEnabled })
        .from(users).where(eq(users.id, user.id)).for("update");
      const candidate = row?.pending ?? (row?.enabled ? null : row?.secret);
      if (!candidate) return { state: "missing" as const };
      const valid = speakeasy.totp.verify({ secret: candidate, encoding: "base32", token: code, window: 1 });
      if (!valid) return { state: "invalid" as const };
      await tx.update(users).set({ twoFactorSecret: candidate, twoFactorPendingSecret: null, twoFactorEnabled: true, updatedAt: new Date() }).where(eq(users.id, user.id));
      return { state: "ok" as const };
    });
    if (result.state === "missing") return NextResponse.json({ error: "2FA non initialisée" }, { status: 400 });
    if (result.state === "invalid") return NextResponse.json({ error: "Code invalide" }, { status: 400 });
    return NextResponse.json({ enabled: true });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Corps de requête invalide ou manquant (JSON attendu)" }, { status: 400 });
    }
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Payload invalide" }, { status: 400 });
    console.error("[2fa/verify]", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
