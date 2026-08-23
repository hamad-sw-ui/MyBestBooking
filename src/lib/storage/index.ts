import { LocalUploader } from "./local";
import { S3Uploader } from "./s3";
import type { Uploader } from "./types";
import { clearProviderCredentialsCache, resolveProviderCredentials } from "@/lib/provider-credentials";

export type { Uploader, StoredFile, RetrievedFile } from "./types";
export { LocalUploader, S3Uploader };

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
