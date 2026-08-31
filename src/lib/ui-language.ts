/**
 * T-167 — persistance de la langue UI (anonyme).
 *
 * Même clé que le localStorage et le cookie lus par `getServerLocale`.
 * Le sélecteur doit poser le cookie AVANT le reload, sinon le RSC
 * rerend en français (pas encore de cookie) et l'UI flash FR.
 */
export const UI_LANGUAGE_STORAGE_KEY = "mybb:ui-language";
export const UI_LANGUAGE_COOKIE = "mybb:ui-language";

/** Script `beforeInteractive` : recopie localStorage → cookie + <html lang>. */
export function langInitInlineScript(hasAccount: boolean): string {
  return (
    "try{var hasAccount=" +
    JSON.stringify(hasAccount) +
    ";" +
    "if(!hasAccount){var s=localStorage.getItem(" +
    JSON.stringify(UI_LANGUAGE_STORAGE_KEY) +
    ");" +
    "if(s==='en'||s==='fr'){document.documentElement.lang=s;" +
    "document.cookie='" +
    UI_LANGUAGE_COOKIE +
    "='+s+';path=/;max-age=31536000;SameSite=Lax';}}" +
    "}catch(e){}"
  );
}

/** Côté client : localStorage + cookie + <html lang> (avant un reload). */
export function persistUiLanguageClient(next: string): void {
  try {
    localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, next);
  } catch {
    // stockage indisponible
  }
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("lang", next);
  document.cookie =
    UI_LANGUAGE_COOKIE + "=" + next + ";path=/;max-age=31536000;SameSite=Lax";
}
