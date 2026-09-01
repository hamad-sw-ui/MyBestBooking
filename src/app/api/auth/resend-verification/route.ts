import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";
import { issueToken } from "@/lib/tokens";
import { templates } from "@/lib/mail";
import { deliverEmail, enqueueEmail } from "@/lib/email-outbox";
import { apiError } from "@/lib/api-error";

/**
 * POST /api/auth/resend-verification (T-137, A3)
 *
 * Renvoie l'email de vérification à l'utilisateur connecté dont l'email
 * n'est pas encore vérifié.
 *
 * Constat d'audit : à l'inscription, le compte est créé avec
 * `emailVerified = false` et un premier email de vérification est envoyé
 * (T-013), mais il n'existait **aucun moyen de le renvoyer** : si le lien
 * expirait (24 h) ou si le premier email se perdait, l'utilisateur restait
 * « non vérifié » sans recours (la page `/verifier-email?ok=0` se contentait
 * de renvoyer vers /connexion). Cette route boucle le parcours.
 *
 * Choix sans régression :
 *  - authentification requise (le destinataire est l'utilisateur courant,
 *    jamais une adresse arbitraire → pas de vecteur d'abus/énumération) ;
 *  - rate-limit strict (5 / heure) pour borner l'envoi d'emails ;
 *  - réponse générique à succès si l'email est déjà vérifié (on ne révèle
 *    rien de supplémentaire et on n'envoie pas d'email inutile) ;
 *  - l'envoi reste best-effort : un échec SMTP ne fait pas échouer la
 *    requête (comme à l'inscription).
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
    }

    const rl = rateLimit(`verify-resend:user:${user.id}`, {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { error: await apiError("Trop de demandes, réessayez plus tard") },
        { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
      );
    }

    const [fresh] = await db
      .select({ emailVerified: users.emailVerified, email: users.email, firstName: users.firstName })
      .from(users)
      .where(eq(users.id, user.id));

    // Déjà vérifié : pas d'email à renvoyer. Succès générique (pas de fuite
    // d'état supplémentaire au-delà de ce que l'utilisateur sait de lui-même).
    if (fresh?.emailVerified) {
      return NextResponse.json({
        message: "Votre email est déjà vérifié.",
      });
    }

    try {
      const { clear } = await issueToken(user.id, "email_verification");
      const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const url = `${base}/api/auth/verify?token=${encodeURIComponent(clear)}`;
      const mail = await templates.emailVerification({
        firstName: fresh?.firstName ?? user.firstName ?? "",
        url,
        language: user.language ?? null,
      });
      // eventKey distinct de l'inscription pour autoriser plusieurs renvois.
      const eventKey = `email-verification-resend:${user.id}:${Date.now()}`;
      await enqueueEmail({ eventKey, to: fresh?.email ?? user.email, ...mail });
      await deliverEmail(eventKey);
    } catch (mailErr) {
      console.error("[resend-verification] mail failed:", mailErr);
      // Best-effort : on prévient l'utilisateur que l'envoi n'a pu aboutir.
      return NextResponse.json(
        { error: await apiError("L'envoi de l'email a échoué, réessayez plus tard") },
        { status: 502 },
      );
    }

    return NextResponse.json({
      message: "Un email de vérification vient de vous être envoyé.",
    });
  } catch (error) {
    console.error("resend-verification error:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}
