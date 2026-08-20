import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { conversations, messages, properties } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { and, eq, sql } from "drizzle-orm";

const schema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1).max(4000),
  attachmentUrl: z.string().url().optional(),
});

/**
 * GET /api/messages?conversationId= — liste les messages d'une
 * conversation dont l'utilisateur est participant.
 * POST /api/messages — envoie un message (voyageur → hôte ou inverse).
 * Met à jour lastMessageAt + unread counters.
 * (T-015)
 */

async function checkParticipant(userId: string, conversationId: string) {
  const [row] = await db
    .select({ conversation: conversations, property: properties })
    .from(conversations)
    .leftJoin(properties, eq(conversations.propertyId, properties.id))
    .where(eq(conversations.id, conversationId))
    .limit(1);
  if (!row) return null;
  const isGuest = row.conversation.userId === userId;
  const isHost = row.property?.hostId === userId;
  if (!isGuest && !isHost) return null;
  return { conversation: row.conversation, isGuest, isHost };
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const conversationId = request.nextUrl.searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json({ error: "conversationId requis" }, { status: 400 });
  }
  const ok = await checkParticipant(user.id, conversationId);
  if (!ok) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const list = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);

  // Marque lu du côté de l'utilisateur courant
  await db
    .update(conversations)
    .set(ok.isGuest ? { unreadByUser: 0 } : { unreadByHost: 0 })
    .where(eq(conversations.id, conversationId));

  return NextResponse.json({ messages: list });
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const data = schema.parse(await request.json());
    const ok = await checkParticipant(user.id, data.conversationId);
    if (!ok) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

    const senderType = ok.isGuest ? "user" : "host";

    const [msg] = await db
      .insert(messages)
      .values({
        conversationId: data.conversationId,
        senderId: user.id,
        senderType,
        content: data.content,
        attachmentUrl: data.attachmentUrl ?? null,
      })
      .returning();

    // Incrémente unread côté destinataire, met à jour lastMessageAt.
    await db
      .update(conversations)
      .set({
        lastMessageAt: new Date(),
        ...(ok.isGuest
          ? { unreadByHost: sql`${conversations.unreadByHost} + 1` }
          : { unreadByUser: sql`${conversations.unreadByUser} + 1` }),
      })
      .where(eq(conversations.id, data.conversationId));

    return NextResponse.json({ message: msg }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0].message }, { status: 400 });
    }
    console.error("messages POST error:", error);
    return NextResponse.json({ error: "Une erreur est survenue" }, { status: 500 });
  }
}
