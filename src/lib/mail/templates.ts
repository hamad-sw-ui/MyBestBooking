/**
 * Templates d'emails MyBestBooking (T-013).
 * T-025 : le sujet et le paragraphe principal (`body`) de chaque
 * template sont éditables via `app_settings.emailTemplates`. Le
 * layout HTML (branding, boutons, disclaimer) reste figé.
 * T-171 : si le bloc admin est encore égal aux DEFAULTS FR, on envoie
 * la copie localisée (langue du destinataire). Une rédaction custom
 * n'est pas traduite.
 *
 * Placeholders `{name}` supportés — voir DEFAULTS dans
 * `src/lib/settings.ts` pour la liste par template.
 */

import { getSetting, DEFAULTS } from "@/lib/settings";
import { renderTemplate, escapeHtml } from "./render";
import { toMailLocale, mailStrings, type MailLocale } from "./strings";
// T-165 (audit n°30) : URL de base unique — jamais de lien relatif dans
// un e-mail (repli absolu documenté si NEXT_PUBLIC_APP_URL manque).
import { appBaseUrl } from "@/lib/app-url";

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

function formatMailDateTime(value: Date | string | null | undefined, locale: MailLocale): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date)} UTC`;
}

type EditableBlock = { subject: string; body: string };

/**
 * T-171 — DEFAULTS FR non personnalisés → copie plateforme (fr/en).
 * Rédaction admin différente des DEFAULTS → telle quelle.
 */
function pickEditable(
  admin: EditableBlock,
  fallbackFr: EditableBlock,
  platform: EditableBlock,
): EditableBlock {
  const custom =
    admin.subject !== fallbackFr.subject || admin.body !== fallbackFr.body;
  return custom ? admin : platform;
}

export const templates = {
  async emailVerification({ firstName, url, language }: { firstName: string; url: string; language?: string | null }) {
    const loc = toMailLocale(language);
    const s = mailStrings(loc);
    const tpl = pickEditable(
      (await getSetting("emailTemplates")).emailVerification,
      DEFAULTS.emailTemplates.emailVerification,
      { subject: s.verifySubject, body: s.verifyBody },
    );
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
    const tpl = pickEditable(
      (await getSetting("emailTemplates")).passwordReset,
      DEFAULTS.emailTemplates.passwordReset,
      { subject: s.resetSubject, body: s.resetBody },
    );
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
    const tpl = pickEditable(
      (await getSetting("emailTemplates")).welcomeEmail,
      DEFAULTS.emailTemplates.welcomeEmail,
      { subject: s.welcomeSubject, body: s.welcomeBody },
    );
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

  bookingRequestTraveler({
    firstName, bookingReference, propertyName, city, checkIn, checkOut, total, currency, requestExpiresAt, estimatedArrival, language,
  }: {
    firstName: string; bookingReference: string; propertyName: string;
    city: string; checkIn: string; checkOut: string; total: string; currency: string;
    requestExpiresAt?: Date | string | null; language?: string | null;
    /** T-236 : heure d'arrivée estimée (`HH:MM`), affichée si fournie. */
    estimatedArrival?: string | null;
  }) {
    const loc = toMailLocale(language);
    const s = mailStrings(loc);
    const vars = { firstName, bookingReference, propertyName, city, checkIn, checkOut, total, currency };
    const subject = renderTemplate(s.requestTravelerSubject, vars);
    const bodyRendered = renderTemplate(bodyToHtml(s.requestTravelerBody), vars);
    const url = `${appBaseUrl()}/mes-reservations`;
    const expires = formatMailDateTime(requestExpiresAt, loc);
    const html = layout(`
      ${bodyRendered}
      <table style="width:100%;margin:24px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;">${s.lblReference}</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(bookingReference)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblAccommodation}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(propertyName)}, ${escapeHtml(city)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblArrival}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkIn)}</td></tr>
        ${estimatedArrival ? `<tr><td style="padding:8px 0;color:#666;">${s.lblEstimatedArrival}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(estimatedArrival)}</td></tr>` : ""}
        <tr><td style="padding:8px 0;color:#666;">${s.lblDeparture}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkOut)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblTotal}</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(total)} ${escapeHtml(currency)}</td></tr>
        ${expires ? `<tr><td style="padding:8px 0;color:#666;">${s.lblRequestExpires}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(expires)}</td></tr>` : ""}
      </table>
      <p style="margin:24px 0;">${button(url, s.requestCtaTraveler)}</p>
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },

  bookingRequestHost({
    hostFirstName, bookingReference, propertyName, guestName, checkIn, checkOut, requestExpiresAt, estimatedArrival, language,
  }: {
    hostFirstName: string; bookingReference: string; propertyName: string;
    guestName: string; checkIn: string; checkOut: string;
    requestExpiresAt?: Date | string | null; language?: string | null;
    /** T-236 : heure d'arrivée estimée (`HH:MM`), affichée si fournie. */
    estimatedArrival?: string | null;
  }) {
    const loc = toMailLocale(language);
    const s = mailStrings(loc);
    const vars = { hostFirstName, bookingReference, propertyName, guestName, checkIn, checkOut };
    const subject = renderTemplate(s.requestHostSubject, vars);
    const bodyRendered = renderTemplate(bodyToHtml(s.requestHostBody), vars);
    const dashboardUrl = `${appBaseUrl()}/dashboard/bookings`;
    const expires = formatMailDateTime(requestExpiresAt, loc);
    const html = layout(`
      ${bodyRendered}
      <table style="width:100%;margin:24px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;">${s.lblReference}</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(bookingReference)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblAccommodation}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(propertyName)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblGuest}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(guestName)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblArrival}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkIn)}</td></tr>
        ${estimatedArrival ? `<tr><td style="padding:8px 0;color:#666;">${s.lblEstimatedArrival}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(estimatedArrival)}</td></tr>` : ""}
        <tr><td style="padding:8px 0;color:#666;">${s.lblDeparture}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkOut)}</td></tr>
        ${expires ? `<tr><td style="padding:8px 0;color:#666;">${s.lblRequestExpires}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(expires)}</td></tr>` : ""}
      </table>
      <p style="margin:24px 0;">${button(dashboardUrl, s.requestCtaHost)}</p>
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },

  async bookingConfirmation({
    firstName, bookingReference, propertyName, city, checkIn, checkOut, total, currency, estimatedArrival, language,
  }: {
    firstName: string; bookingReference: string; propertyName: string;
    city: string; checkIn: string; checkOut: string; total: string; currency: string;
    language?: string | null;
    /** T-236 : heure d'arrivée estimée (`HH:MM`), affichée si fournie. */
    estimatedArrival?: string | null;
  }) {
    const loc = toMailLocale(language);
    const s = mailStrings(loc);
    const vars = { firstName, bookingReference, propertyName, city, checkIn, checkOut, total, currency };
    const tpl = pickEditable(
      (await getSetting("emailTemplates")).bookingConfirmation,
      DEFAULTS.emailTemplates.bookingConfirmation,
      { subject: s.bookingConfirmSubject, body: s.bookingConfirmBody },
    );
    const subject = renderTemplate(tpl.subject, vars);
    const bodyRendered = renderTemplate(bodyToHtml(tpl.body), vars);
    const html = layout(`
      ${bodyRendered}
      <table style="width:100%;margin:24px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;">${s.lblReference}</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(bookingReference)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblAccommodation}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(propertyName)}, ${escapeHtml(city)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblArrival}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkIn)}</td></tr>
        ${estimatedArrival ? `<tr><td style="padding:8px 0;color:#666;">${s.lblEstimatedArrival}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(estimatedArrival)}</td></tr>` : ""}
        <tr><td style="padding:8px 0;color:#666;">${s.lblDeparture}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkOut)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblTotal}</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(total)} ${escapeHtml(currency)}</td></tr>
      </table>
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },

  async bookingCancellation({
    firstName, bookingReference, propertyName, cancellationFee, currency, refundLine, language,
  }: {
    firstName: string; bookingReference: string; propertyName: string;
    cancellationFee: string; currency: string;
    /** T-266 (audit n°7, C2) : ligne de remboursement (montant + modalité),
     *  calculée par l'appelant ; `null` = aucun remboursement dû (la ligne
     *  est alors absente, gabarits existants inchangés). */
    refundLine?: string | null;
    language?: string | null;
  }) {
    const loc = toMailLocale(language);
    const s = mailStrings(loc);
    const vars = { firstName, bookingReference, propertyName, cancellationFee, currency };
    const tpl = pickEditable(
      (await getSetting("emailTemplates")).bookingCancellation,
      DEFAULTS.emailTemplates.bookingCancellation,
      { subject: s.cancelSubject, body: s.cancelBody },
    );
    const subject = renderTemplate(tpl.subject, vars);
    // La ligne est ajoutée par la plateforme (pas un placeholder du gabarit
    // admin) : un gabarit personnalisé qui ne la référence pas reste valide.
    const body = refundLine ? `${tpl.body}\n\n${refundLine}` : tpl.body;
    const bodyRendered = renderTemplate(bodyToHtml(body), vars);
    const html = layout(bodyRendered, loc);
    return { subject, html, text: stripHtml(html) };
  },

  /**
   * T-156 (audit n°29) — annulation par l'HÉBERGEUR ou l'ADMINISTRATEUR.
   * Contenu entièrement géré par la plateforme (comme `bookingHostCancellation`)
   * et localisé fr/en : le voyageur n'est jamais pénalisé — remboursement
   * intégral annoncé explicitement. Le template admin `bookingCancellation`
   * (frais variables) reste utilisé pour les annulations par le voyageur.
   */
  async bookingCancelledByOperator({
    firstName, bookingReference, propertyName, refundAmount, currency, actor, language,
  }: {
    firstName: string; bookingReference: string; propertyName: string;
    refundAmount: string; currency: string; actor: "host" | "admin";
    language?: string | null;
  }) {
    const loc = toMailLocale(language);
    const s = mailStrings(loc);
    const vars = { firstName, bookingReference, propertyName, refundAmount, currency };
    const subject = actor === "admin"
      ? renderTemplate(s.operatorCancelAdminSubject, vars)
      : renderTemplate(s.operatorCancelHostSubject, vars);
    const body = actor === "admin"
      ? renderTemplate(bodyToHtml(s.operatorCancelAdminBody), vars)
      : renderTemplate(bodyToHtml(s.operatorCancelHostBody), vars);
    const html = layout(`
      ${body}
      <p style="margin:16px 0 4px;font-size:13px;color:#666;">${s.lblFullRefund} — ${escapeHtml(refundAmount)} ${escapeHtml(currency)}</p>
      <table style="width:100%;margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;">${s.lblReference}</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(bookingReference)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblAccommodation}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(propertyName)}</td></tr>
      </table>
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },

  /**
   * T-272 (audit n°8, F2) — no-show notifié au voyageur (langue du voyageur).
   * Constat : la transition `→ no_show` (hôte) ne produisait aucun e-mail —
   * le voyageur découvrait l'état terminal (et la perte de cashback) seul,
   * sans modalité. Nouvel événement, jamais édité par l'admin → contenu
   * entièrement géré par la plateforme et localisé fr/en (même approche que
   * `bookingHostCancellation`). E-mail transactionnel : hors préférences
   * utilisateur (T-261), sous l'interrupteur admin `bookingNoShow`.
   */
  noShow({
    firstName, bookingReference, propertyName, checkIn, checkOut, language,
  }: {
    firstName: string; bookingReference: string; propertyName: string;
    checkIn: string; checkOut: string; language?: string | null;
  }) {
    const loc = toMailLocale(language);
    const s = mailStrings(loc);
    const vars = { firstName, bookingReference, propertyName, checkIn, checkOut };
    const subject = renderTemplate(s.noShowSubject, vars);
    const body = renderTemplate(bodyToHtml(s.noShowBody), vars);
    const dashboardUrl = appBaseUrl();
    const html = layout(`
      ${body}
      <table style="width:100%;margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;">${s.lblReference}</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(bookingReference)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblAccommodation}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(propertyName)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblArrival}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkIn)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblDeparture}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkOut)}</td></tr>
      </table>
      <p style="margin:24px 0;">${button(`${dashboardUrl}/mes-reservations`, s.noShowCta)}</p>
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },

  /**
   * T-273 (audit n°8, F3) — remboursement finalisé hors plateforme, confirmé
   * à l'hôte/admin (langue du voyageur). Constat : `refundStatus` ne devenait
   * `refunded` que par le webhook Stripe ; un paiement sur place remboursé
   * manuellement restait « à traiter » à vie. E-mail transactionnel (état
   * comptable terminal) — jamais édité par l'admin, localisé fr/en.
   */
  bookingRefundFinalized({
    firstName, bookingReference, propertyName, refundAmount, currency, language,
  }: {
    firstName: string; bookingReference: string; propertyName: string;
    refundAmount: string; currency: string; language?: string | null;
  }) {
    const loc = toMailLocale(language);
    const s = mailStrings(loc);
    const vars = { firstName, bookingReference, propertyName, refundAmount, currency };
    const subject = renderTemplate(s.refundFinalizedSubject, vars);
    const body = renderTemplate(bodyToHtml(s.refundFinalizedBody), vars);
    const html = layout(`
      ${body}
      <p style="margin:16px 0 4px;font-size:13px;color:#666;">${s.lblFullRefund} — ${escapeHtml(refundAmount)} ${escapeHtml(currency)}</p>
      <table style="width:100%;margin:16px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;">${s.lblReference}</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(bookingReference)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblAccommodation}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(propertyName)}</td></tr>
      </table>
    `, loc);
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
    const dashboardUrl = appBaseUrl();
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
    const tpl = pickEditable(
      (await getSetting("emailTemplates")).bookingReminder,
      DEFAULTS.emailTemplates.bookingReminder,
      { subject: s.reminderSubject, body: s.reminderBody },
    );
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
    const tpl = pickEditable(
      (await getSetting("emailTemplates")).reviewRequest,
      DEFAULTS.emailTemplates.reviewRequest,
      { subject: s.reviewSubject, body: s.reviewBody },
    );
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
    firstName, propertyName, price, currency, maxPrice, offerLabel, url, language, unsubscribeUrl,
  }: {
    firstName: string; propertyName: string; price: string; currency: string;
    maxPrice: string; offerLabel: string; url: string; language?: string | null;
    /** T-239 : lien d'opposition (e-mail non transactionnel). */
    unsubscribeUrl?: string | null;
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
      ${unsubscribeUrl
        ? `<p style="font-size:12px;color:#888;margin-top:16px;">
             <a href="${escapeHtml(unsubscribeUrl)}" style="color:#888;">${s.unsubscribeLink}</a>
           </p>`
        : ""}
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
    const tpl = pickEditable(
      (await getSetting("emailTemplates")).newMessage,
      DEFAULTS.emailTemplates.newMessage,
      { subject: s.newMessageSubject, body: s.newMessageBody },
    );
    const subject = renderTemplate(tpl.subject, vars);
    const bodyRendered = renderTemplate(bodyToHtml(tpl.body), vars);
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
    hostFirstName, bookingReference, propertyName, guestName, checkIn, checkOut, estimatedArrival, language,
  }: {
    hostFirstName: string; bookingReference: string; propertyName: string;
    guestName: string; checkIn: string; checkOut: string; language?: string | null;
    /** T-236 : heure d'arrivée estimée (`HH:MM`), affichée si fournie. */
    estimatedArrival?: string | null;
  }) {
    const loc = toMailLocale(language);
    const s = mailStrings(loc);
    const vars = { hostFirstName, bookingReference, propertyName, guestName, checkIn, checkOut };
    const tpl = pickEditable(
      (await getSetting("emailTemplates")).bookingHostNotification,
      DEFAULTS.emailTemplates.bookingHostNotification,
      { subject: s.hostNotifSubject, body: s.hostNotifBody },
    );
    const subject = renderTemplate(tpl.subject, vars);
    const bodyRendered = renderTemplate(bodyToHtml(tpl.body), vars);
    const dashboardUrl = appBaseUrl();
    const html = layout(`
      ${bodyRendered}
      <table style="width:100%;margin:24px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;">${s.lblReference}</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(bookingReference)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblAccommodation}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(propertyName)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblGuest}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(guestName)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblArrival}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkIn)}</td></tr>
        ${estimatedArrival ? `<tr><td style="padding:8px 0;color:#666;">${s.lblEstimatedArrival}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(estimatedArrival)}</td></tr>` : ""}
        <tr><td style="padding:8px 0;color:#666;">${s.lblDeparture}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkOut)}</td></tr>
      </table>
      <p>${s.hostDashboardHint} <a href="${escapeHtml(dashboardUrl)}/dashboard/bookings">${s.dashboard}</a>.</p>
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },
  /**
   * T-221 (audit n°2) — demande de réservation expirée faute de réponse de
   * l'hôte. Gabarit entièrement géré par la plateforme (aucun bloc admin) :
   * le cron d'expiration l'envoie au voyageur avec une issue de secours
   * (relancer une recherche), jamais un simple constat d'échec.
   */
  bookingRequestExpired({
    firstName, bookingReference, propertyName, city, checkIn, checkOut, language,
  }: {
    firstName: string; bookingReference: string; propertyName: string; city: string;
    checkIn: string; checkOut: string; language?: string | null;
  }) {
    const loc = toMailLocale(language);
    const s = mailStrings(loc);
    const greeting = loc === "en" ? `Hi ${escapeHtml(firstName)},` : `Bonjour ${escapeHtml(firstName)},`;
    const subject = loc === "en"
      ? `Booking request expired ${bookingReference}`
      : `Demande de réservation expirée ${bookingReference}`;
    const intro = loc === "en"
      ? `Your request for <strong>${escapeHtml(propertyName)}</strong> (${escapeHtml(city)}) has expired: the host did not confirm it in time. No payment was requested and nothing is owed.`
      : `Votre demande pour <strong>${escapeHtml(propertyName)}</strong> (${escapeHtml(city)}) a expiré : l'hôte ne l'a pas confirmée dans le délai. Aucun paiement n'a été demandé et rien ne vous est dû.`;
    const next = loc === "en"
      ? "The dates are available again — you can send a new request or explore similar properties."
      : "Les dates sont de nouveau disponibles : vous pouvez envoyer une nouvelle demande ou explorer des hébergements similaires.";
    const cta = loc === "en" ? "Search again" : "Relancer une recherche";
    const html = layout(`
      <p>${greeting}</p>
      <p>${intro}</p>
      <p>${next}</p>
      <table style="width:100%;margin:24px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;">${s.lblReference}</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(bookingReference)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblAccommodation}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(propertyName)}, ${escapeHtml(city)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblArrival}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkIn)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblDeparture}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkOut)}</td></tr>
      </table>
      <p style="margin:24px 0;">${button(`${appBaseUrl()}/recherche`, cta)}</p>
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },

  /**
   * T-221 (audit n°2) — copie hôte : une demande a expiré et le stock est
   * libéré. Informatif, aucun engagement : l'hôte sait ce qu'il a manqué.
   */
  bookingRequestExpiredHost({
    hostFirstName, bookingReference, propertyName, guestName, checkIn, checkOut, language,
  }: {
    hostFirstName: string; bookingReference: string; propertyName: string;
    guestName: string; checkIn: string; checkOut: string; language?: string | null;
  }) {
    const loc = toMailLocale(language);
    const s = mailStrings(loc);
    const greeting = loc === "en" ? `Hi ${escapeHtml(hostFirstName)},` : `Bonjour ${escapeHtml(hostFirstName)},`;
    const subject = loc === "en"
      ? `Booking request expired ${bookingReference}`
      : `Demande de réservation expirée ${bookingReference}`;
    const intro = loc === "en"
      ? `The request from <strong>${escapeHtml(guestName)}</strong> for <strong>${escapeHtml(propertyName)}</strong> expired before confirmation. The dates are available again; the traveller was informed.`
      : `La demande de <strong>${escapeHtml(guestName)}</strong> pour <strong>${escapeHtml(propertyName)}</strong> a expiré avant confirmation. Les dates sont de nouveau disponibles et le voyageur a été informé.`;
    const hint = loc === "en"
      ? "Tip: requests expire automatically. You can confirm or decline them from your dashboard."
      : "Astuce : les demandes expirent automatiquement. Vous pouvez les confirmer ou les refuser depuis votre tableau de bord.";
    const cta = loc === "en" ? "Open bookings" : "Ouvrir les réservations";
    const html = layout(`
      <p>${greeting}</p>
      <p>${intro}</p>
      <table style="width:100%;margin:24px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;">${s.lblReference}</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(bookingReference)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblAccommodation}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(propertyName)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblGuest}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(guestName)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblArrival}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkIn)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblDeparture}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkOut)}</td></tr>
      </table>
      <p>${hint}</p>
      <p style="margin:24px 0;">${button(`${appBaseUrl()}/dashboard/bookings?status=pending`, cta)}</p>
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },

  /**
   * T-222 (audit n°2) — relance « séjour terminé, règlement non constaté ».
   * Un e-mail par séjour (idempotence par `eventKey`), envoyé à l'hôte
   * propriétaire : sans constatation, la clôture, la fidélité, l'invitation
   * d'avis et la facture restent bloquées.
   */
  bookingPaymentReminder({
    hostFirstName, bookingReference, propertyName, guestName, checkOut, total, currency, language,
  }: {
    hostFirstName: string; bookingReference: string; propertyName: string; guestName: string;
    checkOut: string; total: string; currency: string; language?: string | null;
  }) {
    const loc = toMailLocale(language);
    const s = mailStrings(loc);
    const greeting = loc === "en" ? `Hi ${escapeHtml(hostFirstName)},` : `Bonjour ${escapeHtml(hostFirstName)},`;
    const subject = loc === "en"
      ? `Settlement to confirm — ${bookingReference}`
      : `Règlement à constater — ${bookingReference}`;
    const intro = loc === "en"
      ? `The stay booked by <strong>${escapeHtml(guestName)}</strong> at <strong>${escapeHtml(propertyName)}</strong> ended on ${escapeHtml(checkOut)} and the settlement is still marked as pending.`
      : `Le séjour réservé par <strong>${escapeHtml(guestName)}</strong> à <strong>${escapeHtml(propertyName)}</strong> s'est terminé le ${escapeHtml(checkOut)} et le règlement est toujours en attente.`;
    const why = loc === "en"
      ? "Confirming it unlocks the stay closure, the traveller's loyalty credit, the review invitation and the invoice."
      : "Le constater débloque la clôture du séjour, les points de fidélité du voyageur, l'invitation à laisser un avis et la facture.";
    const cta = loc === "en" ? "Mark as settled" : "Constater le règlement";
    const html = layout(`
      <p>${greeting}</p>
      <p>${intro}</p>
      <table style="width:100%;margin:24px 0;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#666;">${s.lblReference}</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(bookingReference)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblAccommodation}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(propertyName)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblGuest}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(guestName)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblDeparture}</td><td style="padding:8px 0;text-align:right;">${escapeHtml(checkOut)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">${s.lblTotal}</td><td style="padding:8px 0;text-align:right;font-weight:600;">${escapeHtml(total)} ${escapeHtml(currency)}</td></tr>
      </table>
      <p>${why}</p>
      <p style="margin:24px 0;">${button(`${appBaseUrl()}/dashboard/bookings?payment=due`, cta)}</p>
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },

  /**
   * T-225 (audit n°2) — nouvel avis publié : l'hôte en est informé (il peut
   * répondre depuis son back-office). Gabarit plateforme localisé.
   */
  reviewPublished({
    hostFirstName, propertyName, rating, comment, language,
  }: {
    hostFirstName: string; propertyName: string; rating: number;
    comment?: string | null; language?: string | null;
  }) {
    const loc = toMailLocale(language);
    const greeting = loc === "en" ? `Hi ${escapeHtml(hostFirstName)},` : `Bonjour ${escapeHtml(hostFirstName)},`;
    const subject = loc === "en"
      ? `New review for ${propertyName}`
      : `Nouvel avis sur ${propertyName}`;
    const intro = loc === "en"
      ? `A verified traveller published a review for <strong>${escapeHtml(propertyName)}</strong>.`
      : `Un voyageur vérifié a publié un avis sur <strong>${escapeHtml(propertyName)}</strong>.`;
    const excerpt = comment
      ? `<p style="border-left:3px solid #1B3A6B;padding-left:12px;color:#444;">${escapeHtml(comment.slice(0, 400))}</p>`
      : "";
    const cta = loc === "en" ? "View and reply" : "Voir et répondre";
    const html = layout(`
      <p>${greeting}</p>
      <p>${intro}</p>
      <p style="font-size:20px;font-weight:700;margin:12px 0;">${escapeHtml(String(rating))}/10</p>
      ${excerpt}
      <p style="margin:24px 0;">${button(`${appBaseUrl()}/dashboard/reviews`, cta)}</p>
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },

  /**
   * T-225 (audit n°2) — issue de la modération communiquée à l'auteur de
   * l'avis : sans ce message, un avis refusé disparaît silencieusement.
   */
  reviewModerated({
    firstName, propertyName, bookingReference, approved, language,
  }: {
    firstName: string; propertyName: string; bookingReference: string;
    approved: boolean; language?: string | null;
  }) {
    const loc = toMailLocale(language);
    const greeting = loc === "en" ? `Hi ${escapeHtml(firstName)},` : `Bonjour ${escapeHtml(firstName)},`;
    const subject = approved
      ? (loc === "en" ? `Your review is published — ${propertyName}` : `Votre avis est publié — ${propertyName}`)
      : (loc === "en" ? `Your review was not published — ${propertyName}` : `Votre avis n'a pas été publié — ${propertyName}`);
    const intro = approved
      ? (loc === "en"
        ? `Your review for <strong>${escapeHtml(propertyName)}</strong> has been approved and is now visible on the property page. Thank you!`
        : `Votre avis sur <strong>${escapeHtml(propertyName)}</strong> a été validé et est désormais visible sur la fiche de l'hébergement. Merci !`)
      : (loc === "en"
        ? `Your review for <strong>${escapeHtml(propertyName)}</strong> could not be published after moderation. Booking ${escapeHtml(bookingReference)} stays in your history.`
        : `Votre avis sur <strong>${escapeHtml(propertyName)}</strong> n'a pas pu être publié après modération. La réservation ${escapeHtml(bookingReference)} reste dans votre historique.`);
    const hint = loc === "en"
      ? "If you think this is a mistake, contact support with your booking reference."
      : "Si vous pensez qu'il s'agit d'une erreur, contactez le support en indiquant votre référence de réservation.";
    const html = layout(`
      <p>${greeting}</p>
      <p>${intro}</p>
      <p style="font-size:13px;color:#666;">${hint}</p>
      <p style="margin:24px 0;">${button(`${appBaseUrl()}/mes-reservations`, loc === "en" ? "My bookings" : "Mes réservations")}</p>
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },

  /**
   * T-237 (audit n°3, F6) — décision de validation d'annonce.
   *
   * L'admin écrivait le motif dans `audit_log` uniquement : l'hôte voyait son
   * annonce repasser en `draft` sans savoir pourquoi, et ne recevait aucun
   * message. Ces deux gabarits sont envoyés à l'hôte (idempotents côté route
   * via `eventKey`), avec le motif éventuel.
   */
  propertyApproved({ hostFirstName, propertyName, url, language }: {
    hostFirstName: string; propertyName: string; url: string; language?: string | null;
  }) {
    const loc = toMailLocale(language);
    const greeting = loc === "en" ? `Hi ${escapeHtml(hostFirstName)},` : `Bonjour ${escapeHtml(hostFirstName)},`;
    const subject = loc === "en"
      ? `Your listing ${propertyName} is online`
      : `Votre annonce ${propertyName} est en ligne`;
    const intro = loc === "en"
      ? `Your listing <strong>${escapeHtml(propertyName)}</strong> has been approved and is now visible to travellers.`
      : `Votre annonce <strong>${escapeHtml(propertyName)}</strong> a été validée et est désormais visible par les voyageurs.`;
    const cta = loc === "en" ? "View my listing" : "Voir mon annonce";
    const html = layout(`
      <p>${greeting}</p>
      <p>${intro}</p>
      <p style="margin:24px 0;">${button(url, cta)}</p>
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },

  propertyRejected({ hostFirstName, propertyName, reason, url, language }: {
    hostFirstName: string; propertyName: string; reason?: string | null;
    url: string; language?: string | null;
  }) {
    const loc = toMailLocale(language);
    const greeting = loc === "en" ? `Hi ${escapeHtml(hostFirstName)},` : `Bonjour ${escapeHtml(hostFirstName)},`;
    const subject = loc === "en"
      ? `Changes required for ${propertyName}`
      : `Des modifications sont nécessaires pour ${propertyName}`;
    const intro = loc === "en"
      ? `Your listing <strong>${escapeHtml(propertyName)}</strong> was not approved. It stays in draft until you update it and submit it again.`
      : `Votre annonce <strong>${escapeHtml(propertyName)}</strong> n'a pas été validée. Elle reste en brouillon tant que vous ne l'avez pas corrigée et soumise à nouveau.`;
    const reasonBlock = reason && reason.trim().length > 0
      ? `<p style="border-left:3px solid #B42318;padding-left:12px;color:#444;"><strong>${loc === "en" ? "Reason" : "Motif"} :</strong> ${escapeHtml(reason.slice(0, 500))}</p>`
      : "";
    const cta = loc === "en" ? "Edit and resubmit" : "Corriger et soumettre";
    const html = layout(`
      <p>${greeting}</p>
      <p>${intro}</p>
      ${reasonBlock}
      <p style="margin:24px 0;">${button(url, cta)}</p>
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },

  /**
   * T-231 (audit n°2, A11) — le support a réinitialisé la 2FA du compte.
   * L'utilisateur doit le savoir immédiatement (facteur retiré + sessions
   * coupées) et pouvoir réactiver la double authentification lui-même.
   */
  twoFactorReset({
    firstName, url, language,
  }: { firstName: string; url: string; language?: string | null }) {
    const loc = toMailLocale(language);
    const greeting = loc === "en" ? `Hi ${escapeHtml(firstName)},` : `Bonjour ${escapeHtml(firstName)},`;
    const subject = loc === "en"
      ? "Two-factor authentication was reset"
      : "Double authentification réinitialisée";
    const intro = loc === "en"
      ? "Our support team has reset the two-factor authentication on your account. Your active sessions have been signed out and your previous authenticator codes no longer work."
      : "Notre support a réinitialisé la double authentification de votre compte. Vos sessions actives ont été déconnectées et vos anciens codes ne fonctionnent plus.";
    const advice = loc === "en"
      ? "If you did not request this, change your password immediately and contact support."
      : "Si vous n'êtes pas à l'origine de cette demande, changez votre mot de passe immédiatement et contactez le support.";
    const cta = loc === "en" ? "Sign in" : "Se connecter";
    const html = layout(`
      <p>${greeting}</p>
      <p>${intro}</p>
      <p style="color:#B42318;">${advice}</p>
      <p style="margin:24px 0;">${button(url, cta)}</p>
    `, loc);
    return { subject, html, text: stripHtml(html) };
  },
};
