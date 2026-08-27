import { mkdirSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { randomUUID } from "node:crypto";
import type { PublicStoredFile } from "./types";

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Stockage PUBLIC de développement pour les images de bien (photos
 * d'annonce). Contrairement à `LocalUploader` (pièces jointes de
 * messagerie, privées sous `.data/`), ces fichiers sont écrits dans
 * `public/uploads/` et servis statiquement par Next à `/uploads/<key>`.
 *
 * En production, on utilise S3/R2 via `PublicS3Uploader` (URL publique
 * retournée par le fournisseur) : cette classe n'existe qu'en dev.
 */
export class PublicLocalUploader {
  private dir: string;

  constructor(dir?: string) {
    this.dir = dir ?? join(process.cwd(), "public", "uploads");
    mkdirSync(this.dir, { recursive: true });
  }

  async put(file: Buffer, mimeType: string, ownerId: string): Promise<PublicStoredFile> {
    const ext = MIME_EXT[mimeType] ?? "bin";
    const prefix = ownerId.slice(0, 8);
    // Nom unique, sans instancier de chemin privé : tout vit dans /uploads.
    const filename = `${prefix}-${randomUUID()}.${ext}`;
    const path = join(this.dir, filename);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file);
    return { url: `/uploads/${filename}`, key: filename, size: file.byteLength, mimeType };
  }

  async remove(key: string): Promise<boolean> {
    // La clé est un simple nom de fichier (pas de traversée de dossier).
    if (!/^[A-Za-z0-9._-]+\.(jpg|jpeg|png|webp|gif)$/.test(key)) return false;
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
