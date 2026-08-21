import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, readFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalUploader } from "./local";

describe("LocalUploader (T-014, §13.5)", () => {
  let tmp: string;
  beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), "up-")); });
  afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

  it("sauvegarde un fichier JPEG et renvoie url + key + size", async () => {
    const u = new LocalUploader(tmp);
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0]); // magic JPEG
    const res = await u.put(buf, "image/jpeg", "abcdef12-uid");
    expect(res.size).toBe(4);
    expect(res.url).toMatch(/^\/uploads\/abcdef12-[a-f0-9-]+\.jpg$/);
    expect(res.key).toMatch(/\.jpg$/);
    expect(existsSync(join(tmp, res.key))).toBe(true);
    expect(readFileSync(join(tmp, res.key))).toEqual(buf);
  });

  it("supporte png et webp", async () => {
    const u = new LocalUploader(tmp);
    const png = await u.put(Buffer.from([1]), "image/png", "u1");
    const webp = await u.put(Buffer.from([2]), "image/webp", "u2");
    expect(png.url).toMatch(/\.png$/);
    expect(webp.url).toMatch(/\.webp$/);
  });

  it("fallback .bin pour MIME inconnu", async () => {
    const u = new LocalUploader(tmp);
    const res = await u.put(Buffer.from([0]), "application/x-mystery", "u1");
    expect(res.url).toMatch(/\.bin$/);
  });

  it("produit des noms uniques (aucune collision sur 10 uploads)", async () => {
    const u = new LocalUploader(tmp);
    const urls = await Promise.all(
      Array.from({ length: 10 }, () => u.put(Buffer.from([1]), "image/png", "same"))
    );
    const set = new Set(urls.map((u) => u.url));
    expect(set.size).toBe(10);
    expect(readdirSync(tmp).length).toBe(10);
  });

  it("ne préfixe l'URL qu'avec les 8 premiers chars de ownerId", async () => {
    const u = new LocalUploader(tmp);
    const res = await u.put(Buffer.from([1]), "image/png", "abcdefghij-secret-suffix");
    expect(res.url).toContain("abcdefgh-");
    expect(res.url).not.toContain("secret");
  });
});
