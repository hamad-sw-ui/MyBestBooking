export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Clé stable fournie par l'outbox pour les providers compatibles. */
  idempotencyKey?: string;
}

export interface Mailer {
  send(email: Email): Promise<{ id: string }>;
}
