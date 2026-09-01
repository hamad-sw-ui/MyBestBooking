import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { frenchZodMessage } from "@/lib/http";
import { apiError } from "@/lib/api-error";
import {
  SETTING_KEYS,
  SettingKey,
  getSetting,
  setSetting,
} from "@/lib/settings";
import { rateLimit } from "@/lib/rate-limit";
import { recordAudit, AUDIT_ACTIONS } from "@/lib/audit";

function isValidKey(k: string): k is SettingKey {
  return (SETTING_KEYS as readonly string[]).includes(k);
}

/**
 * GET /api/admin/settings/[key] — retourne la valeur courante d'une
 * section (avec DEFAULTS appliqués si absente). Admin only.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: await apiError("Accès admin requis") }, { status: 403 });
  }

  const { key } = await params;
  if (!isValidKey(key)) {
    return NextResponse.json({ error: await apiError("Clé inconnue") }, { status: 404 });
  }

  try {
    const value = await getSetting(key);
    return NextResponse.json({ key, value });
  } catch (error) {
    console.error(`[admin/settings/${key}] GET error:`, error);
    return NextResponse.json(
      { error: await apiError("Une erreur est survenue") },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/settings/[key] — met à jour une section entière.
 * Le body est validé par le schéma Zod de la clé (bornes, types stricts).
 * Admin only. Rate-limit 30/min par admin.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: await apiError("Accès admin requis") }, { status: 403 });
  }

  const rl = rateLimit(`admin:settings:${user.id}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: await apiError("Trop de modifications, réessayez dans une minute") },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const { key } = await params;
  if (!isValidKey(key)) {
    return NextResponse.json({ error: await apiError("Clé inconnue") }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: await apiError("JSON invalide") }, { status: 400 });
  }

  try {
    const previous = await getSetting(key);
    // T-159 (audit n°29) : PATCH partiel accepté — fusion sur la valeur
    // persistée (avec defaults appliqués par getSetting) puis validation
    // du résultat complet. Envoyer la section entière reste accepté
    // (le merge est alors une identité) → aucun changement pour le panneau.
    const merged = (body && typeof body === "object" && !Array.isArray(body))
      ? { ...previous, ...body }
      : body;
    const value = await setSetting(key, merged, user.id);
    // T-024 : audit log
    await recordAudit({
      actorId: user.id,
      actorEmail: user.email,
      action: AUDIT_ACTIONS.settingUpdate,
      entityType: "setting",
      entityId: key,
      metadata: { before: previous, after: value },
    });
    return NextResponse.json({ key, value });
  } catch (error) {
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) {
      // T-159 : message français seul — les détails internes de validation
      // (issues en anglais) ne sont plus exposés.
      return NextResponse.json({ error: await apiError(frenchZodMessage(error)) }, { status: 400 });
    }
    console.error(`[admin/settings/${key}] PATCH error:`, error);
    return NextResponse.json(
      { error: await apiError("Une erreur est survenue") },
      { status: 500 },
    );
  }
}
