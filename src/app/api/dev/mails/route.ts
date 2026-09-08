import { NextResponse } from "next/server";
import { isDevMailInboxEnabled, listInboxMails } from "@/lib/mail/inbox";

/** Liste les e-mails ConsoleMailer (dev/test). Désactivé dès qu'une clé Resend existe. */
export async function GET() {
  if (!isDevMailInboxEnabled()) {
    return NextResponse.json({ error: "Boîte mail de développement désactivée" }, { status: 404 });
  }
  return NextResponse.json({ mails: listInboxMails() });
}
