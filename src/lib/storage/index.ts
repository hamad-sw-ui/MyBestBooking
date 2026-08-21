import { LocalUploader } from "./local";
import { S3Uploader } from "./s3";
import type { Uploader } from "./types";

export type { Uploader, StoredFile } from "./types";
export { LocalUploader, S3Uploader };

/**
 * Sélection de l'uploader selon l'environnement.
 * S3 si toutes les env vars requises sont définies, sinon Local.
 */
let cached: Uploader | null = null;

export function getUploader(): Uploader {
  if (cached) return cached;
  const {
    S3_ENDPOINT,
    S3_BUCKET,
    S3_ACCESS_KEY,
    S3_SECRET_KEY,
    S3_REGION,
    S3_PUBLIC_BASE_URL,
  } = process.env;
  if (S3_ENDPOINT && S3_BUCKET && S3_ACCESS_KEY && S3_SECRET_KEY) {
    cached = new S3Uploader(
      S3_ENDPOINT,
      S3_REGION ?? "auto",
      S3_BUCKET,
      S3_ACCESS_KEY,
      S3_SECRET_KEY,
      S3_PUBLIC_BASE_URL,
    );
  } else {
    cached = new LocalUploader();
  }
  return cached;
}

export function _resetUploader(): void {
  cached = null;
}

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_UPLOAD_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
