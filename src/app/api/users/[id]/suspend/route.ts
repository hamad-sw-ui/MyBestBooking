import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { users, sessions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

const schema = z.object({
  suspended: z.boolean(),
  reason: z.string().max(500).optional(),
});

/**
 * PATCH /api/users/[id]/suspend (T-016) — admin only.
 * suspended:true → deletedAt=now + supprime sessions actives
 * suspended:false → deletedAt=null (réactivation)
 * Ne peut pas se suspendre soi-même.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ error: "Accès admin requis" }, { status: 403 });
    }

    const { id } = await params;
    if (id === user.id) {
      return NextResponse.json(
        { error: "Vous ne pouvez pas vous suspendre vous-même" },
        { status: 400 },
      );
    }

    const { suspended } = schema.parse(await request.json());
    const [updated] = await db
      .update(users)
      .set({
        deletedAt: suspended ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning({ id: users.id, email: users.email, deletedAt: users.deletedAt });

    if (!updated) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

    if (suspended) {
      await db.delete(sessions).where(eq(sessions.userId, id));
    }

    return NextResponse.json({ user: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("suspend user error:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
