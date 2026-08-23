import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { conversations, messages, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { getUploader } from "@/lib/storage";

/** Télécharge une pièce jointe privée après vérification du participant. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const { id } = await params;
  const [row] = await db
    .select({ message: messages, conversation: conversations, property: properties })
    .from(messages)
    .leftJoin(conversations, eq(messages.conversationId, conversations.id))
    .leftJoin(properties, eq(conversations.propertyId, properties.id))
    .where(eq(messages.id, id))
    .limit(1);
  if (!row?.message) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const isGuest = row.conversation?.userId === user.id;
  const isHost = row.property?.hostId === user.id;
  if (!isGuest && !isHost && user.role !== "admin") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  if (!row.message.attachmentKey) {
    // Message ancien : ne redirige pas vers son URL historique publique ; le
    // propriétaire peut demander une réimportation privée.
    return NextResponse.json({ error: "Pièce jointe historique indisponible de manière sécurisée" }, { status: 410 });
  }
  const file = await (await getUploader()).get(row.message.attachmentKey);
  if (!file) return NextResponse.json({ error: "Fichier introuvable" }, { status: 404 });
  return new NextResponse(new Uint8Array(file.body), {
    headers: {
      "Content-Type": row.message.attachmentMimeType ?? file.mimeType ?? "application/octet-stream",
      "Content-Disposition": "inline",
      "Cache-Control": "private, no-store",
    },
  });
}
