import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { consumeToken } from "@/lib/tokens";
import { getSetting } from "@/lib/settings";
import { templates } from "@/lib/mail";
import { enqueueEmail, deliverEmail } from "@/lib/email-outbox";
import { eq } from "drizzle-orm";

/**
 * GET /api/auth/verify?token=X
 * Marque emailVerified=true si le token est valide.
 * Redirige vers /verifier-email?ok=1 ou ?ok=0.
 * (T-013)
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const base = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  if (!token) {
    return NextResponse.redirect(new URL("/verifier-email?ok=0", base));
  }
  const userId = await consumeToken(token, "email_verification");
  if (!userId) {
    return NextResponse.redirect(new URL("/verifier-email?ok=0", base));
  }
  // On ne lit que l'état avant vérification : l'email de bienvenue ne doit
  // partir qu'une seule fois, lors de la transition emailVerified false→true.
  const [existing] = await db.select({ email: users.email, firstName: users.firstName, language: users.language, emailVerified: users.emailVerified }).from(users).where(eq(users.id, userId));
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, userId));

  if (existing && !existing.emailVerified) {
    // T-149 : e-mail de bienvenue (best-effort, jamais bloquant). Le
    // même eventKey rend l'envoi idempotent côté outbox.
    try {
      const notifications = await getSetting("notifications");
      if (notifications.welcomeEmail) {
        const mail = await templates.welcomeEmail({
          firstName: existing.firstName,
          url: `${base}/mes-reservations`,
          language: existing.language ?? null,
        });
        const eventKey = `welcome:${userId}`;
        await enqueueEmail({ eventKey, to: existing.email, ...mail });
        await deliverEmail(eventKey);
      }
    } catch (mailErr) {
      console.error("[verify] welcome mail failed:", mailErr);
    }
  }
  return NextResponse.redirect(new URL("/verifier-email?ok=1", base));
}
