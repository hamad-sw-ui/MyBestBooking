/**
 * T-126 (P3) : détection du type d'image à partir des « magic bytes » (la
 * signature réelle du fichier), et non de l'en-tête `Content-Type` déclaré
 * par le client (qu'un utilisateur peut falsifier en renommant un `.txt` en
 * `.jpg`).
 *
 * Renvoie le MIME réel si la signature correspond à un format d'image pris en
 * charge, sinon `null`. Pur et synchrone → testable sans I/O.
 */
export function sniffImageMime(bytes: Uint8Array | Buffer | null | undefined): string | null {
  if (!bytes || bytes.length < 12) return null;
  const b = bytes;

  // JPEG : FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";

  // PNG : 89 50 4E 47 0D 0A 1A 0A
  if (
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 &&
    b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a
  ) {
    return "image/png";
  }

  // GIF : "GIF87a" ou "GIF89a"
  if (
    b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 &&
    (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61
  ) {
    return "image/gif";
  }

  // WebP : "RIFF" .... "WEBP"
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}
