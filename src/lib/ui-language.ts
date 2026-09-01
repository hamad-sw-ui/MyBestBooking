/**
 * T-167 — persistance de la langue UI (anonyme).
 *
 * Même clé que le localStorage. Deux cookies : l'historique `mybb:ui-language`
 * (lu par `getServerLocale`) et `mybb-ui-language` (nom RFC 6265, sans
 * deux-points). SameSite=None;Secure en HTTPS pour que le cookie survive
 * un aperçu en iframe ; Lax en HTTP local.
 */
export const UI_LANGUAGE_STORAGE_KEY = "mybb:ui-language";
export const UI_LANGUAGE_COOKIE = "mybb:ui-language";
export const UI_LANGUAGE_COOKIE_ALT = "mybb-ui-language";

export function readUiLanguageCookie(cookieHeader: string | null | undefined): "fr" | "en" | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(/;\s*/);
  for (const name of [UI_LANGUAGE_COOKIE, UI_LANGUAGE_COOKIE_ALT]) {
    for (const part of parts) {
      const eq = part.indexOf("=");
      if (eq < 0) continue;
      if (part.slice(0, eq) !== name) continue;
      const value = decodeURIComponent(part.slice(eq + 1).trim());
      if (value === "en" || value === "fr") return value;
    }
  }
  return null;
}

function cookieAttributeSuffix(): string {
  const secure = typeof location !== "undefined" && location.protocol === "https:";
  return (
    ";path=/;max-age=31536000;SameSite=" +
    (secure ? "None" : "Lax") +
    (secure ? ";Secure;Partitioned" : "")
  );
}

/** Script `beforeInteractive` : recopie localStorage (ou cookie) → cookies + <html lang>. */
export function langInitInlineScript(hasAccount: boolean): string {
  return (
    "try{var hasAccount=" +
    JSON.stringify(hasAccount) +
    ";" +
    "if(!hasAccount){var s=localStorage.getItem(" +
    JSON.stringify(UI_LANGUAGE_STORAGE_KEY) +
    ");" +
    "if(!s){var m=document.cookie.match(/(?:^|; )(?:mybb-ui-language|mybb:ui-language)=([^;]*)/);if(m)s=decodeURIComponent(m[1]);}" +
    "if(s==='en'||s==='fr'){document.documentElement.lang=s;" +
    "var sec=location.protocol==='https:';" +
    "var a=';path=/;max-age=31536000;SameSite='+(sec?'None':'Lax')+(sec?';Secure;Partitioned':'');" +
    "document.cookie='" +
    UI_LANGUAGE_COOKIE +
    "='+s+a;document.cookie='" +
    UI_LANGUAGE_COOKIE_ALT +
    "='+s+a;}}" +
    "}catch(e){}"
  );
}

/** Côté client : localStorage + cookies + <html lang> (avant un reload). */
export function persistUiLanguageClient(next: string): void {
  try {
    localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, next);
  } catch {
    // stockage indisponible
  }
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("lang", next);
  const attrs = cookieAttributeSuffix();
  document.cookie = UI_LANGUAGE_COOKIE + "=" + next + attrs;
  document.cookie = UI_LANGUAGE_COOKIE_ALT + "=" + next + attrs;
}
