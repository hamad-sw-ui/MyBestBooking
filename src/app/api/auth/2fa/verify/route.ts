import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import speakeasy from "speakeasy";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { frenchZodMessage } from "@/lib/http";
import { eq } from "drizzle-orm";
import { apiError } from "@/lib/api-error";
import { generateBackupCodes, hashBackupCodes } from "@/lib/backup-codes";

const schema = z.object({ code: z.string().regex(/^\d{6}$/, "Code TOTP à 6 chiffres attendu") });

/** Promeut atomiquement le secret pending après validation du nouveau facteur. */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
    const { code } = schema.parse(await request.json());
    // T-231 (A11) : les codes de secours sont générés à l'activation (et à
    // chaque rotation) et **affichés une seule fois**. Seules leurs empreintes
    // bcrypt sont stockées : un code perdu ne peut pas être relu.
    const result = await db.transaction(async (tx) => {
      const [row] = await tx.select({ secret: users.twoFactorSecret, pending: users.twoFactorPendingSecret, enabled: users.twoFactorEnabled })
        .from(users).where(eq(users.id, user.id)).for("update");
      const candidate = row?.pending ?? (row?.enabled ? null : row?.secret);
      if (!candidate) return { state: "missing" as const, backupCodes: [] as string[] };
      const valid = speakeasy.totp.verify({ secret: candidate, encoding: "base32", token: code, window: 1 });
      if (!valid) return { state: "invalid" as const, backupCodes: [] as string[] };
      const backupCodes = generateBackupCodes();
      await tx.update(users).set({
        twoFactorSecret: candidate,
        twoFactorPendingSecret: null,
        twoFactorEnabled: true,
        twoFactorBackupCodes: await hashBackupCodes(backupCodes),
        updatedAt: new Date(),
      }).where(eq(users.id, user.id));
      return { state: "ok" as const, backupCodes };
    });
    if (result.state === "missing") return NextResponse.json({ error: await apiError("2FA non initialisée") }, { status: 400 });
    if (result.state === "invalid") return NextResponse.json({ error: await apiError("Code invalide") }, { status: 400 });
    return NextResponse.json({ enabled: true, backupCodes: result.backupCodes });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) return NextResponse.json({ error: await apiError(frenchZodMessage(error)) }, { status: 400 });
    console.error("[2fa/verify]", error);
    return NextResponse.json({ error: await apiError("Erreur") }, { status: 500 });
  }
}
