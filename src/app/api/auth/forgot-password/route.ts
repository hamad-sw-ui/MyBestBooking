import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";
import { hashToken, issueToken } from "@/lib/tokens";
import { templates } from "@/lib/mail";
import { deliverEmail, enqueueEmail } from "@/lib/email-outbox";
import { frenchZodMessage } from "@/lib/http";
import { apiError } from "@/lib/api-error";

const schema = z.object({ email: z.string().email() });

/**
 * POST /api/auth/forgot-password
 * Retourne toujours 200 avec un message générique pour éviter
 * l'énumération de comptes. Envoie un email de reset si le compte
 * existe. (T-013)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = schema.parse(body);
    const normalized = email.toLowerCase();

    // Rate-limit par email pour freiner l'énumération temporelle.
    const rl = rateLimit(`forgot:email:${normalized}`, {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { message: await apiError("Si un compte existe pour cet email, un lien vous a été envoyé.") },
        { status: 200 },
      );
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, normalized))
      .limit(1);

    if (user && !user.deletedAt) {
      try {
        const { clear } = await issueToken(user.id, "password_reset");
        const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const url = `${base}/reinitialiser?token=${encodeURIComponent(clear)}`;
        const mail = await templates.passwordReset({ firstName: user.firstName, url, language: user.language });
        const eventKey = `password-reset:${user.id}:${hashToken(clear).slice(0, 24)}`;
        await enqueueEmail({ eventKey, to: user.email, ...mail });
        await deliverEmail(eventKey);
      } catch (e) {
        console.error("[forgot-password] mail send failed", e);
        // On ne le révèle pas au client.
      }
    }

    return NextResponse.json(
      { message: await apiError("Si un compte existe pour cet email, un lien vous a été envoyé.") },
      { status: 200 },
    );
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: await apiError(frenchZodMessage(error)) }, { status: 400 });
    }
    console.error("forgot-password error:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}
