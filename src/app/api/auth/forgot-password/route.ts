import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";
import { issueToken } from "@/lib/tokens";
import { getMailer, templates } from "@/lib/mail";

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
        { message: "Si un compte existe pour cet email, un lien vous a été envoyé." },
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
        const mail = await templates.passwordReset({ firstName: user.firstName, url });
        await getMailer().send({ to: user.email, ...mail });
      } catch (e) {
        console.error("[forgot-password] mail send failed", e);
        // On ne le révèle pas au client.
      }
    }

    return NextResponse.json(
      { message: "Si un compte existe pour cet email, un lien vous a été envoyé." },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("forgot-password error:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
