import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/** Boîte de lecture des mails ConsoleMailer — jamais si Resend est configuré. */
export function isDevMailInboxEnabled(): boolean {
  if (process.env.MAIL_INBOX === "0") return false;
  // MAIL_INBOX=1 reste lisible même avec Resend (filet si l'API est injoignable).
  if (process.env.MAIL_INBOX === "1") return true;
  if (process.env.RESEND_API_KEY) return false;
  return process.env.NODE_ENV !== "production";
}

export function mailDir(): string {
  return join(process.cwd(), ".data", "mails");
}

export interface InboxMail {
  id: string;
  to: string;
  subject: string;
  date: string;
  text: string;
  html: string;
  links: string[];
}

function parseMailFile(id: string, raw: string): InboxMail {
  const headerEnd = raw.indexOf("\n\n");
  const headers = headerEnd >= 0 ? raw.slice(0, headerEnd) : raw;
  const body = headerEnd >= 0 ? raw.slice(headerEnd + 2) : "";
  const to = headers.match(/^To:\s*(.+)$/m)?.[1]?.trim() ?? "";
  const subject = headers.match(/^Subject:\s*(.+)$/m)?.[1]?.trim() ?? "";
  const date = headers.match(/^Date:\s*(.+)$/m)?.[1]?.trim() ?? "";
  const htmlSplit = body.split(/\n--- HTML ---\n/);
  const text = (htmlSplit[0] ?? "").trim();
  const html = (htmlSplit[1] ?? "").trim();
  const links = [
    ...new Set(
      `${text}\n${html}`.match(/https?:\/\/[^\s"'<>]+/g) ?? [],
    ),
  ];
  return { id, to, subject, date, text, html, links };
}

export function listInboxMails(): InboxMail[] {
  const dir = mailDir();
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith(".txt"));
  const mails = files.map((file) => {
    const id = file.replace(/\.txt$/, "");
    const path = join(dir, file);
    const raw = readFileSync(path, "utf8");
    const parsed = parseMailFile(id, raw);
    const mtime = statSync(path).mtime.toISOString();
    return { ...parsed, date: parsed.date || mtime, mtime };
  });
  return mails.sort((a, b) => (b.date > a.date ? 1 : -1));
}

export function getInboxMail(id: string): InboxMail | null {
  if (!/^[\w.@+-]+$/.test(id)) return null;
  const path = join(mailDir(), `${id}.txt`);
  if (!existsSync(path)) return null;
  return parseMailFile(id, readFileSync(path, "utf8"));
}
