import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";

const schema = z.object({
  firstName: z.string().min(2).max(100).optional(),
  lastName: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  country: z.string().length(2).optional().nullable(),
  language: z.string().max(5).optional(),
  currency: z.string().length(3).optional(),
  timezone: z.string().max(50).optional(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
  // T-030 : préférence user
  priceAlertEnabled: z.boolean().optional(),
});

/**
 * PATCH /api/users/me (T-016)
 * Édite le profil courant. Interdit : email, role, passwordHash,
 * bestrewardsLevel, walletBalance, emailVerified (gérés par flows dédiés).
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const data = schema.parse(await request.json());
    const [updated] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();

    return NextResponse.json({
      user: {
        id: updated.id,
        firstName: updated.firstName,
        lastName: updated.lastName,
        phone: updated.phone,
        country: updated.country,
        language: updated.language,
        currency: updated.currency,
        timezone: updated.timezone,
        avatarUrl: updated.avatarUrl,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("users/me PATCH error:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}

/**
 * DELETE /api/users/me (T-027)
 * Soft-delete du compte : deletedAt=now + révoque sessions + supprime
 * le cookie. Pas de hard-delete pour préserver la traçabilité
 * (bookings historiques, avis, etc.).
 * Un admin ne peut pas se supprimer via cet endpoint (il doit passer
 * par un autre admin).
 */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (user.role === "admin") {
    return NextResponse.json(
      { error: "Un admin ne peut pas se supprimer lui-même" },
      { status: 400 },
    );
  }
  await db
    .update(users)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, user.id));
  await db.delete(sessions).where(eq(sessions.userId, user.id));
  const jar = await cookies();
  jar.delete("session");
  return NextResponse.json({ deleted: true });
}
