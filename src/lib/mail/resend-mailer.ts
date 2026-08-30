import type { Email, Mailer } from "./types";

/**
 * ResendMailer — envoie via l'API https://api.resend.com.
 * `Idempotency-Key` évite le doublon si le worker a été interrompu après
 * l'acceptation par Resend mais avant la mise à jour de l'outbox.
 */
export class ResendMailer implements Mailer {
  constructor(
    private apiKey: string,
    private from: string = process.env.MAIL_FROM ?? "MyBestBooking <no-reply@mybestbooking.example>",
  ) {}

  async send(email: Email): Promise<{ id: string }> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(email.idempotencyKey ? { "Idempotency-Key": email.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: this.from,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Resend send failed: HTTP ${res.status} ${detail.slice(0, 200)}`);
    }
    const data = (await res.json()) as { id?: string };
    return { id: data.id ?? "unknown" };
  }
}
