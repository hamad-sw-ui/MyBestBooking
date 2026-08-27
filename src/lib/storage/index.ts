import { LocalUploader } from "./local";
import { PublicLocalUploader } from "./public-local";
import { S3Uploader } from "./s3";
import type { Uploader, PublicUploader } from "./types";
import { clearProviderCredentialsCache, resolveProviderCredentials } from "@/lib/provider-credentials";

export type { Uploader, PublicUploader, StoredFile, RetrievedFile, PublicStoredFile } from "./types";
export { LocalUploader, PublicLocalUploader, S3Uploader };

/**
 * Sélectionne S3 depuis le coffre chiffré ou les env vars ; sinon stockage
 * local dev. Les credentials ne traversent jamais un composant client.
 */
export async function getUploader(): Promise<Uploader> {
  const config = await resolveProviderCredentials("s3");
  if (config.endpoint && config.bucket && config.accessKey && config.secretKey) {
    return new S3Uploader(
      config.endpoint,
      config.region ?? "auto",
      config.bucket,
      config.accessKey,
      config.secretKey,
      config.publicBaseUrl,
    );
  }
  return new LocalUploader();
}

/**
 * Stockage d'images PUBLIQUES (photos de bien). Réutilise S3/R2 si
 * configuré (l'URL construite est publique), sinon écrit dans
 * `public/uploads/` servi statiquement par Next. Les pièces jointes de
 * messagerie restent gérées par `getUploader()` (privées, sous `.data/`).
 */
export async function getPublicUploader(): Promise<PublicUploader> {
  const config = await resolveProviderCredentials("s3");
  if (config.endpoint && config.bucket && config.accessKey && config.secretKey) {
    const s3 = new S3Uploader(
      config.endpoint,
      config.region ?? "auto",
      config.bucket,
      config.accessKey,
      config.secretKey,
      config.publicBaseUrl,
    );
    // S3Uploader.put renvoie déjà une URL publique pour les images.
    return {
      put: (file, mimeType, ownerId) => s3.put(file, mimeType, ownerId).then((f) => ({ ...f, url: f.url ?? "" })),
      remove: (key) => s3.remove(key.startsWith("uploads/") ? key : `uploads/${key}`),
    };
  }
  return new PublicLocalUploader();
}

export function _resetUploader(): void {
  clearProviderCredentialsCache("s3");
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_UPLOAD_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
