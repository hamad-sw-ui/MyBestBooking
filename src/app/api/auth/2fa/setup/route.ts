import { NextResponse } from "next/server";
import speakeasy from "speakeasy";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

/**
 * POST /api/auth/2fa/setup (T-029)
 * Génère un secret TOTP + URI otpauth pour QR code côté client.
 * Le secret est stocké, `twoFactorEnabled` reste false jusqu'à la
 * vérification (POST /api/auth/2fa/verify).
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const secret = speakeasy.generateSecret({
    name: `MyBestBooking:${user.email}`,
    issuer: "MyBestBooking",
    length: 20,
  });

  await db
    .update(users)
    .set({ twoFactorSecret: secret.base32, twoFactorEnabled: false })
    .where(eq(users.id, user.id));

  return NextResponse.json({
    secret: secret.base32,
    otpauth: secret.otpauth_url,
  });
}
