import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword, createSession } from "@/lib/auth";
import { eq } from "drizzle-orm";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Email invalide"),
  password: z.string().min(1, "Le mot de passe est requis"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = loginSchema.parse(body);

    // Find user
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email.toLowerCase()));

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: "Email ou mot de passe incorrect" },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(data.password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Email ou mot de passe incorrect" },
        { status: 401 }
      );
    }

    // Check if user is deleted
    if (user.deletedAt) {
      return NextResponse.json(
        { error: "Ce compte a été supprimé" },
        { status: 401 }
      );
    }

    // Update last login
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, user.id));

    // Create session
    await createSession(user.id);

    return NextResponse.json({
      message: "Connexion réussie",
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 }
    );
  }
}
