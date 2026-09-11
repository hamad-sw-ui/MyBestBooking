import { NextResponse } from "next/server";
import { logout } from "@/lib/auth";
import { appBaseUrl } from "@/lib/app-url";

export async function POST() {
  await logout();
  // B3 (audit n°6) : même base que les e-mails (repli absolu documenté).
  return NextResponse.redirect(new URL("/", appBaseUrl()));
}
