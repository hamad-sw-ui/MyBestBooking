import { mkdirSync, writeFileSync, unlinkSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { RetrievedFile, StoredFile, Uploader } from "./types";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const EXT_MIME: Record<string, string> = Object.fromEntries(Object.entries(MIME_EXT).map(([mime, ext]) => [ext, mime]));
const KEY_PATTERN = /^uploads\/[A-Za-z0-9._-]+$/;

/**
 * Stockage local privé de développement. Il vit hors `public/` : seul un
 * handler applicatif ayant vérifié le participant peut lire une pièce jointe.
 */
export class LocalUploader implements Uploader {
  private dir: string;

  constructor(dir?: string) {
    this.dir = dir ?? join(process.cwd(), ".data", "uploads");
    mkdirSync(this.dir, { recursive: true });
  }

  async put(file: Buffer, mimeType: string, ownerId: string): Promise<StoredFile> {
    const ext = MIME_EXT[mimeType] ?? "bin";
    const prefix = ownerId.slice(0, 8);
    const key = `uploads/${prefix}-${randomUUID()}.${ext}`;
    const path = join(this.dir, key);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file);
    return { url: null, key, size: file.byteLength, mimeType };
  }

  async remove(key: string): Promise<boolean> {
    if (!KEY_PATTERN.test(key)) return false;
    const path = join(this.dir, key);
    try {
      if (!existsSync(path)) return false;
      unlinkSync(path);
      return true;
    } catch {
      return false;
    }
  }

  async get(key: string): Promise<RetrievedFile | null> {
    if (!KEY_PATTERN.test(key)) return null;
    const path = join(this.dir, key);
    if (!existsSync(path)) return null;
    const ext = key.split(".").pop() ?? "";
    return { body: readFileSync(path), mimeType: EXT_MIME[ext] ?? "application/octet-stream" };
  }
}
