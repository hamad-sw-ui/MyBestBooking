import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { Email, Mailer } from "./types";

export class SmtpMailer implements Mailer {
  private transporter: Transporter;
  private from: string;

  constructor(options: { host: string; port: number; secure: boolean; user: string; password: string; from: string }) {
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: { user: options.user, pass: options.password },
    });
    this.from = options.from;
  }

  async send(email: Email): Promise<{ id: string }> {
    const result = await this.transporter.sendMail({
      from: this.from,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
      headers: email.idempotencyKey ? { "X-MyBestBooking-Event-Key": email.idempotencyKey } : undefined,
    });
    return { id: result.messageId };
  }
}

export function smtpMailerFromEnv(): SmtpMailer | null {
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  if (!user || !password) return null;

  const host = process.env.SMTP_HOST ?? "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT ?? "465");
  const secure = (process.env.SMTP_SECURE ?? "true") !== "false";
  const from = process.env.SMTP_FROM ?? process.env.MAIL_FROM ?? user;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT doit être un port valide");
  }
  return new SmtpMailer({ host, port, secure, user, password, from });
}
