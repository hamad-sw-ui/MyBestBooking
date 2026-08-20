import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  SETTING_KEYS,
  SettingKey,
  getSetting,
  setSetting,
} from "@/lib/settings";
import { rateLimit } from "@/lib/rate-limit";

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
    return NextResponse.json({ error: "Accès admin requis" }, { status: 403 });
  }

  const { key } = await params;
  if (!isValidKey(key)) {
    return NextResponse.json({ error: "Clé inconnue" }, { status: 404 });
  }

  try {
    const value = await getSetting(key);
    return NextResponse.json({ key, value });
  } catch (error) {
    console.error(`[admin/settings/${key}] GET error:`, error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
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
    return NextResponse.json({ error: "Accès admin requis" }, { status: 403 });
  }

  const rl = rateLimit(`admin:settings:${user.id}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de modifications, réessayez dans une minute" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  const { key } = await params;
  if (!isValidKey(key)) {
    return NextResponse.json({ error: "Clé inconnue" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  try {
    const value = await setSetting(key, body, user.id);
    console.info(
      `[settings] admin=${user.email} key=${key} updated at ${new Date().toISOString()}`,
    );
    return NextResponse.json({ key, value });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: error.issues[0]?.message ?? "Payload invalide",
          issues: error.issues,
        },
        { status: 400 },
      );
    }
    console.error(`[admin/settings/${key}] PATCH error:`, error);
    return NextResponse.json(
      { error: "Une erreur est survenue" },
      { status: 500 },
    );
  }
}
