import { describe, it, expect } from "vitest";
import { sniffImageMime } from "./sniff";

/**
 * T-126 (P3) : la détection du type d'image se fait sur la signature réelle
 * du fichier (magic bytes), jamais sur le Content-Type déclaré par le client.
 */
describe("sniffImageMime (T-126)", () => {
  it("reconnaît un JPEG (FF D8 FF)", () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(sniffImageMime(buf)).toBe("image/jpeg");
  });

  it("reconnaît un PNG (89 50 4E 47 …)", () => {
    const buf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
    expect(sniffImageMime(buf)).toBe("image/png");
  });

  it("reconnaît un GIF (GIF89a / GIF87a)", () => {
    expect(sniffImageMime(Buffer.from("GIF89a........", "latin1"))).toBe("image/gif");
    expect(sniffImageMime(Buffer.from("GIF87a........", "latin1"))).toBe("image/gif");
  });

  it("reconnaît un WebP (RIFF….WEBP)", () => {
    const buf = Buffer.from("RIFF0000WEBP0000", "latin1");
    expect(sniffImageMime(buf)).toBe("image/webp");
  });

  it("rejette un fichier texte déguisé (pas de signature image)", () => {
    expect(sniffImageMime(Buffer.from("this is not an image at all", "utf8"))).toBeNull();
    // Un PDF déguisé commence par "%PDF"
    expect(sniffImageMime(Buffer.from("%PDF-1.4 ........", "latin1"))).toBeNull();
  });

  it("renvoie null pour une entrée vide/trop courte", () => {
    expect(sniffImageMime(null)).toBeNull();
    expect(sniffImageMime(undefined)).toBeNull();
    expect(sniffImageMime(Buffer.alloc(0))).toBeNull();
    expect(sniffImageMime(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});
