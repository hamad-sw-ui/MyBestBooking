/**
 * T-188 — Détermine si une source d'image est **auto-hébergée** (servie
 * par CE serveur : `/seed-images/*`, `/uploads/*`…) et peut donc passer
 * par l'optimizer `/_next/image`.
 *
 * Règle : chemin absolu local (commence par `/`, sans `//`).
 * Les URLs distantes (`https://…`), protocol-relative (`//…`), `data:` et
 * `blob:` retournent `false` → ces images gardent le rendu `<img>` natif
 * (jamais cassées par la whitelist de domains).
 *
 * Pur, sans I/O → testable unitairement.
 */
export function isLocallyServedImage(src: string | null | undefined): boolean {
  if (!src) return false;
  const s = src.trim();
  return s.startsWith("/") && !s.startsWith("//");
}
