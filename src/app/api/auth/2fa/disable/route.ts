import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import speakeasy from "speakeasy";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser, verifyPassword } from "@/lib/auth";
import { frenchZodMessage } from "@/lib/http";
import { eq } from "drizzle-orm";
import { apiError } from "@/lib/api-error";

const schema = z.object({
  password: z.string().min(1, "Mot de passe requis"),
  code: z.string().regex(/^\d{6}$/, "Code TOTP à 6 chiffres attendu"),
});

/** Désactivation sensible : mot de passe courant + facteur TOTP actif. */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
    const { password, code } = schema.parse(await request.json());
    const [row] = await db.select({ secret: users.twoFactorSecret, enabled: users.twoFactorEnabled, passwordHash: users.passwordHash })
      .from(users).where(eq(users.id, user.id));
    if (!row?.enabled || !row.secret) return NextResponse.json({ error: await apiError("2FA non active") }, { status: 400 });
    if (!row.passwordHash || !await verifyPassword(password, row.passwordHash)) return NextResponse.json({ error: await apiError("Mot de passe incorrect") }, { status: 401 });
    const valid = speakeasy.totp.verify({ secret: row.secret, encoding: "base32", token: code, window: 1 });
    if (!valid) return NextResponse.json({ error: await apiError("Code invalide") }, { status: 400 });
    await db.update(users).set({ twoFactorEnabled: false, twoFactorSecret: null, twoFactorPendingSecret: null, updatedAt: new Date() }).where(eq(users.id, user.id));
    return NextResponse.json({ enabled: false });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) return NextResponse.json({ error: await apiError(frenchZodMessage(error)) }, { status: 400 });
    console.error("[2fa/disable]", error);
    return NextResponse.json({ error: await apiError("Erreur") }, { status: 500 });
  }
}
