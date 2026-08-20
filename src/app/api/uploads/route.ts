import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  getUploader,
  MAX_UPLOAD_BYTES,
  ALLOWED_UPLOAD_MIMES,
} from "@/lib/storage";
import { isMaintenanceActive, maintenanceResponse } from "@/lib/maintenance";

/**
 * DELETE /api/uploads?key=xxx (T-026)
 * Supprime un fichier. Auth requise. Le key doit avoir été uploadé
 * par l'user (préfixe = 8 premiers caractères de son id) ou par un
 * admin (bypass).
 */
export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const key = new URL(request.url).searchParams.get("key");
  if (!key || !/^[A-Za-z0-9._-]+$/.test(key)) {
    return NextResponse.json({ error: "Key invalide" }, { status: 400 });
  }
  // Vérif ownership : préfixe 8 chars = id user
  const ownedPrefix = user.id.slice(0, 8);
  if (user.role !== "admin" && !key.startsWith(`${ownedPrefix}-`)) {
    return NextResponse.json({ error: "Non autorisé sur ce fichier" }, { status: 403 });
  }
  const ok = await getUploader().remove(key);
  return NextResponse.json({ removed: ok });
}

/**
 * POST /api/uploads
 * multipart/form-data avec un champ `file`.
 * Retourne { url, key, size, mimeType } ou une erreur.
 * (T-014)
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  // T-022 : mode maintenance
  if (user.role !== "admin" && (await isMaintenanceActive())) {
    return maintenanceResponse();
  }

  const rl = rateLimit(`upload:user:${user.id}`, {
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop d'uploads, réessayez plus tard" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Corps invalide (multipart attendu)" },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json(
      { error: "Aucun fichier fourni (champ 'file' attendu)" },
      { status: 400 },
    );
  }

  const mimeType = file.type;
  if (!ALLOWED_UPLOAD_MIMES.has(mimeType)) {
    return NextResponse.json(
      { error: `Type non autorisé : ${mimeType}. Formats acceptés : JPEG, PNG, WebP, GIF.` },
      { status: 400 },
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(2)} MB > 5 MB)` },
      { status: 413 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const stored = await getUploader().put(buffer, mimeType, user.id);
    return NextResponse.json({
      url: stored.url,
      key: stored.key,
      size: stored.size,
      mimeType,
    });
  } catch (e) {
    console.error("[upload] failed:", e);
    return NextResponse.json({ error: "Échec de l'upload" }, { status: 500 });
  }
}
