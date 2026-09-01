import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { uploadObjects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-error";
import {
  getUploader,
  MAX_UPLOAD_BYTES,
  ALLOWED_UPLOAD_MIMES,
} from "@/lib/storage";
import { sniffImageMime } from "@/lib/storage/sniff";
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
    return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
  }
  const key = new URL(request.url).searchParams.get("key");
  if (!key || !/^uploads\/[A-Za-z0-9._-]+$/.test(key)) {
    return NextResponse.json({ error: await apiError("Key invalide") }, { status: 400 });
  }
  // Vérif ownership : les nouveaux uploads privés sont sous uploads/<id8>-.
  const ownedPrefix = user.id.slice(0, 8);
  if (user.role !== "admin" && !key.startsWith(`uploads/${ownedPrefix}-`)) {
    return NextResponse.json({ error: await apiError("Non autorisé sur ce fichier") }, { status: 403 });
  }
  const [upload] = await db.select().from(uploadObjects).where(eq(uploadObjects.key, key));
  if (!upload) return NextResponse.json({ error: await apiError("Fichier introuvable") }, { status: 404 });
  if (upload.attachedAt) return NextResponse.json({ error: await apiError("Cette pièce jointe est déjà liée à un message") }, { status: 409 });
  const ok = await (await getUploader()).remove(key);
  if (ok) await db.delete(uploadObjects).where(eq(uploadObjects.key, key));
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
    return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
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
      { error: await apiError("Trop d'uploads, réessayez plus tard") },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: await apiError("Corps invalide (multipart attendu)") },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json(
      { error: await apiError("Aucun fichier fourni (champ 'file' attendu)") },
      { status: 400 },
    );
  }

  const mimeType = file.type;
  if (!ALLOWED_UPLOAD_MIMES.has(mimeType)) {
    return NextResponse.json(
      { error: await apiError(`Type non autorisé : ${mimeType}. Formats acceptés : JPEG, PNG, WebP, GIF.`) },
      { status: 400 },
    );
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: await apiError(`Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(2)} MB > 5 MB)`) },
      { status: 413 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    // T-127 (P2) : on vérifie la signature réelle (magic bytes), pas seulement
    // le Content-Type déclaré par le client. Le MIME stocké en base est celui
    // détecté (« le MIME est une propriété de l'objet uploadé, jamais du
    // navigateur »), cohérent avec le contrôle de téléchargement.
    const realMime = sniffImageMime(buffer);
    if (!realMime || !ALLOWED_UPLOAD_MIMES.has(realMime)) {
      return NextResponse.json(
        { error: await apiError("Le fichier n'est pas une image valide (JPEG, PNG, WebP ou GIF).") },
        { status: 400 },
      );
    }

    const stored = await (await getUploader()).put(buffer, realMime, user.id);
    await db.insert(uploadObjects).values({ key: stored.key, ownerId: user.id, mimeType: realMime, size: stored.size }).onConflictDoNothing({ target: uploadObjects.key });
    return NextResponse.json({
      url: stored.url,
      key: stored.key,
      size: stored.size,
      mimeType: realMime,
    });
  } catch (e) {
    console.error("[upload] failed:", e);
    return NextResponse.json({ error: await apiError("Échec de l'upload") }, { status: 500 });
  }
}
