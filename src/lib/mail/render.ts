/**
 * T-025 — Rendu de templates d'emails avec substitution `{name}` +
 * échappement HTML strict des variables.
 *
 * Placeholders inconnus → laissés tels quels. Aucune dépendance
 * externe (pas de Mustache/Handlebars).
 */

/** Échappement HTML minimal des 5 caractères sensibles. */
export function escapeHtml(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Remplace `{key}` par la valeur échappée de `vars[key]`. Un
 * placeholder inconnu est **laissé tel quel** (pas d'erreur bruyante,
 * permet à l'admin de voir immédiatement une typo).
 *
 * Les paires clé n'acceptent que /^[a-zA-Z][a-zA-Z0-9_]*$/ pour éviter
 * les faux positifs sur du texte comme « {jour de la semaine} ».
 */
export function renderTemplate(
  template: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  if (!template) return "";
  return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (match, key: string) => {
    if (Object.prototype.hasOwnProperty.call(vars, key)) {
      return escapeHtml(vars[key]);
    }
    return match;
  });
}
