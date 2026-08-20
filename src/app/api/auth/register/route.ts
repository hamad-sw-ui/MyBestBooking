import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { hashPassword, createSession } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { rateLimit, ipFromRequest } from "@/lib/rate-limit";
import { issueToken } from "@/lib/tokens";
import { getMailer, templates } from "@/lib/mail";

const registerSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  firstName: z.string().min(2, "Le prénom doit contenir au moins 2 caractères"),
  lastName: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  role: z.enum(["customer", "host"]).optional().default("customer"),
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
      return NextResponse.json(
        { error: "Un compte existe déjà avec cet email" },
        { status: 400 }
      );
    }

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
        // T-008 (BUG-008) : par défaut, l'email n'est PAS vérifié.
        // L'utilisateur peut se connecter mais un flux de vérification
        // (envoi de mail avec lien signé) reste à implémenter — voir
        // KNOWN_LIMITATIONS.md. Le seed force `emailVerified: true`
        // pour les comptes de démo, ce qui est explicite et acceptable.
        emailVerified: false,
      })
      .returning();

    // T-013 : envoi email de vérification (best-effort, ne bloque pas
    // la création du compte si SMTP tombe).
    try {
      const { clear } = await issueToken(newUser.id, "email_verification");
      const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      const url = `${base}/api/auth/verify?token=${encodeURIComponent(clear)}`;
      const mail = await templates.emailVerification({ firstName: newUser.firstName, url });
      await getMailer().send({ to: newUser.email, ...mail });
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
      },
    });
  } catch (error) {
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
