/**
 * Templates d'emails MyBestBooking (T-013).
 * T-025 : le sujet et le paragraphe principal (`body`) de chaque
 * template sont éditables via `app_settings.emailTemplates`. Le
 * layout HTML (branding, boutons, disclaimer) reste figé.
 *
 * Placeholders `{name}` supportés — voir DEFAULTS dans
 * `src/lib/settings.ts` pour la liste par template.
 */

import { getSetting, DEFAULTS } from "@/lib/settings";
import { renderTemplate, escapeHtml } from "./render";
import { toMailLocale, mailStrings, type MailLocale } from "./strings";

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

function layout(inner: string, locale: MailLocale = "fr"): string {
  const s = mailStrings(locale);
  return `<!doctype html>
<html lang="${locale}">
<body style="margin:0;padding:24px;font-family:Inter,system-ui,sans-serif;background:${brand.bg};color:#111;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,.05);">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="color:${brand.primary};font-weight:700;font-size:20px;">MyBest</span><span style="color:${brand.secondary};font-weight:700;font-size:20px;">Booking</span>
    </div>
    ${inner}
    <hr style="margin-top:32px;border:none;border-top:1px solid #eee;">
    <p style="font-size:12px;color:#888;text-align:center;">MyBestBooking — ${s.slogan}</p>
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
  async emailVerification({ firstName, url, language }: { firstName: string; url: string; language?: string | null }) {
    const loc = toMailLocale(language);
    const s = mailStrings(loc);
    const tpl = (await getSetting("emailTemplates")).emailVerification;
    const subject = renderTemplate(tpl.subject, { firstName, url });
    const bodyRendered = renderTemplate(bodyToHtml(tpl.body), { firstName, url });
    const html = layout(`
      ${bodyRendered}
      <p style="margin:24px 0;">${button(url, s.verifyEmail)}</p>
      <p style="font-size:13px;color:#666;">${s.copyLink}<br><span style="word-break:break-all;">${escapeHtml(url)}</span></p>
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },

  async passwordReset({ firstName, url, language }: { firstName: string; url: string; language?: string | null }) {
    const loc = toMailLocale(language);
    const s = mailStrings(loc);
    const tpl = (await getSetting("emailTemplates")).passwordReset;
    const subject = renderTemplate(tpl.subject, { firstName, url });
    const bodyRendered = renderTemplate(bodyToHtml(tpl.body), { firstName, url });
    const html = layout(`
      ${bodyRendered}
      <p style="margin:24px 0;">${button(url, s.choosePassword)}</p>
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },

  /** Message de bienvenue envoyé une fois l'adresse email vérifiée. */
  async welcomeEmail({ firstName, url, language }: { firstName: string; url: string; language?: string | null }) {
    const loc = toMailLocale(language);
    const s = mailStrings(loc);
    const tpl = (await getSetting("emailTemplates")).welcomeEmail;
    const subject = renderTemplate(tpl.subject, { firstName, url });
    const bodyRendered = renderTemplate(bodyToHtml(tpl.body), { firstName, url });
    const html = layout(`
      ${bodyRendered}
      <p style="margin:24px 0;">${button(url, s.accessAccount)}</p>
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },

  /** Claim explicite du profil créé par un checkout invité. */
  async guestAccountClaim({ firstName, url, bookingReference, language }: { firstName: string; url: string; bookingReference: string; language?: string | null }) {
    const loc = toMailLocale(language);
    const s = mailStrings(loc);
    const subject = loc === "en"
      ? `Access your booking ${bookingReference}`
      : `Accédez à votre réservation ${bookingReference}`;
    const greeting = loc === "en" ? `Hi ${escapeHtml(firstName)},` : `Bonjour ${escapeHtml(firstName)},`;
    const html = layout(`
      <p>${greeting}</p>
      <p>${s.guestClaimAction} <strong>${escapeHtml(bookingReference)}</strong> ${s.guestClaimSaved}</p>
      <p style="margin:24px 0;">${button(url, s.activateAccess)}</p>
      <p style="font-size:13px;color:#666;">${s.personalLink24h}</p>
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },

  async bookingConfirmation({
    firstName, bookingReference, propertyName, city, checkIn, checkOut, total, currency, language,
  }: {
    firstName: string; bookingReference: string; propertyName: string;
    city: string; checkIn: string; checkOut: string; total: string; currency: string;
    language?: string | null;
  }) {
    const loc = toMailLocale(language);
    const s = mailStrings(loc);
    const vars = { firstName, bookingReference, propertyName, city, checkIn, checkOut, total, currency };
    const tpl = (await getSetting("emailTemplates")).bookingConfirmation;
    const subject = renderTemplate(tpl.subject, vars);
    const bodyRendered = renderTemplate(bodyToHtml(tpl.body), vars);
    const html = layout(`
      ${bodyRendered}
      <table style="width:100%;margin:24px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;">${s.lblReference}</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(bookingReference)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblAccommodation}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(propertyName)}, ${escapeHtml(city)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblArrival}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkIn)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblDeparture}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkOut)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblTotal}</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(total)} ${escapeHtml(currency)}</td></tr>
      </table>
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },

  async bookingCancellation({
    firstName, bookingReference, propertyName, cancellationFee, currency, language,
  }: {
    firstName: string; bookingReference: string; propertyName: string;
    cancellationFee: string; currency: string; language?: string | null;
  }) {
    const loc = toMailLocale(language);
    const vars = { firstName, bookingReference, propertyName, cancellationFee, currency };
    const tpl = (await getSetting("emailTemplates")).bookingCancellation;
    const subject = renderTemplate(tpl.subject, vars);
    const bodyRendered = renderTemplate(bodyToHtml(tpl.body), vars);
    const html = layout(bodyRendered, loc);
    return { subject, html, text: stripHtml(html) };
  },

  /**
   * T-150 — Annulation notifiée à l'hôte (langue de l'hôte). Nouvel
   * événement, jamais édité par l'admin → contenu entièrement géré par la
   * plateforme et localisé fr/en (même approche que `priceAlert`).
   */
  bookingHostCancellation({
    hostFirstName, bookingReference, propertyName, guestName, checkIn, checkOut, reason, language,
  }: {
    hostFirstName: string; bookingReference: string; propertyName: string;
    guestName: string; checkIn: string; checkOut: string; reason?: string | null;
    language?: string | null;
  }) {
    const loc = toMailLocale(language);
    const s = mailStrings(loc);
    const vars = { hostFirstName, bookingReference, propertyName, guestName, checkIn, checkOut };
    const subject = renderTemplate(s.hostCancelSubject, vars);
    const bodyRendered = renderTemplate(bodyToHtml(s.hostCancelBody), vars);
    const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const html = layout(`
      ${bodyRendered}
      <table style="width:100%;margin:24px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;">${s.lblReference}</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(bookingReference)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblAccommodation}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(propertyName)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblGuest}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(guestName)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblArrival}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkIn)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblDeparture}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkOut)}</td></tr>
      </table>
      ${reason ? `<p style="font-size:13px;color:#666;">${s.lblReason} : ${escapeHtml(reason)}</p>` : ""}
      <p style="margin:24px 0;">${button(`${dashboardUrl}/dashboard/bookings`, s.hostCancelCta)}</p>
      <p>${s.hostDashboardHint} <a href="${escapeHtml(dashboardUrl)}/dashboard/bookings">${s.dashboard}</a>.</p>
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },

  /**
   * Rappel avant l'arrivée. Le même template sert pour J-3 et J-1 :
   * `daysLabel` porte la mention (« dans 3 jours » / « demain »), déjà
   * formulée dans la langue du destinataire par l'appelant.
   */
  async bookingReminder({
    firstName, bookingReference, propertyName, city, checkIn, checkOut, daysLabel, url, language,
  }: {
    firstName: string; bookingReference: string; propertyName: string;
    city: string; checkIn: string; checkOut: string; daysLabel: string; url: string;
    language?: string | null;
  }) {
    const loc = toMailLocale(language);
    const s = mailStrings(loc);
    const vars = { firstName, bookingReference, propertyName, city, checkIn, checkOut, daysLabel, url };
    const tpl = (await getSetting("emailTemplates")).bookingReminder;
    const subject = renderTemplate(tpl.subject, vars);
    const bodyRendered = renderTemplate(bodyToHtml(tpl.body), vars);
    const html = layout(`
      ${bodyRendered}
      <table style="width:100%;margin:24px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;">${s.lblReference}</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(bookingReference)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblAccommodation}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(propertyName)}, ${escapeHtml(city)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblArrival}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkIn)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblDeparture}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkOut)}</td></tr>
      </table>
      <p style="margin:24px 0;">${button(url, s.viewBooking)}</p>
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },

  /** Demande d'avis après un séjour terminé. */
  async reviewRequest({
    firstName, propertyName, bookingReference, url, language,
  }: { firstName: string; propertyName: string; bookingReference: string; url: string; language?: string | null }) {
    const loc = toMailLocale(language);
    const s = mailStrings(loc);
    const vars = { firstName, propertyName, bookingReference, url };
    const tpl = (await getSetting("emailTemplates")).reviewRequest;
    const subject = renderTemplate(tpl.subject, vars);
    const bodyRendered = renderTemplate(bodyToHtml(tpl.body), vars);
    const html = layout(`
      ${bodyRendered}
      <p style="margin:24px 0;">${button(url, s.leaveReview)}</p>
      <p style="font-size:13px;color:#666;">${s.reviewRequestRef} ${escapeHtml(bookingReference)}.</p>
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },

  /**
   * Alerte de prix sur un hébergement suivi. Gabarit entièrement géré par
   * la plateforme (le contenu dépend du devis calculé par le cron), donc
   * localisé dans la langue du destinataire.
   */
  priceAlert({
    firstName, propertyName, price, currency, maxPrice, offerLabel, url, language,
  }: {
    firstName: string; propertyName: string; price: string; currency: string;
    maxPrice: string; offerLabel: string; url: string; language?: string | null;
  }) {
    const loc = toMailLocale(language);
    const s = mailStrings(loc);
    const greeting = loc === "en" ? `Hi ${escapeHtml(firstName)},` : `Bonjour ${escapeHtml(firstName)},`;
    const subject = loc === "en" ? `Price alert: ${propertyName}` : `Alerte prix : ${propertyName}`;
    const offerLine = loc === "en"
      ? `<strong>${escapeHtml(propertyName)}</strong> is now available ${escapeHtml(offerLabel)} at <strong>${escapeHtml(price)} ${escapeHtml(currency)}</strong>, below your threshold of ${escapeHtml(maxPrice)} ${escapeHtml(currency)}.`
      : `<strong>${escapeHtml(propertyName)}</strong> est maintenant proposé ${escapeHtml(offerLabel)} à <strong>${escapeHtml(price)} ${escapeHtml(currency)}</strong>, sous votre seuil de ${escapeHtml(maxPrice)} ${escapeHtml(currency)}.`;
    const cta = loc === "en" ? "View the offer" : "Voir l'offre";
    const html = layout(`
      <p>${greeting}</p>
      <p>${offerLine}</p>
      <p style="margin:24px 0;">${button(url, cta)}</p>
      <p style="font-size:13px;color:#666;">${s.priceAlertFollowing}</p>
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },

  /**
   * T-150 — Notification de nouveau message (voyageur ↔ hôte).
   *
   * Langue du destinataire : sujet + corps « plateforme » + bouton sont
   * localisés fr/en. Si l'admin a personnalisé le bloc
   * `emailTemplates.newMessage` (différent des DEFAULTS), sa rédaction est
   * respectée telle quelle (compromis T-025 : contenu admin non traduit) ;
   * le bouton vers la conversation reste ajouté par la plateforme.
   */
  async newMessage({
    firstName, senderName, url, language,
  }: { firstName: string; senderName: string; url?: string; language?: string | null }) {
    const loc = toMailLocale(language);
    const s = mailStrings(loc);
    const vars = { firstName, senderName, url: url ?? "" };
    const tpl = (await getSetting("emailTemplates")).newMessage;
    const custom = tpl.subject !== DEFAULTS.emailTemplates.newMessage.subject
      || tpl.body !== DEFAULTS.emailTemplates.newMessage.body;
    const subject = renderTemplate(custom ? tpl.subject : s.newMessageSubject, vars);
    const bodySource = custom ? tpl.body : s.newMessageBody;
    const bodyRendered = renderTemplate(bodyToHtml(bodySource), vars);
    const cta = url
      ? `<p style="margin:24px 0;">${button(url, s.replyToMessage)}</p>`
      : "";
    const html = layout(`
      ${bodyRendered}
      ${cta}
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },

  async bookingHostNotification({
    hostFirstName, bookingReference, propertyName, guestName, checkIn, checkOut, language,
  }: {
    hostFirstName: string; bookingReference: string; propertyName: string;
    guestName: string; checkIn: string; checkOut: string; language?: string | null;
  }) {
    const loc = toMailLocale(language);
    const s = mailStrings(loc);
    const vars = { hostFirstName, bookingReference, propertyName, guestName, checkIn, checkOut };
    const tpl = (await getSetting("emailTemplates")).bookingHostNotification;
    const subject = renderTemplate(tpl.subject, vars);
    const bodyRendered = renderTemplate(bodyToHtml(tpl.body), vars);
    const dashboardUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
    const html = layout(`
      ${bodyRendered}
      <table style="width:100%;margin:24px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;">${s.lblReference}</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(bookingReference)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblAccommodation}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(propertyName)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblGuest}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(guestName)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblArrival}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkIn)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblDeparture}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkOut)}</td></tr>
      </table>
      <p>${s.hostDashboardHint} <a href="${escapeHtml(dashboardUrl)}/dashboard/bookings">${s.dashboard}</a>.</p>
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },
};
