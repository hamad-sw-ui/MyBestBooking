import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import speakeasy from "speakeasy";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

const schema = z.object({
  code: z.string().regex(/^\d{6}$/, "Code TOTP à 6 chiffres attendu"),
});

/**
 * POST /api/auth/2fa/verify (T-029)
 * Vérifie un code TOTP. Si valide, active `twoFactorEnabled=true`.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const { code } = schema.parse(await request.json());
    const [row] = await db
      .select({ secret: users.twoFactorSecret })
      .from(users)
      .where(eq(users.id, user.id));
    if (!row?.secret) {
      return NextResponse.json({ error: "2FA non initialisée" }, { status: 400 });
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
      .set({ twoFactorEnabled: true })
      .where(eq(users.id, user.id));
    return NextResponse.json({ enabled: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.issues[0].message }, { status: 400 });
    }
    console.error("[2fa/verify]", e);
    return NextResponse.json({ error: "Erreur" }, { status: 500 });
  }
}
