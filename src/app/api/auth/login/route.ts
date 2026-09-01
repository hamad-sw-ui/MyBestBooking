import { NextRequest, NextResponse } from "next/server";
import speakeasy from "speakeasy";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword, createSession } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";
import { frenchZodMessage } from "@/lib/http";
import { apiError } from "@/lib/api-error";

const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Le mot de passe est requis"),
  rememberMe: z.boolean().optional(),
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
        { error: await apiError("Trop de tentatives, réessayez plus tard") },
        { status: 429, headers: { "Retry-After": String(retryAfter) } },
      );
    }

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email.toLowerCase()));

    if (!user || !user.passwordHash) {
      // BUG-024 (Session 11 quinquies) : mitigation timing attack.
      // Sans ce dummy verify, un attaquant peut distinguer un user
      // existant (bcrypt ~350ms) d'un user inconnu (~5ms) par simple
      // mesure du temps de réponse. On effectue un bcrypt bidon pour
      // que les deux chemins prennent un temps équivalent.
      // Hash bidon : bcrypt de "invalid" avec cost 12, généré une fois.
      await verifyPassword(
        data.password,
        "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6UPzP5nrIu"
      );
      return NextResponse.json(
        { error: await apiError("Email ou mot de passe incorrect") },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(data.password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: await apiError("Email ou mot de passe incorrect") },
        { status: 401 }
      );
    }

    // T-120 (E2) : `deletedAt` est le soft-delete utilisé par la suspension
    // admin **réversible**. Dire « supprimé » induisait l'utilisateur en
    // erreur (il croyait son compte détruit). Message neutre et exact.
    if (user.deletedAt) {
      return NextResponse.json(
        { error: await apiError("Ce compte est désactivé. Contactez le support pour le réactiver.") },
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
          { error: await apiError("Code 2FA requis"), twoFactorRequired: true },
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
          { error: await apiError("Code 2FA invalide"), twoFactorRequired: true },
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
    await createSession(user.id, data.rememberMe === true);

    return NextResponse.json({
      message: await apiError("Connexion réussie"),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: await apiError(frenchZodMessage(error)) },
        { status: 400 }
      );
    }
    console.error("Login error:", error);
    return NextResponse.json(
      { error: await apiError("Une erreur est survenue") },
      { status: 500 }
    );
  }
}
