import type { Email, Mailer } from "./types";

/**
 * ResendMailer — envoie via l'API https://api.resend.com.
 * Activé automatiquement quand `RESEND_API_KEY` est défini.
 * Aucune dépendance npm (fetch natif Node 20+).
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
