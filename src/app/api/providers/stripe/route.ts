import { NextResponse } from "next/server";
import { resolveProviderCredentials } from "@/lib/provider-credentials";

/** Expose uniquement la clé Stripe publiable, jamais les secrets serveur. */
export async function GET() {
  try {
    const { publishableKey } = await resolveProviderCredentials("stripe");
    if (!publishableKey) return NextResponse.json({ configured: false });
    return NextResponse.json({ configured: true, publishableKey });
  } catch (error) {
    console.error("[providers/stripe]", error);
    return NextResponse.json({ configured: false }, { status: 503 });
  }
}
