import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { bookings, users } from "@/db/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";
import { issueToken } from "@/lib/tokens";
import { templates } from "@/lib/mail";
import { deliverEmail, enqueueEmail } from "@/lib/email-outbox";
import { apiError } from "@/lib/api-error";
import { appBaseUrl } from "@/lib/app-url";
import { zodErrorResponse } from "@/lib/http";

const schema = z
  .object({
    bookingReference: z.string().trim().min(5, "Référence de réservation invalide").max(50),
    guestEmail: z.string().trim().email("Email invalide").max(255),
  })
  .strict();

/**
 * POST /api/auth/resend-guest-claim — T-275 (audit n°8, F5)
 *
 * Renvoie l'e-mail d'activation du claim invité quand le premier a été perdu
 * (spam) ou que sa fenêtre de 24 h est dépassée. Constat de l'audit : le
 * claim était un e-mail **unique** (eventKey idempotent) + jeton 24 h, le
 * compte invité est créé avec `passwordHash=null` (impossible de se
 * connecter), et `resend-verification` ne couvre que `email_verification`
 * pour un utilisateur **connecté** — l'échec du 1er e-mail était une impasse
 * sans support.
 *
 * Règles de sécurité (débat technique T-273/T-275) :
 *  - **double identification** : la référence ET l'e-mail exact du booking —
 *    la référence seule (8 caractères, dans l'e-mail) ne suffit pas ;
 *    l'e-mail seul ne suffit pas non plus (référence non devinable) ;
 *  - **réponse strictement générique** dans tous les cas de garde : aucune
 *    divergence de statut/message ne révèle l'existence d'une réservation
 *    (anti-énumération) ;
 *  - **rate-limit double** : 3/h par email (borne anti-spam de victimes) et
 *    10/h par IP (borne brute-force de références) ;
 *  - le renvoi **n'annule pas** le jeton en cours (pas de race « le lien
 *    dans la boîte mail ne marche plus ») — `consumeToken` reste atomique,
 *    le premier lien consommé l'emporte ;
 *  - **jamais de jeton dans la réponse** (il n'est que dans l'e-mail).
 *
 * Périmètre d'émission (4 gardes, une seule requête jointe) : réservation
 * `pending` + e-mail exact + compte non claimé (`passwordHash IS NULL`) +
 * compte non supprimé (`deletedAt IS NULL`).
 */
export async function POST(request: NextRequest) {
  try {
    const body = schema.parse(await request.json());
    const email = body.guestEmail.toLowerCase();
    const ip = ipFromRequest(request);

    // Borne brute-force (IP) d'abord, puis borne anti-spam de victimes
    // (email) — les deux avant toute lecture (pas de signal avant le 429).
    const ipLimit = rateLimit(`guest-claim-resend:ip:${ip}`, { limit: 10, windowMs: 60 * 60 * 1000 });
    if (!ipLimit.ok) {
      return NextResponse.json(
        { error: await apiError("Trop de tentatives, réessayez plus tard") },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } },
      );
    }
    const emailLimit = rateLimit(`guest-claim-resend:email:${email}`, { limit: 3, windowMs: 60 * 60 * 1000 });
    if (!emailLimit.ok) {
      return NextResponse.json(
        { error: await apiError("Trop de demandes, réessayez plus tard") },
        { status: 429, headers: { "Retry-After": String(emailLimit.retryAfter) } },
      );
    }

    // Une seule requête jointe (référence unique indexée) : booking + compte.
    const [match] = await db
      .select({ booking: bookings, user: users })
      .from(bookings)
      .innerJoin(users, eq(bookings.userId, users.id))
      .where(
        and(
          eq(bookings.bookingReference, body.bookingReference),
          sql`lower(${bookings.guestEmail}) = ${email}`,
        ),
      );

    // Garde d'émission : demande en attente + compte non claimé + non supprimé.
    // Dans tous les autres cas : même réponse générique, aucun e-mail —
    // l'absence de signal est la protection anti-énumération.
    const canResend =
      match?.booking.status === "pending" &&
      match.user.passwordHash === null &&
      match.user.deletedAt === null;

    if (canResend) {
      try {
        const { clear } = await issueToken(match.user.id, "guest_claim");
        const url = `${appBaseUrl()}/activer-compte?token=${encodeURIComponent(clear)}`;
        const mail = await templates.guestAccountClaim({
          firstName: match.booking.guestFirstName,
          bookingReference: match.booking.bookingReference,
          url,
          language: match.user.language ?? null,
        });
        // EventKey distinct de l'initiale (`guest-claim:<id>`, idempotente) :
        // plusieurs renvois sont possibles (pattern `:resend:<ts>` house).
        const eventKey = `guest-claim-resend:${match.booking.id}:${Date.now()}`;
        await enqueueEmail({ eventKey, to: match.booking.guestEmail, ...mail });
        await deliverEmail(eventKey);
      } catch (mailError) {
        // Best-effort : l'échec d'envoi ne renvoie pas de 5xx (l'état est
        // inchangé ; le voyageur peut réessayer dans la limite du rate-limit).
        console.error("[resend-guest-claim] mail failed:", mailError);
      }
    }

    return NextResponse.json({
      message: await apiError(
        "Si une demande de réservation est en attente pour cet email, un e-mail d'activation vient de lui être envoyé.",
      ),
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") },
        { status: 400 },
      );
    }
    if (error instanceof z.ZodError) return zodErrorResponse(error);
    console.error("resend-guest-claim error:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}
