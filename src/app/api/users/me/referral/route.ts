import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";

/**
 * Génère un code alphanumérique lisible (majuscules + chiffres, sans
 * ambiguïté 0/O/1/I). 8 caractères = ~40 bits.
 */
function generateReferralCode(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/**
 * GET /api/users/me/referral (T-026)
 * Retourne le code de parrainage courant, en génère un si absent.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const [row] = await db
    .select({ referralCode: users.referralCode })
    .from(users)
    .where(eq(users.id, user.id));
  if (row?.referralCode) return NextResponse.json({ code: row.referralCode });

  // Génère et persiste, retry si collision (extrêmement rare).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateReferralCode();
    try {
      await db.update(users).set({ referralCode: code }).where(eq(users.id, user.id));
      return NextResponse.json({ code });
    } catch {
      // collision → retry
    }
  }
  return NextResponse.json({ error: "Génération échouée" }, { status: 500 });
}
