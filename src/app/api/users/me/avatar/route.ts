import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";
import { apiError } from "@/lib/api-error";
import {
  getPublicUploader,
  MAX_UPLOAD_BYTES,
  ALLOWED_UPLOAD_MIMES,
} from "@/lib/storage";
import { sniffImageMime } from "@/lib/storage/sniff";
import { assertNotMaintenance } from "@/lib/maintenance";

/**
 * POST /api/users/me/avatar (T-145)
 * Upload de la photo de profil de l'utilisateur connecté (image PUBLIQUE,
 * servie statiquement comme les photos d'annonce). Contrairement à la photo
 * de propriété (enregistrée au « Enregistrer » du formulaire), un avatar est
 * une action directe : on le stocke ET on met à jour `users.avatarUrl` tout de
 * suite. Le champ URL du profil reste disponible comme alternative.
 *
 * multipart/form-data avec un champ `file`. Tous les rôles connectés sont
 * autorisés (voyageur comme hébergeur).
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
  }
  await assertNotMaintenance(user);

  const rl = rateLimit(`avatar-upload:user:${user.id}`, {
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
    return NextResponse.json({ error: await apiError("Corps invalide (multipart attendu)") }, { status: 400 });
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: await apiError("Aucun fichier fourni (champ 'file' attendu)") }, { status: 400 });
  }

  if (!ALLOWED_UPLOAD_MIMES.has(file.type)) {
    return NextResponse.json(
      { error: `Type non autorisé : ${file.type}. Formats acceptés : JPEG, PNG, WebP, GIF.` },
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

    // Magic bytes : on ne fait pas confiance au Content-Type déclaré.
    const realMime = sniffImageMime(buffer);
    if (!realMime || !ALLOWED_UPLOAD_MIMES.has(realMime)) {
      return NextResponse.json(
        { error: await apiError("Le fichier n'est pas une image valide (JPEG, PNG, WebP ou GIF attendu).") },
        { status: 400 },
      );
    }

    const stored = await (await getPublicUploader()).put(buffer, realMime, user.id);

    const [updated] = await db
      .update(users)
      .set({ avatarUrl: stored.url, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning({ avatarUrl: users.avatarUrl });

    return NextResponse.json({
      url: updated?.avatarUrl ?? stored.url,
      key: stored.key,
      size: stored.size,
      mimeType: stored.mimeType,
    });
  } catch (e) {
    console.error("[avatar-upload] failed:", e);
    return NextResponse.json({ error: await apiError("Échec de l'upload") }, { status: 500 });
  }
}
