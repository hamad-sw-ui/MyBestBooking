/**
 * Templates d'emails MyBestBooking (T-013).
 * T-025 : le sujet et le paragraphe principal (`body`) de chaque
 * template sont éditables via `app_settings.emailTemplates`. Le
 * layout HTML (branding, boutons, disclaimer) reste figé.
 *
 * Placeholders `{name}` supportés — voir DEFAULTS dans
 * `src/lib/settings.ts` pour la liste par template.
 */

import { getSetting } from "@/lib/settings";
import { renderTemplate, escapeHtml } from "./render";

export function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();
}

const brand = {
  primary: "#1B3A6B",
  secondary: "#FF5A5F",
  bg: "#f8f9fa",
};

function layout(inner: string): string {
  return `<!doctype html>
<html lang="fr">
<body style="margin:0;padding:24px;font-family:Inter,system-ui,sans-serif;background:${brand.bg};color:#111;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.05);">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="color:${brand.primary};font-weight:700;font-size:20px;">mybest</span><span style="color:${brand.secondary};font-weight:700;font-size:20px;">booking</span>
    </div>
    ${inner}
    <hr style="margin-top:32px;border:none;border-top:1px solid #eee;">
    <p style="font-size:12px;color:#888;text-align:center;">MyBestBooking — Réservez mieux. Voyagez plus.</p>
  </div>
</body>
</html>`;
}

function button(url: string, label: string): string {
  return `<a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;background:${brand.secondary};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">${escapeHtml(label)}</a>`;
}

/** Convertit le paragraphe body (multi-lignes) en HTML avec <p>. */
function bodyToHtml(body: string): string {
  return body
    .split(/\n\n+/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

export const templates = {
  async emailVerification({ firstName, url }: { firstName: string; url: string }) {
    const tpl = (await getSetting("emailTemplates")).emailVerification;
    const subject = renderTemplate(tpl.subject, { firstName, url });
    const bodyRendered = renderTemplate(bodyToHtml(tpl.body), { firstName, url });
    const html = layout(`
      ${bodyRendered}
      <p style="margin:24px 0;">${button(url, "Vérifier mon email")}</p>
      <p style="font-size:13px;color:#666;">Ou copiez-collez ce lien dans votre navigateur :<br><span style="word-break:break-all;">${escapeHtml(url)}</span></p>
    `);
    return { subject, html, text: stripHtml(html) };
  },

  async passwordReset({ firstName, url }: { firstName: string; url: string }) {
    const tpl = (await getSetting("emailTemplates")).passwordReset;
    const subject = renderTemplate(tpl.subject, { firstName, url });
    const bodyRendered = renderTemplate(bodyToHtml(tpl.body), { firstName, url });
    const html = layout(`
      ${bodyRendered}
      <p style="margin:24px 0;">${button(url, "Choisir un nouveau mot de passe")}</p>
    `);
    return { subject, html, text: stripHtml(html) };
  },

  async bookingConfirmation({
    firstName, bookingReference, propertyName, city, checkIn, checkOut, total, currency,
  }: {
    firstName: string; bookingReference: string; propertyName: string;
    city: string; checkIn: string; checkOut: string; total: string; currency: string;
  }) {
    const vars = { firstName, bookingReference, propertyName, city, checkIn, checkOut, total, currency };
    const tpl = (await getSetting("emailTemplates")).bookingConfirmation;
    const subject = renderTemplate(tpl.subject, vars);
    const bodyRendered = renderTemplate(bodyToHtml(tpl.body), vars);
    const html = layout(`
      ${bodyRendered}
      <table style="width:100%;margin:24px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;">Référence</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(bookingReference)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Hébergement</td><td style="padding:8px 0;text-align:right;">${escapeHtml(propertyName)}, ${escapeHtml(city)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Arrivée</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkIn)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Départ</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkOut)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Total</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(total)} ${escapeHtml(currency)}</td></tr>
      </table>
    `);
    return { subject, html, text: stripHtml(html) };
  },

  async bookingCancellation({
    firstName, bookingReference, propertyName, cancellationFee, currency,
  }: {
    firstName: string; bookingReference: string; propertyName: string;
    cancellationFee: string; currency: string;
  }) {
    const vars = { firstName, bookingReference, propertyName, cancellationFee, currency };
    const tpl = (await getSetting("emailTemplates")).bookingCancellation;
    const subject = renderTemplate(tpl.subject, vars);
    const bodyRendered = renderTemplate(bodyToHtml(tpl.body), vars);
    const html = layout(bodyRendered);
    return { subject, html, text: stripHtml(html) };
  },

  async newMessage({
    firstName, senderName,
  }: { firstName: string; senderName: string }) {
    const tpl = (await getSetting("emailTemplates")).newMessage;
    const subject = renderTemplate(tpl.subject, { firstName, senderName });
    const bodyRendered = renderTemplate(bodyToHtml(tpl.body), { firstName, senderName });
    const html = layout(bodyRendered);
    return { subject, html, text: stripHtml(html) };
  },

  async bookingHostNotification({
    hostFirstName, bookingReference, propertyName, guestName, checkIn, checkOut,
  }: {
    hostFirstName: string; bookingReference: string; propertyName: string;
    guestName: string; checkIn: string; checkOut: string;
  }) {
    const vars = { hostFirstName, bookingReference, propertyName, guestName, checkIn, checkOut };
    const tpl = (await getSetting("emailTemplates")).bookingHostNotification;
    const subject = renderTemplate(tpl.subject, vars);
    const bodyRendered = renderTemplate(bodyToHtml(tpl.body), vars);
    const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const html = layout(`
      ${bodyRendered}
      <table style="width:100%;margin:24px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;">Référence</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(bookingReference)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Hébergement</td><td style="padding:8px 0;text-align:right;">${escapeHtml(propertyName)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Voyageur</td><td style="padding:8px 0;text-align:right;">${escapeHtml(guestName)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Arrivée</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkIn)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Départ</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkOut)}</td></tr>
      </table>
      <p>Consultez le détail dans votre <a href="${escapeHtml(dashboardUrl)}/dashboard/bookings">dashboard</a>.</p>
    `);
    return { subject, html, text: stripHtml(html) };
  },
};
