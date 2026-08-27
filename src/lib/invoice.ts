import { formatDateShort } from "@/lib/utils";

/**
 * Factures / reçus (T-116).
 *
 * Génère un document HTML **imprimable** (l'utilisateur produit le PDF via
 * « Imprimer → Enregistrer en PDF » du navigateur). Aucune dépendance PDF
 * native (poids/sécurité) : le rendu est du HTML/CSS standard, fiable et
 * non régressif.
 *
 * Honnêteté juridique : tant que les mentions légales de la plateforme
 * (`companyLegalName`, SIRET/TVA…) ne sont pas renseignées dans les
 * réglages admin, le document est titré « REÇU / CONFIRMATION » et porte
 * une mention explicite : ce n'est PAS une facture fiscale. Dès que les
 * mentions sont présentes, il devient « FACTURE » avec numéro séquentiel.
 */

export interface InvoiceLegal {
  companyLegalName: string;
  companyLegalId: string;
  vatNumber: string;
  companyAddress: string;
  companyContactEmail: string;
  invoicePrefix: string;
  invoiceFooter: string;
}

export interface InvoiceBooking {
  bookingReference: string;
  createdAt: Date | string;
  checkIn: string;
  checkOut: string;
  numNights: number | null;
  numAdults: number;
  numChildren: number;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  propertyName: string;
  propertyCity: string | null;
  propertyCountry: string | null;
  subtotal: string;
  taxes: string | null;
  fees: string | null;
  discount: string | null;
  total: string;
  currency: string;
  status: string;
  paymentStatus: string | null;
}

export interface InvoiceData {
  isInvoice: boolean; // false → reçu/confirmation
  invoiceNumber: string;
  issuedOn: string;
  legal: InvoiceLegal;
  booking: InvoiceBooking;
  money: (v: string | number | null | undefined) => string;
}

function money(currency: string) {
  return (v: string | number | null | undefined): string => {
    const n = Number(v ?? 0);
    const locale = "fr-FR";
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
      }).format(n);
    } catch {
      return `${n.toFixed(2)} ${currency}`;
    }
  };
}

function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function buildInvoiceData(
  booking: InvoiceBooking,
  legal: InvoiceLegal,
): InvoiceData {
  const hasLegal =
    legal.companyLegalName.trim().length > 0 &&
    (legal.companyLegalId.trim().length > 0 || legal.vatNumber.trim().length > 0);
  const issuedOn = formatDateShort(booking.createdAt);
  // Numéro de facture déterministe et stable : préfixe + référence de
  // réservation (unique). Évite une table de séquence tout en garantissant
  // l'unicité et la traçabilité.
  // La référence est de la forme « MBB-2026-XXXXXX » : on retire « MBB- »
  // et l'année pour éviter un doublon quand le préfixe contient déjà 2026.
  const refTail = booking.bookingReference.replace(/^MBB-/, "").replace(/^\d{4}-/, "");
  const invoiceNumber = `${legal.invoicePrefix || "FAC-"}${refTail}`;
  return {
    isInvoice: hasLegal,
    invoiceNumber,
    issuedOn,
    legal,
    booking,
    money: money(booking.currency),
  };
}

function line(label: string, value: string, opts: { strong?: boolean; muted?: boolean } = {}) {
  return `
    <tr>
      <td style="padding:6px 0;${opts.strong ? "font-weight:700;" : ""}${opts.muted ? "color:#6b7280;" : ""}">${esc(label)}</td>
      <td style="padding:6px 0;text-align:right;${opts.strong ? "font-weight:700;font-size:16px;" : ""}${opts.muted ? "color:#6b7280;" : ""}">${esc(value)}</td>
    </tr>`;
}

export function renderInvoiceHtml(d: InvoiceData): string {
  const b = d.booking;
  const m = d.money;
  const title = d.isInvoice ? "FACTURE" : "REÇU / CONFIRMATION DE RÉSERVATION";
  const legalRows = [
    d.legal.companyAddress ? `<div>${esc(d.legal.companyAddress)}</div>` : "",
    d.legal.companyLegalId ? `<div>SIREN/ID : ${esc(d.legal.companyLegalId)}</div>` : "",
    d.legal.vatNumber ? `<div>TVA : ${esc(d.legal.vatNumber)}</div>` : "",
    d.legal.companyContactEmail ? `<div>${esc(d.legal.companyContactEmail)}</div>` : "",
  ].join("");

  const guestName = `${b.guestFirstName} ${b.guestLastName}`.trim();
  const travellers = `${b.numAdults} adulte${b.numAdults > 1 ? "s" : ""}${
    b.numChildren ? ` + ${b.numChildren} enfant${b.numChildren > 1 ? "s" : ""}` : ""
  }`;

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)} ${esc(b.bookingReference)}</title>
<style>
  @page { margin: 22mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Arial, sans-serif; color:#111827; margin:0; padding:32px; font-size:14px; line-height:1.5; }
  .brand { color:#1B3A6B; font-size:22px; font-weight:800; letter-spacing:-.02em; }
  .doc-kind { text-align:right; }
  .doc-kind h1 { font-size:20px; margin:0 0 4px; letter-spacing:.08em; color:#1B3A6B; }
  .doc-kind .num { color:#6b7280; font-size:13px; }
  .row { display:flex; justify-content:space-between; gap:24px; margin-top:24px; }
  .box { background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:16px 18px; flex:1; }
  .box h2 { font-size:12px; text-transform:uppercase; letter-spacing:.06em; color:#6b7280; margin:0 0 8px; }
  table { width:100%; border-collapse:collapse; margin-top:20px; }
  thead td { font-size:12px; text-transform:uppercase; letter-spacing:.05em; color:#6b7280; border-bottom:2px solid #e5e7eb; padding:8px 0; }
  .totals { margin-top:18px; margin-left:auto; width:320px; }
  .totals table { margin-top:0; }
  .note { margin-top:28px; padding:12px 14px; border-left:3px solid #F5A623; background:#fffbeb; font-size:12.5px; color:#78350f; border-radius:0 8px 8px 0; }
  .footer { margin-top:32px; padding-top:14px; border-top:1px solid #e5e7eb; color:#6b7280; font-size:12px; white-space:pre-wrap; }
  .printbar { position:fixed; top:0; left:0; right:0; background:#1B3A6B; color:#fff; text-align:center; padding:10px; }
  .printbar button { background:#fff; color:#1B3A6B; border:0; border-radius:8px; padding:8px 16px; font-weight:700; cursor:pointer; }
  @media print { .printbar { display:none; } body { padding:0; } }
</style>
</head>
<body>
  <div class="printbar">
    <button onclick="window.print()">🖨️ Imprimer / Enregistrer en PDF</button>
  </div>

  <div class="row" style="margin-top:40px;">
    <div>
      <div class="brand">${esc(d.legal.companyLegalName || "MyBestBooking")}</div>
      <div style="color:#6b7280; margin-top:4px;">Plateforme de réservation d'hébergements</div>
    </div>
    <div class="doc-kind">
      <h1>${esc(title)}</h1>
      ${d.isInvoice ? `<div class="num">N° ${esc(d.invoiceNumber)}</div>` : ""}
      <div class="num">Référence : ${esc(b.bookingReference)}</div>
      <div class="num">Émise le ${esc(d.issuedOn)}</div>
    </div>
  </div>

  <div class="row">
    <div class="box">
      <h2>Voyageur</h2>
      <div style="font-weight:600;">${esc(guestName)}</div>
      <div>${esc(b.guestEmail)}</div>
    </div>
    <div class="box">
      <h2>${d.isInvoice ? "Émetteur" : "Plateforme"}</h2>
      <div style="font-weight:600;">${esc(d.legal.companyLegalName || "MyBestBooking")}</div>
      ${legalRows || "<div style='color:#9ca3af;'>Mentions légales non configurées</div>"}
    </div>
  </div>

  <table>
    <thead>
      <tr><td>Description</td><td style="text-align:right;">Montant</td></tr>
    </thead>
    <tbody>
      <tr>
        <td style="padding:10px 0;">
          <div style="font-weight:600;">${esc(b.propertyName)}</div>
          <div style="color:#6b7280; font-size:13px;">
            ${esc(b.propertyCity ?? "")}${b.propertyCity && b.propertyCountry ? ", " : ""}${esc(b.propertyCountry ?? "")}
          </div>
          <div style="color:#6b7280; font-size:13px;">
            Du ${esc(formatDateShort(b.checkIn))} au ${esc(formatDateShort(b.checkOut))}
            (${b.numNights ?? "—"} nuit${(b.numNights ?? 0) > 1 ? "s" : ""} · ${esc(travellers)})
          </div>
        </td>
        <td style="text-align:right; vertical-align:top; padding-top:14px;">${m(b.subtotal)}</td>
      </tr>
    </tbody>
  </table>

  <div class="totals">
    <table>
      ${line("Sous-total hébergement", m(b.subtotal))}
      ${Number(b.taxes ?? 0) !== 0 ? line("Taxes", m(b.taxes)) : ""}
      ${Number(b.fees ?? 0) !== 0 ? line("Frais de service", m(b.fees)) : ""}
      ${Number(b.discount ?? 0) !== 0 ? line("Réduction", `−${m(b.discount)}`) : ""}
      ${line("Total", m(b.total), { strong: true })}
    </table>
  </div>

  ${
    d.isInvoice
      ? ""
      : `<div class="note">
          Ce document est un <strong>reçu de réservation</strong>, pas une facture
          fiscale : les mentions légales de l'émetteur (SIRET/TVA) ne sont pas
          encore configurées. Une facture conforme pourra être éditée dès que
          l'administrateur aura renseigné la société et les numéros légaux dans
          les réglages de facturation.
        </div>`
  }

  <div style="margin-top:24px; font-size:13px; color:#374151;">
    Statut de la réservation : <strong>${esc(b.status)}</strong>
    ${b.paymentStatus ? ` · Paiement : <strong>${esc(b.paymentStatus)}</strong>` : ""}
  </div>

  ${
    d.legal.invoiceFooter
      ? `<div class="footer">${esc(d.legal.invoiceFooter)}</div>`
      : `<div class="footer">Merci de votre confiance — MyBestBooking.</div>`
  }
</body>
</html>`;
}
