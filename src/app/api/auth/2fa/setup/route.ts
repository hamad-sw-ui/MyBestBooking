import { NextRequest, NextResponse } from "next/server";
import speakeasy from "speakeasy";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser, verifyPassword } from "@/lib/auth";
import { frenchZodMessage } from "@/lib/http";
import { eq } from "drizzle-orm";
import { apiError } from "@/lib/api-error";

const schema = z.object({
  password: z.string().min(1, "Mot de passe requis"),
  /** Obligatoire quand un facteur actif est remplacé. */
  currentCode: z.string().regex(/^\d{6}$/).optional(),
});

/**
 * Génère un secret pending local. Une reprovision ne retire jamais le facteur
 * actif avant que le nouveau code soit vérifié; aucun QR/secret ne sort vers un
 * service tiers.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
    const data = schema.parse(await request.json());
    const [account] = await db.select({
      passwordHash: users.passwordHash,
      secret: users.twoFactorSecret,
      enabled: users.twoFactorEnabled,
    }).from(users).where(eq(users.id, user.id));
    if (!account?.passwordHash || !await verifyPassword(data.password, account.passwordHash)) {
      return NextResponse.json({ error: await apiError("Mot de passe incorrect") }, { status: 401 });
    }
    if (account.enabled) {
      if (!account.secret || !data.currentCode) return NextResponse.json({ error: await apiError("Code TOTP actif requis pour remplacer la 2FA") }, { status: 400 });
      const valid = speakeasy.totp.verify({ secret: account.secret, encoding: "base32", token: data.currentCode, window: 1 });
      if (!valid) return NextResponse.json({ error: await apiError("Code TOTP actif invalide") }, { status: 401 });
    }

    const secret = speakeasy.generateSecret({ name: `MyBestBooking:${user.email}`, issuer: "MyBestBooking", length: 20 });
    await db.update(users).set({ twoFactorPendingSecret: secret.base32, updatedAt: new Date() }).where(eq(users.id, user.id));
    return NextResponse.json({ secret: secret.base32 });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) return NextResponse.json({ error: await apiError(frenchZodMessage(error)) }, { status: 400 });
    console.error("[2fa/setup]", error);
    return NextResponse.json({ error: await apiError("Erreur") }, { status: 500 });
  }
}
