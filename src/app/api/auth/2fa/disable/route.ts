import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import speakeasy from "speakeasy";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser, verifyPassword } from "@/lib/auth";
import { eq } from "drizzle-orm";

const schema = z.object({
  password: z.string().min(1, "Mot de passe requis"),
  code: z.string().regex(/^\d{6}$/, "Code TOTP à 6 chiffres attendu"),
});

/** Désactivation sensible : mot de passe courant + facteur TOTP actif. */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const { password, code } = schema.parse(await request.json());
    const [row] = await db.select({ secret: users.twoFactorSecret, enabled: users.twoFactorEnabled, passwordHash: users.passwordHash })
      .from(users).where(eq(users.id, user.id));
    if (!row?.enabled || !row.secret) return NextResponse.json({ error: "2FA non active" }, { status: 400 });
    if (!row.passwordHash || !await verifyPassword(password, row.passwordHash)) return NextResponse.json({ error: "Mot de passe incorrect" }, { status: 401 });
    const valid = speakeasy.totp.verify({ secret: row.secret, encoding: "base32", token: code, window: 1 });
    if (!valid) return NextResponse.json({ error: "Code invalide" }, { status: 400 });
    await db.update(users).set({ twoFactorEnabled: false, twoFactorSecret: null, twoFactorPendingSecret: null, updatedAt: new Date() }).where(eq(users.id, user.id));
    return NextResponse.json({ enabled: false });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Payload invalide" }, { status: 400 });
    console.error("[2fa/disable]", error);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
