import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, createSession } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";
import { issueToken } from "@/lib/tokens";
import { templates } from "@/lib/mail";
import { deliverEmail, enqueueEmail } from "@/lib/email-outbox";
import { assignReferralCode, resolveReferrerId } from "@/lib/referral";

const registerSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  role: z.enum(["customer", "host"]).optional().default("customer"),
  // T-151 : la langue choisie à l'inscription est persistée dès le départ,
  // pour que l'e-mail de vérification soit localisé pour le destinataire
  // (fr / en ; ar retombe sur fr comme le reste de l'interface).
  language: z.enum(["fr", "en", "ar"]).optional().default("fr"),
  // T-125 (P2) : code de parrainage optionnel (lien ?ref= ou saisie).
  // Un code absent/invalide ne bloque jamais l'inscription.
  referralCode: z.string().max(32).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // T-009 (BUG-009) : rate-limit inscription par IP (plus permissif
    // que login car pas de brute-force ciblé possible).
    const ip = ipFromRequest(request);
    const ipLimit = rateLimit(`register:ip:${ip}`, { limit: 10, windowMs: 60_000 });
    if (!ipLimit.ok) {
      return NextResponse.json(
        { error: "Trop de créations de compte, réessayez plus tard" },
        { status: 429, headers: { "Retry-After": String(ipLimit.retryAfter) } },
      );
    }

    const body = await request.json();
    const data = registerSchema.parse(body);

    // Check if user already exists
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email.toLowerCase()));

    if (existingUser.length > 0) {
      // T-136 (A2) : 409 Conflict — la ressource (compte sur cet email)
      // existe déjà. Les erreurs de validation restent en 400.
      return NextResponse.json(
        { error: "Un compte existe déjà avec cet email" },
        { status: 409 }
      );
    }

    // T-125 (P2) : résolution du parrain. Non bloquante : un code vide,
    // inconnu ou supprimé équivaut à « pas de parrain » et n'empêche pas
    // la création du compte.
    const referredBy = await resolveReferrerId(data.referralCode);

    // Hash password and create user
    const passwordHash = await hashPassword(data.password);

    const [newUser] = await db
      .insert(users)
      .values({
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        language: data.language,
        // T-008 (BUG-008) : par défaut, l'email n'est PAS vérifié.
        // L'utilisateur peut se connecter mais un flux de vérification
        // (envoi de mail avec lien signé) reste à implémenter — voir
        // KNOWN_LIMITATIONS.md. Le seed force `emailVerified: true`
        // pour les comptes de démo, ce qui est explicite et acceptable.
        emailVerified: false,
        referredBy,
      })
      .returning();

    // T-125 (P2) : chaque nouveau compte reçoit immédiatement son propre
    // code de parrainage (il était jusqu'ici généré au premier GET). Non
    // bloquant : en cas d'échec, la route GET le régénérera.
    await assignReferralCode(newUser.id).catch(() => null);

    // T-013 : envoi email de vérification (best-effort, ne bloque pas
    // la création du compte si SMTP tombe).
    try {
      const { clear } = await issueToken(newUser.id, "email_verification");
      const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const url = `${base}/api/auth/verify?token=${encodeURIComponent(clear)}`;
      const mail = await templates.emailVerification({ firstName: newUser.firstName, url, language: newUser.language });
      const eventKey = `email-verification:${newUser.id}`;
      await enqueueEmail({ eventKey, to: newUser.email, ...mail });
      await deliverEmail(eventKey);
    } catch (mailErr) {
      console.error("[register] verification mail failed:", mailErr);
    }

    // Create session
    await createSession(newUser.id);

    return NextResponse.json({
      message: "Inscription réussie",
      user: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        role: newUser.role,
        language: newUser.language,
      },
    });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Corps de requête invalide ou manquant (JSON attendu)" }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
