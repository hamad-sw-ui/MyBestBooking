import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { allProviderMetadata, ProviderCredentialsError } from "@/lib/provider-credentials";
import { apiError } from "@/lib/api-error";

/** Liste uniquement les métadonnées de configuration, jamais une valeur secrète. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: await apiError("Accès admin requis") }, { status: 403 });
  }
  try {
    return NextResponse.json({ providers: await allProviderMetadata() });
  } catch (error) {
    if (error instanceof ProviderCredentialsError) {
      return NextResponse.json({ error: await apiError(error.message) }, { status: 503 });
    }
    console.error("[admin/providers] GET", error);
    return NextResponse.json({ error: await apiError("Impossible de lire l'état des providers") }, { status: 500 });
  }
}
