import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";
import { consumeToken } from "@/lib/tokens";
import { hashPassword } from "@/lib/auth";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

/**
 * POST /api/auth/reset-password
 * Valide un token de reset password, hash le nouveau mdp, met à jour
 * users.passwordHash et supprime **toutes** les sessions de l'user.
 * (T-013)
 */
export async function POST(request: NextRequest) {
  try {
    const ip = ipFromRequest(request);
    const rl = rateLimit(`reset:ip:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
    if (!rl.ok) {
      return NextResponse.json(
        { error: "Trop de tentatives, réessayez plus tard" },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
      );
    }

    const body = await request.json();
    const { token, password } = schema.parse(body);

    const userId = await consumeToken(token, "password_reset");
    if (!userId) {
      return NextResponse.json(
        { error: "Lien invalide ou expiré" },
        { status: 400 },
      );
    }

    const passwordHash = await hashPassword(password);
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
    // Révoque toutes les sessions actives de l'utilisateur.
    await db.delete(sessions).where(eq(sessions.userId, userId));

    return NextResponse.json(
      { message: "Mot de passe réinitialisé. Vous pouvez vous connecter." },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("reset-password error:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
