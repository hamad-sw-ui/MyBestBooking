import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import speakeasy from "speakeasy";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

const schema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

/**
 * POST /api/auth/2fa/disable (T-029)
 * Désactive la 2FA après vérification d'un code TOTP valide.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    const { code } = schema.parse(await request.json());
    const [row] = await db
      .select({ secret: users.twoFactorSecret, enabled: users.twoFactorEnabled })
      .from(users)
      .where(eq(users.id, user.id));
    if (!row?.enabled || !row.secret) {
      return NextResponse.json({ error: "2FA non active" }, { status: 400 });
    }
    const ok = speakeasy.totp.verify({
      secret: row.secret,
      encoding: "base32",
      token: code,
      window: 1,
    });
    if (!ok) return NextResponse.json({ error: "Code invalide" }, { status: 400 });
    await db
      .update(users)
      .set({ twoFactorEnabled: false, twoFactorSecret: null })
      .where(eq(users.id, user.id));
    return NextResponse.json({ enabled: false });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0].message }, { status: 400 });
    }
    console.error("[2fa/disable]", e);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
