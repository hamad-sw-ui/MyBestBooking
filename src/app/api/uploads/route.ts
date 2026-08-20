import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  getUploader,
  MAX_UPLOAD_BYTES,
  ALLOWED_UPLOAD_MIMES,
} from "@/lib/storage";

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
