import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";
import { consumeToken } from "@/lib/tokens";
import { createSession, hashPassword } from "@/lib/auth";

const schema = z.object({
  token: z.string().min(10),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  /** Claim invité : crée la première session après le mot de passe. */
  claimGuest: z.boolean().optional(),
});

/** Reset password historique ou revendication explicite d’un profil invité. */
export async function POST(request: NextRequest) {
  try {
    const ip = ipFromRequest(request);
    const rl = rateLimit(`reset:ip:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
    if (!rl.ok) return NextResponse.json({ error: "Trop de tentatives, réessayez plus tard" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });

    const { token, password, claimGuest } = schema.parse(await request.json());
    const userId = await consumeToken(token, claimGuest ? "guest_claim" : "password_reset");
    if (!userId) return NextResponse.json({ error: "Lien invalide ou expiré" }, { status: 400 });

    const passwordHash = await hashPassword(password);
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
    await db.delete(sessions).where(eq(sessions.userId, userId));
    if (claimGuest) {
      await createSession(userId);
      return NextResponse.json({ message: "Accès activé. Vos réservations sont disponibles." });
    }
    return NextResponse.json({ message: "Mot de passe réinitialisé. Vous pouvez vous connecter." });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Corps de requête invalide ou manquant (JSON attendu)" }, { status: 400 });
    }
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message ?? "Payload invalide" }, { status: 400 });
    console.error("reset-password error:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
