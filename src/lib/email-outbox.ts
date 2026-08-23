import { and, eq, lt, or, sql } from "drizzle-orm";
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
const MAX_ATTEMPTS = 8;
const LEASE_MS = 5 * 60 * 1000;

export async function enqueueEmail(email: OutboxEmail): Promise<void> {
  await db.insert(emailOutbox).values(email).onConflictDoNothing({ target: emailOutbox.eventKey });
}

/**
 * Claim à durée limitée : un crash ne laisse pas un email bloqué en sending.
 * Le second niveau d'idempotence est transmis au mailer : la reprise après un
 * timeout post-acceptation ne doit pas créer un second effet fournisseur.
 */
export async function deliverEmail(eventKey: string): Promise<boolean> {
  const staleBefore = new Date(Date.now() - LEASE_MS);
  const [claimed] = await db
    .update(emailOutbox)
    .set({ status: "sending", attempts: sql`${emailOutbox.attempts} + 1`, claimedAt: new Date(), updatedAt: new Date() })
    .where(and(
      eq(emailOutbox.eventKey, eventKey),
      sql`${emailOutbox.attempts} < ${MAX_ATTEMPTS}`,
      or(eq(emailOutbox.status, "pending"), and(eq(emailOutbox.status, "sending"), lt(emailOutbox.claimedAt, staleBefore))),
    ))
    .returning();
  if (!claimed) return false;
  try {
    const delivery = await (await getMailer()).send({
      to: claimed.to,
      subject: claimed.subject,
      html: claimed.html,
      text: claimed.text,
      idempotencyKey: claimed.eventKey,
    });
    await db.update(emailOutbox).set({
      status: "sent",
      sentAt: new Date(),
      claimedAt: null,
      providerMessageId: delivery.id.slice(0, 255),
      lastError: null,
      updatedAt: new Date(),
    }).where(eq(emailOutbox.id, claimed.id));
    return true;
  } catch (error) {
    const attempts = (claimed.attempts ?? 0);
    await db.update(emailOutbox).set({
      status: attempts >= MAX_ATTEMPTS ? "failed" : "pending",
      failedAt: attempts >= MAX_ATTEMPTS ? new Date() : null,
      claimedAt: null,
      lastError: error instanceof Error ? error.message.slice(0, 500) : "Erreur provider",
      updatedAt: new Date(),
    }).where(eq(emailOutbox.id, claimed.id));
    return false;
  }
}

export async function deliverPendingEmails(limit = 20): Promise<{ sent: number; pending: number }> {
  const staleBefore = new Date(Date.now() - LEASE_MS);
  const pending = await db
    .select({ eventKey: emailOutbox.eventKey })
    .from(emailOutbox)
    .where(and(sql`${emailOutbox.attempts} < ${MAX_ATTEMPTS}`, or(eq(emailOutbox.status, "pending"), and(eq(emailOutbox.status, "sending"), lt(emailOutbox.claimedAt, staleBefore)))))
    .limit(limit);
  let sent = 0;
  for (const item of pending) if (await deliverEmail(item.eventKey)) sent += 1;
  return { sent, pending: pending.length - sent };
}
