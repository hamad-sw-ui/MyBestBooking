import { mkdirSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { StoredFile, Uploader } from "./types";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * LocalUploader (T-014) : écrit dans public/uploads/ pour dev/sandbox.
 * URL relative servie par Next static (public/).
 */
export class LocalUploader implements Uploader {
  private dir: string;

  constructor(dir?: string) {
    this.dir = dir ?? join(process.cwd(), "public", "uploads");
    try {
      mkdirSync(this.dir, { recursive: true });
    } catch {
      /* ignore */
    }
  }

  async put(file: Buffer, mimeType: string, ownerId: string): Promise<StoredFile> {
    const ext = MIME_EXT[mimeType] ?? "bin";
    const prefix = ownerId.slice(0, 8);
    const key = `${prefix}-${randomUUID()}.${ext}`;
    const path = join(this.dir, key);
    writeFileSync(path, file);
    return {
      url: `/uploads/${key}`,
      key,
      size: file.byteLength,
    };
  }

  async remove(key: string): Promise<boolean> {
    // Sécurité : rejeter tout key qui tente path traversal.
    if (key.includes("..") || key.includes("/") || key.includes("\\")) return false;
    const path = join(this.dir, key);
    try {
      if (!existsSync(path)) return false;
      unlinkSync(path);
      return true;
    } catch {
      return false;
    }
  }
}
