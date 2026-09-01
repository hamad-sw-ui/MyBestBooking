import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { getCurrentUser, hashPassword, verifyPassword } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { and, eq, ne } from "drizzle-orm";
import { cookies } from "next/headers";
import { apiError } from "@/lib/api-error";

const schema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

/**
 * POST /api/auth/change-password (T-016)
 * Vérifie oldPassword, hash newPassword, révoque toutes les AUTRES
 * sessions actives (garde la courante pour ne pas déloguer l'utilisateur).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });

    const rl = rateLimit(`chpw:user:${user.id}`, {
      limit: 10,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: await apiError("Trop de tentatives, réessayez plus tard") },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
      );
    }

    const { oldPassword, newPassword } = schema.parse(await request.json());
    if (!user.passwordHash || !(await verifyPassword(oldPassword, user.passwordHash))) {
      return NextResponse.json(
        { error: "Ancien mot de passe incorrect" },
        { status: 400 },
      );
    }

    const newHash = await hashPassword(newPassword);
    await db.update(users).set({ passwordHash: newHash, updatedAt: new Date() }).where(eq(users.id, user.id));

    // Garde la session courante, révoque les autres.
    const cookieStore = await cookies();
    const currentToken = cookieStore.get("session")?.value ?? "";
    await db
      .delete(sessions)
      .where(and(eq(sessions.userId, user.id), ne(sessions.token, currentToken)));

    return NextResponse.json({ message: "Mot de passe modifié" });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: await apiError(error.issues[0].message) }, { status: 400 });
    }
    console.error("change-password error:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}
