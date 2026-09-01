import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { conversations, messages, properties, uploadObjects, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { frenchZodMessage } from "@/lib/http";
import { and, eq, sql } from "drizzle-orm";
import { templates } from "@/lib/mail";
import { deliverEmail, enqueueEmail } from "@/lib/email-outbox";
import { rateLimit } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-error";

const schema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1).max(4000),
  // attachmentUrl est réservé aux messages historiques ; les nouveaux
  // fichiers privés sont référencés par key et servis après contrôle participant.
  attachmentKey: z.string().regex(/^uploads\/[A-Za-z0-9._-]+$/).optional(),
  attachmentMimeType: z.string().max(100).optional(),
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
  if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });

  const conversationId = request.nextUrl.searchParams.get("conversationId");
  if (!conversationId) {
    return NextResponse.json({ error: await apiError("conversationId requis") }, { status: 400 });
  }
  const ok = await checkParticipant(user.id, conversationId);
  if (!ok) return NextResponse.json({ error: await apiError("Accès refusé") }, { status: 403 });

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
    if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });

    const data = schema.parse(await request.json());
    const rl = rateLimit(`messages:user:${user.id}`, { limit: 60, windowMs: 60 * 60 * 1000 });
    if (!rl.ok) return NextResponse.json({ error: await apiError("Trop de messages, réessayez plus tard") }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
    const ok = await checkParticipant(user.id, data.conversationId);
    if (!ok) return NextResponse.json({ error: await apiError("Accès refusé") }, { status: 403 });

    // T-144 (audit n°20) : un message d'espaces sans pièce jointe est un
    // message vide (l'UI envoie "(pièce jointe)" quand il n'y a que le
    // fichier). On normalise et on exige un contenu OU une pièce jointe.
    const trimmedContent = data.content.trim();
    if (!trimmedContent && !data.attachmentKey) {
      return NextResponse.json({ error: await apiError("Le message ne peut pas être vide") }, { status: 400 });
    }

    const senderType = ok.isGuest ? "user" : "host";
    if (data.attachmentKey && !data.attachmentKey.startsWith(`uploads/${user.id.slice(0, 8)}-`)) {
      return NextResponse.json({ error: await apiError("Pièce jointe non autorisée") }, { status: 403 });
    }

    const msg = await db.transaction(async (tx) => {
      let attachmentMimeType: string | null = null;
      if (data.attachmentKey) {
        const [upload] = await tx.select().from(uploadObjects).where(and(eq(uploadObjects.key, data.attachmentKey), eq(uploadObjects.ownerId, user.id))).for("update");
        if (!upload || upload.attachedAt) throw new Error("ATTACHMENT_UNAVAILABLE");
        // Le MIME est une propriété de l’objet uploadé, jamais du navigateur.
        attachmentMimeType = upload.mimeType;
      }
      const [created] = await tx
        .insert(messages)
        .values({
          conversationId: data.conversationId,
          senderId: user.id,
          senderType,
          content: trimmedContent || "(pièce jointe)",
          attachmentKey: data.attachmentKey ?? null,
          attachmentMimeType,
        })
        .returning();
      if (data.attachmentKey) {
        await tx.update(uploadObjects).set({ attachedAt: new Date(), messageId: created.id }).where(eq(uploadObjects.key, data.attachmentKey));
      }
      return created;
    });

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

    // T-027 : notification email au destinataire (best-effort).
    try {
      const senderName = `${user.firstName} ${user.lastName}`.trim() || "MyBestBooking";
      const [convWithProperty] = await db
        .select({
          hostId: properties.hostId,
          userId: conversations.userId,
        })
        .from(conversations)
        .leftJoin(properties, eq(conversations.propertyId, properties.id))
        .where(eq(conversations.id, data.conversationId))
        .limit(1);
      if (convWithProperty) {
        const recipientId = ok.isGuest ? convWithProperty.hostId : convWithProperty.userId;
        if (recipientId && recipientId !== user.id) {
          const [recipient] = await db
            .select({ email: users.email, firstName: users.firstName, language: users.language })
            .from(users)
            .where(eq(users.id, recipientId))
            .limit(1);
          if (recipient?.email) {
            // T-150 : bouton direct vers LA conversation, dans la bonne
            // section selon le rôle du destinataire (hôte → dashboard).
            const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
            const conversationUrl = ok.isGuest
              ? `${appUrl}/dashboard/messages/${data.conversationId}`
              : `${appUrl}/messages/${data.conversationId}`;
            const mail = await templates.newMessage({
              firstName: recipient.firstName ?? "",
              senderName,
              url: conversationUrl,
              language: recipient.language ?? null,
            });
            const eventKey = `message:${msg.id}:${recipientId}`;
            await enqueueEmail({ eventKey, to: recipient.email, ...mail });
            await deliverEmail(eventKey);
          }
        }
      }
    } catch (mailErr) {
      console.error("[messages POST] notification mail failed:", mailErr);
    }

    return NextResponse.json({ message: msg }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "ATTACHMENT_UNAVAILABLE") {
      return NextResponse.json({ error: await apiError("Pièce jointe introuvable ou déjà utilisée") }, { status: 400 });
    }
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: await apiError(frenchZodMessage(error)) }, { status: 400 });
    }
    console.error("messages POST error:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}
