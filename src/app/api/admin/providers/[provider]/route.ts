import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { frenchZodMessage } from "@/lib/http";
import { apiError } from "@/lib/api-error";
import {
  isKnownProvider,
  PROVIDER_FIELDS,
  ProviderCredentialsError,
  providerMetadata,
  removeProviderCredentials,
  saveProviderCredentials,
} from "@/lib/provider-credentials";
import { rateLimit } from "@/lib/rate-limit";
import { AUDIT_ACTIONS, recordAudit } from "@/lib/audit";
import { getPaymentProvider } from "@/lib/payment";
import { getMailer } from "@/lib/mail";
import { getUploader, S3Uploader } from "@/lib/storage";
import { db } from "@/db";
import { providerTestLogs } from "@/db/schema";

const valueSchema = z.string().min(1).max(4096);
const updateSchema = z.object({ values: z.record(z.string(), valueSchema) });
const deleteSchema = z.object({ confirmProvider: z.string() });

async function requireAdmin() {
  const user = await getCurrentUser();
  return user?.role === "admin" ? user : null;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: await apiError("Accès admin requis") }, { status: 403 });
  const { provider: rawProvider } = await params;
  if (!isKnownProvider(rawProvider)) return NextResponse.json({ error: await apiError("Provider inconnu") }, { status: 404 });

  const rl = rateLimit(`admin:providers:${user.id}`, { limit: 20, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: await apiError("Trop de modifications, réessayez plus tard") }, { status: 429 });

  try {
    const { values } = updateSchema.parse(await request.json());
    const allowed = new Set(PROVIDER_FIELDS[rawProvider]);
    const invalid = Object.keys(values).find((key) => !allowed.has(key));
    if (invalid) return NextResponse.json({ error: `Champ non autorisé : ${invalid}` }, { status: 400 });

    await saveProviderCredentials(rawProvider, values, user.id);
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: AUDIT_ACTIONS.providerCredentialsUpdate,
      entityType: "provider",
      entityId: rawProvider,
      // Ne jamais enregistrer les valeurs, seulement les noms de champs.
      metadata: { fields: Object.keys(values) },
    });
    return NextResponse.json({ provider: await providerMetadata(rawProvider) });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) return NextResponse.json({ error: await apiError(frenchZodMessage(error)) }, { status: 400 });
    if (error instanceof ProviderCredentialsError) return NextResponse.json({ error: await apiError(error.message) }, { status: 503 });
    console.error("[admin/providers] PUT", error);
    return NextResponse.json({ error: await apiError("Impossible d'enregistrer le provider") }, { status: 500 });
  }
}

/** Test explicite, déclenché uniquement par un admin : aucune valeur secrète n'est retournée. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: await apiError("Accès admin requis") }, { status: 403 });
  const { provider: rawProvider } = await params;
  if (!isKnownProvider(rawProvider)) return NextResponse.json({ error: await apiError("Provider inconnu") }, { status: 404 });
  const rl = rateLimit(`admin:provider-test:${user.id}`, { limit: 5, windowMs: 60_000 });
  if (!rl.ok) return NextResponse.json({ error: await apiError("Trop de tests, réessayez plus tard") }, { status: 429 });

  try {
    if (rawProvider === "stripe") {
      const payment = await getPaymentProvider();
      if (payment.kind !== "stripe") throw new Error("Stripe n'est pas complètement configuré");
      const intent = await payment.create({ amount: 50, currency: "EUR", bookingReference: `MBB-CONN-${Date.now()}`, guestEmail: user.email });
      const cancel = await payment.cancel(intent.id);
      if (cancel === "failed") throw new Error("Stripe a refusé l'annulation de l'intent de test");
    } else if (rawProvider === "resend") {
      const mailer = await getMailer();
      if (mailer.constructor.name !== "ResendMailer") throw new Error("Resend n'est pas configuré");
      await mailer.send({
        to: user.email,
        subject: "Test de configuration Resend — MyBestBooking",
        text: "La configuration Resend a répondu avec succès.",
        html: "<p>La configuration Resend a répondu avec succès.</p>",
      });
    } else {
      const uploader = await getUploader();
      if (!(uploader instanceof S3Uploader)) throw new Error("S3/R2 n'est pas complètement configuré");
      const test = await uploader.put(Buffer.from("MyBestBooking provider test"), "image/png", user.id);
      const removed = await uploader.remove(test.key);
      if (!removed) throw new Error("Objet test S3 créé mais non supprimé");
    }
    await db.insert(providerTestLogs).values({ provider: rawProvider, actorId: user.id, status: "success", message: "Connexion validée" });
    await recordAudit({ actorId: user.id, actorEmail: user.email, action: AUDIT_ACTIONS.providerConnectionTest, entityType: "provider", entityId: rawProvider, metadata: { result: "success" } });
    return NextResponse.json({ ok: true, message: `Connexion ${rawProvider} validée` });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Échec du test provider";
    const code = /auth|key|credential|401|403/i.test(rawMessage) ? "AUTH_FAILED" : /network|fetch|timeout/i.test(rawMessage) ? "NETWORK_ERROR" : "CONNECTION_FAILED";
    await db.insert(providerTestLogs).values({ provider: rawProvider, actorId: user.id, status: "failed", message: code });
    await recordAudit({ actorId: user.id, actorEmail: user.email, action: AUDIT_ACTIONS.providerConnectionTest, entityType: "provider", entityId: rawProvider, metadata: { result: "failed", code } });
    return NextResponse.json({ error: `Test ${rawProvider} échoué : ${code}` }, { status: 422 });
  }
}

/** Retire les overrides DB d'un provider ; les variables env reprennent alors le relais. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const user = await requireAdmin();
  if (!user) return NextResponse.json({ error: await apiError("Accès admin requis") }, { status: 403 });
  const { provider: rawProvider } = await params;
  if (!isKnownProvider(rawProvider)) return NextResponse.json({ error: await apiError("Provider inconnu") }, { status: 404 });

  try {
    const body = deleteSchema.parse(await request.json());
    if (body.confirmProvider !== rawProvider) {
      return NextResponse.json({ error: await apiError("Confirmation du provider requise") }, { status: 400 });
    }
    await removeProviderCredentials(rawProvider);
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: AUDIT_ACTIONS.providerCredentialsRemove,
      entityType: "provider",
      entityId: rawProvider,
      metadata: { action: "fallback_environment" },
    });
    return NextResponse.json({ provider: await providerMetadata(rawProvider) });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) return NextResponse.json({ error: await apiError(frenchZodMessage(error)) }, { status: 400 });
    console.error("[admin/providers] DELETE", error);
    return NextResponse.json({ error: await apiError("Impossible de réinitialiser le provider") }, { status: 500 });
  }
}
