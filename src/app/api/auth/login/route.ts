import { NextRequest, NextResponse } from "next/server";
import speakeasy from "speakeasy";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword, createSession } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";

const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Le mot de passe est requis"),
  // BUG-019 (Session 11 xtreme) : totpCode requis si user.twoFactorEnabled=true.
  // Si absent, la réponse renvoie 401 { twoFactorRequired: true }.
  totpCode: z.string().regex(/^\d{6}$/).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // T-009 (BUG-009) : rate-limit par IP + email (préviens le brute-force
    // ciblé sur un compte et le brute-force distribué sur beaucoup).
    const body = await request.json();
    const data = loginSchema.parse(body);

    const ip = ipFromRequest(request);
    const ipLimit = rateLimit(`login:ip:${ip}`, { limit: 20, windowMs: 60_000 });
    const emailLimit = rateLimit(
      `login:email:${data.email.toLowerCase()}`,
      { limit: 5, windowMs: 60_000 },
    );
    if (!ipLimit.ok || !emailLimit.ok) {
      const retryAfter = Math.max(ipLimit.retryAfter, emailLimit.retryAfter);
      return NextResponse.json(
        { error: "Trop de tentatives, réessayez plus tard" },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email.toLowerCase()));

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "Email ou mot de passe incorrect" },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(data.password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Email ou mot de passe incorrect" },
        { status: 401 }
      );
    }

    // Check if user is deleted
    if (user.deletedAt) {
      return NextResponse.json(
        { error: "Ce compte a été supprimé" },
        { status: 401 }
      );
    }

    // BUG-019 (Session 11 xtreme) : si 2FA activée, exiger totpCode.
    // Sans code fourni → 401 { twoFactorRequired: true } pour permettre
    // à l'UI d'afficher le champ TOTP.
    // Avec code invalide → 401 { error: "Code 2FA invalide" }.
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!data.totpCode) {
        return NextResponse.json(
          { error: "Code 2FA requis", twoFactorRequired: true },
          { status: 401 }
        );
      }
      const validTotp = speakeasy.totp.verify({
        secret: user.twoFactorSecret,
        encoding: "base32",
        token: data.totpCode,
        window: 1,
      });
      if (!validTotp) {
        return NextResponse.json(
          { error: "Code 2FA invalide", twoFactorRequired: true },
          { status: 401 }
        );
      }
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    // Create session
    await createSession(user.id);

    return NextResponse.json({
      message: "Connexion réussie",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
