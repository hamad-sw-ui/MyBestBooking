import nodemailer from "nodemailer";
import type { Email, Mailer } from "./types";

/**
 * SMTP générique (Gmail : smtp.gmail.com:587 + mot de passe d'application).
 * Permet d'envoyer vers n'importe quel destinataire sans domaine payant.
 */
export class SmtpMailer implements Mailer {
  constructor(
    private host: string,
    private port: number,
    private user: string,
    private pass: string,
    private from: string,
  ) {}

  async send(email: Email): Promise<{ id: string }> {
    const transporter = nodemailer.createTransport({
      host: this.host,
      port: this.port,
      secure: this.port === 465,
      auth: { user: this.user, pass: this.pass },
    });
    const info = await transporter.sendMail({
      from: this.from,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
    return { id: String(info.messageId ?? "smtp") };
  }
}

export function smtpFromEnv(): SmtpMailer | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) return null;
  const port = Number(process.env.SMTP_PORT ?? "587") || 587;
  const from =
    process.env.MAIL_FROM?.trim() ||
    `MyBestBooking <${user}>`;
  return new SmtpMailer(host, port, user, pass, from);
}
