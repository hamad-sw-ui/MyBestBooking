import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { emailOutbox } from "@/db/schema";
import { getMailer } from "@/lib/mail";

export interface OutboxEmail {
  eventKey: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

export async function enqueueEmail(email: OutboxEmail): Promise<void> {
  await db.insert(emailOutbox).values(email).onConflictDoNothing({ target: emailOutbox.eventKey });
}

/** Tente un envoi sans dupliquer un event déjà claimed/sent. */
export async function deliverEmail(eventKey: string): Promise<boolean> {
  const [claimed] = await db
    .update(emailOutbox)
    .set({ status: "sending", attempts: sql`${emailOutbox.attempts} + 1`, updatedAt: new Date() })
    .where(and(eq(emailOutbox.eventKey, eventKey), eq(emailOutbox.status, "pending")))
    .returning();
  if (!claimed) return false;
  try {
    await (await getMailer()).send({ to: claimed.to, subject: claimed.subject, html: claimed.html, text: claimed.text });
    await db.update(emailOutbox).set({ status: "sent", sentAt: new Date(), lastError: null, updatedAt: new Date() }).where(eq(emailOutbox.id, claimed.id));
    return true;
  } catch (error) {
    await db.update(emailOutbox).set({ status: "pending", lastError: error instanceof Error ? error.message.slice(0, 500) : "Erreur provider", updatedAt: new Date() }).where(eq(emailOutbox.id, claimed.id));
    return false;
  }
}

export async function deliverPendingEmails(limit = 20): Promise<{ sent: number; pending: number }> {
  const pending = await db.select({ eventKey: emailOutbox.eventKey }).from(emailOutbox).where(eq(emailOutbox.status, "pending")).limit(limit);
  let sent = 0;
  for (const item of pending) if (await deliverEmail(item.eventKey)) sent += 1;
  return { sent, pending: pending.length - sent };
}
