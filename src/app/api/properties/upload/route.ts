import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  getPublicUploader,
  MAX_UPLOAD_BYTES,
  ALLOWED_UPLOAD_MIMES,
} from "@/lib/storage";
import { sniffImageMime } from "@/lib/storage/sniff";
import { isMaintenanceActive, maintenanceResponse } from "@/lib/maintenance";

/**
 * POST /api/properties/upload
 * Upload d'une photo de bien (image PUBLIQUE).
 * multipart/form-data avec un champ `file`. Réservé aux hôtes et admins.
 * Retourne { url, key, size, mimeType } — l'URL est servable
 * statiquement (dev : /uploads/<fichier>, prod : CDN S3/R2).
 *
 * Distinct de /api/uploads (pièces jointes de messagerie, privées) :
 * une photo d'annonce doit être visible publiquement sur la fiche.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (user.role !== "host" && user.role !== "admin") {
    return NextResponse.json({ error: "Réservé aux hébergeurs" }, { status: 403 });
  }
  if (user.role !== "admin" && (await isMaintenanceActive())) {
    return maintenanceResponse();
  }

  const rl = rateLimit(`property-upload:user:${user.id}`, {
    limit: 30,
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
    return NextResponse.json({ error: "Corps invalide (multipart attendu)" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "Aucun fichier fourni (champ 'file' attendu)" }, { status: 400 });
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

    // T-126 (P3) : on vérifie la signature réelle du fichier (magic bytes),
    // pas seulement l'en-tête Content-Type déclaré par le client (qu'on peut
    // falsifier en renommant un .txt en .jpg). Le contenu doit être une
    // véritable image, et d'un type autorisé.
    const realMime = sniffImageMime(buffer);
    if (!realMime || !ALLOWED_UPLOAD_MIMES.has(realMime)) {
      return NextResponse.json(
        { error: "Le fichier n'est pas une image valide (JPEG, PNG, WebP ou GIF attendu)." },
        { status: 400 },
      );
    }

    const stored = await (await getPublicUploader()).put(buffer, realMime, user.id);
    return NextResponse.json({
      url: stored.url,
      key: stored.key,
      size: stored.size,
      mimeType: stored.mimeType,
    });
  } catch (e) {
    console.error("[property-upload] failed:", e);
    return NextResponse.json({ error: "Échec de l'upload" }, { status: 500 });
  }
}
