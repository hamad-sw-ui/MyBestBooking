/**
 * T-165 (audit n°30) — URL publique de base pour les e-mails/liens.
 *
 * Avant : `process.env.NEXT_PUBLIC_APP_URL ?? ""` répété dans les
 * templates et le cron → si la variable manque (prévisualisation,
 * déploiement), les boutons des e-mails devenaient des chemins RELATIFS
 * (`/dashboard/bookings`), inutilisables dans un client mail.
 *
 * Ici : source unique + repli documenté. Le comportement est identique
 * quand la variable est définie (cas de production) ; l'absence produit
 * une URL absolue valide au lieu d'un lien cassé. Un warning est émis
 * une fois au premier usage hors test pour signaler la config manquante.
 */
let warned = false;

export function appBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  if (!warned && process.env.NODE_ENV !== "test") {
    warned = true;
    console.warn(
      "[app-url] NEXT_PUBLIC_APP_URL non défini — repli sur https://mybestbooking.com (liens e-mails absolus conservés)",
    );
  }
  return "https://mybestbooking.com";
}
