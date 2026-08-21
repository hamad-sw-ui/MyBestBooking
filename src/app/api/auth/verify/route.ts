import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { consumeToken } from "@/lib/tokens";
import { eq } from "drizzle-orm";

/**
 * GET /api/auth/verify?token=X
 * Marque emailVerified=true si le token est valide.
 * Redirige vers /verifier-email?ok=1 ou ?ok=0.
 * (T-013)
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const base = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;
  if (!token) {
    return NextResponse.redirect(new URL("/verifier-email?ok=0", base));
  }
  const userId = await consumeToken(token, "email_verification");
  if (!userId) {
    return NextResponse.redirect(new URL("/verifier-email?ok=0", base));
  }
  await db.update(users).set({ emailVerified: true }).where(eq(users.id, userId));
  return NextResponse.redirect(new URL("/verifier-email?ok=1", base));
}
