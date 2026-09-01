import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { bookings, properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { isUuid } from "@/lib/http";
import { getSetting } from "@/lib/settings";
import { apiError } from "@/lib/api-error";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import { buildInvoiceData, invoiceFilename, renderInvoiceHtml, type InvoiceLegal } from "@/lib/invoice";

/**
 * GET /api/bookings/[id]/invoice
 * Facture / reçu imprimable (HTML → PDF via le navigateur) — T-116.
 * Accès : propriétaire de la réservation, hôte du bien concerné, ou admin.
 *
 * `?format=json` → données structurées (pour la page embarquée).
 * Par défaut → document HTML complet (ouverture/impression directe).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });

  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: await apiError("Identifiant invalide") }, { status: 400 });
  const [result] = await db
    .select({ booking: bookings, property: properties })
    .from(bookings)
    .leftJoin(properties, eq(bookings.propertyId, properties.id))
    .where(eq(bookings.id, id))
    .limit(1);

  if (!result) return NextResponse.json({ error: await apiError("Réservation non trouvée") }, { status: 404 });

  const isOwner = result.booking.userId === user.id;
  const isHost = result.property?.hostId === user.id;
  if (!isOwner && !isHost && user.role !== "admin") {
    return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 403 });
  }

  const locale = await getServerLocale();
  const t = makeT(locale);
  const billing = await getSetting("billing");
  const legal: InvoiceLegal = {
    companyLegalName: billing.companyLegalName ?? "",
    companyLegalId: billing.companyLegalId ?? "",
    vatNumber: billing.vatNumber ?? "",
    companyAddress: billing.companyAddress ?? "",
    companyContactEmail: billing.companyContactEmail ?? "",
    invoicePrefix: billing.invoicePrefix ?? "FAC-",
    invoiceFooter: billing.invoiceFooter ?? "",
  };

  const data = buildInvoiceData(
    {
      bookingReference: result.booking.bookingReference,
      createdAt: result.booking.createdAt,
      checkIn: result.booking.checkIn,
      checkOut: result.booking.checkOut,
      numNights: result.booking.numNights,
      numAdults: result.booking.numAdults,
      numChildren: result.booking.numChildren ?? 0,
      guestFirstName: result.booking.guestFirstName,
      guestLastName: result.booking.guestLastName,
      guestEmail: result.booking.guestEmail,
      propertyName: result.property?.name ?? t("inv.propertyFallback"),
      propertyCity: result.property?.city ?? null,
      propertyCountry: result.property?.country ?? null,
      subtotal: result.booking.subtotal,
      taxes: result.booking.taxes,
      fees: result.booking.fees,
      discount: result.booking.discount,
      total: result.booking.total,
      currency: result.booking.currency,
      status: result.booking.status,
      paymentStatus: result.booking.paymentStatus,
    },
    legal,
    locale,
  );

  const wantJson = new URL(request.url).searchParams.get("format") === "json";
  if (wantJson) {
    return NextResponse.json({
      isInvoice: data.isInvoice,
      invoiceNumber: data.invoiceNumber,
      issuedOn: data.issuedOn,
    });
  }

  const html = renderInvoiceHtml(data);
  const filename = invoiceFilename(data);
  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `inline; filename="${filename}"`,
      // Ne pas indexer ni mettre en cache un document personnel.
      "X-Robots-Tag": "noindex",
      "Cache-Control": "no-store",
    },
  });
}
