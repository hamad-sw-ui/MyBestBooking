import type { Metadata } from "next";
import Script from "next/script";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { properties, rooms, reviews, users, bookings, roomAvailability } from "@/db/schema";
import { eq, and, desc, inArray, lt, gt, ne, gte } from "drizzle-orm";
import { stayDatesFromPropertyQuery } from "@/lib/room-remaining";
import { evaluateBookingRules } from "@/lib/booking-rules";
import { publicCatalogCache } from "@/lib/read-cache";
import { SmartImage } from "@/components/ui/smart-image";
import { getCurrentUser } from "@/lib/auth";
import { getRatingLabel, getPropertyTypeLabel } from "@/lib/utils";
import { countryLabel } from "@/lib/country-label";
import { safeJsonForScript } from "@/lib/safe-json-ld";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  // T-158 (audit n°29) : métadonnées localisées (le <title> restait FR pour
  // un visiteur anonyme en EN — le SSR ne connaissait pas sa langue).
  const locale = await getServerLocale();
  const t = makeT(locale);
  // T-233 (audit n°3, F2) : la fiche d'un hôte suspendu (ou supprimé) ne doit
  // plus être servie — la sanction était jusqu'ici invisible côté voyageur.
  const [p] = await db
    .select({ property: properties })
    .from(properties)
    .innerJoin(users, eq(properties.hostId, users.id))
    .where(and(eq(properties.slug, slug), eq(properties.status, "active"), activeHostCondition(users)))
    .limit(1)
    .then((rows) => rows.map((row) => row.property));
  if (!p) return { title: t("meta.notFound") };
  const place = `${p.city}, ${countryLabel(p.country, t)}`;
  const desc = `${p.name} — ${place}. ${p.description ? p.description.slice(0, 140) : t("meta.bookBestPrice")}`;
  return {
    title: p.name,
    description: desc,
    openGraph: {
      title: p.name,
      description: desc,
      images: p.mainImage ? [{ url: p.mainImage }] : undefined,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: p.name,
      description: desc,
    },
  };
}
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PriceAlertButton } from "@/components/price-alert-button";
import { PropertyHeaderActions } from "@/components/property-header-actions";
import { PropertyReviewsList } from "@/components/property-reviews-list";
import { PropertyBookingCard } from "@/components/property-booking-card";
import { LocalizedRoomPrice } from "@/components/localized-room-price";
import { LocalizedDescription } from "@/components/localized-description";
import { ContactHostButton } from "@/components/contact-host-button";
import { getServerLocale } from "@/lib/server-locale";
import { activeHostCondition } from "@/lib/host-suspension";
import { makeT, type UiStringKey } from "@/lib/ui-strings";
// T-154e (audit n°26, P3-13) : libellés harmonisés avec la source unique.
import { amenityLabel } from "@/lib/amenities";
// T-154c (audit n°26, P2-5) : politique d'annulation réelle (au lieu du
// badge « voir le tarif » qui ne disait rien).
import { cancellationPolicyLabel } from "@/lib/cancellation-label";
import { buildReservationUrl } from "@/lib/reservation-url";
import {
  Star, MapPin, Check, X, Wifi, Car, Utensils, Waves,
  Dumbbell, Wind, Users, Calendar, Shield, MessageCircle, ImageOff
} from "lucide-react";
import Link from "next/link";

interface PropertyPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    checkIn?: string;
    checkOut?: string;
    adults?: string;
    children?: string;
  }>;
}

async function getProperty(slug: string, viewerId?: string, isAdmin = false) {
  // T-233 (audit n°3, F2) : l'hôte est joint pour connaître son état de compte.
  // Une annonce publiée dont l'hôte est suspendu (ou supprimé) n'est plus
  // servie publiquement — l'hôte lui-même et l'admin la voient encore, ce qui
  // permet de comprendre la sanction sans la subir.
  const [row] = await db
    .select({ property: properties, hostSuspendedAt: users.suspendedAt, hostDeletedAt: users.deletedAt })
    .from(properties)
    .innerJoin(users, eq(properties.hostId, users.id))
    .where(eq(properties.slug, slug));

  if (!row) return null;
  const { property } = row;
  const canSeePrivate = isAdmin || property.hostId === viewerId;
  const hostInactive = row.hostSuspendedAt !== null || row.hostDeletedAt !== null;
  if (hostInactive && !canSeePrivate) return null;
  if (property.status !== "active" && !canSeePrivate) return null;

  // T-184 : rooms et avis dépendent de property.id mais pas l'un de
  // l'autre — parallélisés (même résultat, un aller-retour DB de moins).
  const [propertyRooms, propertyReviews] = await Promise.all([
    db
      .select()
      .from(rooms)
      .where(and(eq(rooms.propertyId, property.id), ...(canSeePrivate ? [] : [eq(rooms.isActive, true)]))),
    db
      .select({
        review: reviews,
        user: {
          firstName: users.firstName,
          lastName: users.lastName,
          country: users.country,
        },
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .where(and(eq(reviews.propertyId, property.id), eq(reviews.status, "approved")))
      .orderBy(desc(reviews.createdAt))
      .limit(5),
  ]);

  return { property, rooms: propertyRooms, reviews: propertyReviews };
}

/**
 * T-182 : la fiche publique (contenu identique pour tout visiteur non
 * privilégié : bien actif, chambres actives, avis approuvés) est servie
 * depuis un cache TTL 60 s. Hôte propriétaire et admin gardent le chemin
 * dynamique (chambres inactives, brouillons…) — jamais caché. Le calcul
 * de disponibilité par séjour (T-177) et les données viewer (wishlist,
 * conversation) restent hors de ce bloc caché.
 */
async function getPublicProperty(slug: string) {
  // T-233 : la visibilité est vérifiée **hors cache** à chaque requête. Le
  // contenu, lui, reste caché 60 s. Sans cette garde, une annonce suspendue
  // resterait servie jusqu'à expiration du TTL (et l'invalidation, exécutée
  // depuis un autre bundle de routes, pouvait ne pas l'atteindre).
  if (!(await isPropertyPubliclyVisible(slug))) return null;
  return publicCatalogCache.wrap(`property:${slug}`, () => getProperty(slug));
}

/**
 * T-233 (audit n°3, F2) — l'annonce est-elle publiée par un hôte actif ?
 * Requête légère (une ligne, deux colonnes jointes), exécutée à chaque appel :
 * c'est le prix d'une sanction visible immédiatement.
 */
async function isPropertyPubliclyVisible(slug: string): Promise<boolean> {
  const [row] = await db
    .select({ status: properties.status, suspendedAt: users.suspendedAt, deletedAt: users.deletedAt })
    .from(properties)
    .innerJoin(users, eq(properties.hostId, users.id))
    .where(eq(properties.slug, slug))
    .limit(1);
  if (!row) return false;
  return row.status === "active" && row.suspendedAt === null && row.deletedAt === null;
}

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  wifi: <Wifi className="w-4 h-4" />,
  parking: <Car className="w-4 h-4" />,
  restaurant: <Utensils className="w-4 h-4" />,
  pool: <Waves className="w-4 h-4" />,
  gym: <Dumbbell className="w-4 h-4" />,
  air_conditioning: <Wind className="w-4 h-4" />,
};

export default async function PropertyPage({ params, searchParams }: PropertyPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const viewer = await getCurrentUser();
  const locale = await getServerLocale();
  const t = makeT(locale);
  // T-182 : visiteur anonyme → fiche publique cachée (TTL 60 s) ;
  // utilisateur connecté (vue éventuellement privée, garde incluse dans
  // getProperty) → lecture dynamique inchangée.
  const data = viewer
    ? await getProperty(slug, viewer.id, viewer.role === "admin")
    : await getPublicProperty(slug);

  if (!data) {
    notFound();
  }

  const { property, rooms: propertyRooms, reviews: propertyReviews } = data;

  // T-177/T-205 : quand la query porte un séjour VALIDE et non passé, on
  // évalue chaque chambre avec la même brique métier que POST /api/bookings :
  // stock journalier, stop-sell, min-stay et réservations chevauchantes. Avant
  // T-205, la fiche ne regardait que le nombre de réservations, laissant passer
  // des séjours bloqués par calendrier jusqu'au 409 du checkout.
  const stayDates = stayDatesFromPropertyQuery(query.checkIn, query.checkOut);
  const roomRemaining = new Map<string, number>();
  const roomStayTotals = new Map<string, number>();
  const parsedAdults = Number(query.adults ?? "2");
  const parsedChildren = Number(query.children ?? "0");
  const queryAdults = Number.isInteger(parsedAdults) && parsedAdults > 0 ? parsedAdults : 2;
  const queryChildren = Number.isInteger(parsedChildren) && parsedChildren >= 0 ? parsedChildren : 0;
  if (stayDates && propertyRooms.length > 0) {
    const roomIds = propertyRooms.map((r) => r.id);
    const [overlaps, calendarRules] = await Promise.all([
      db
        .select({ roomId: bookings.roomId, checkIn: bookings.checkIn, checkOut: bookings.checkOut })
        .from(bookings)
        .where(and(
          inArray(bookings.roomId, roomIds),
          ne(bookings.status, "cancelled"),
          lt(bookings.checkIn, stayDates.checkOut),
          gt(bookings.checkOut, stayDates.checkIn),
        )),
      db
        .select({
          roomId: roomAvailability.roomId,
          date: roomAvailability.date,
          availableCount: roomAvailability.availableCount,
          price: roomAvailability.price,
          stopSell: roomAvailability.stopSell,
          minStay: roomAvailability.minStay,
        })
        .from(roomAvailability)
        .where(and(
          inArray(roomAvailability.roomId, roomIds),
          gte(roomAvailability.date, stayDates.checkIn),
          lt(roomAvailability.date, stayDates.checkOut),
        )),
    ]);
    for (const room of propertyRooms) {
      const rules = evaluateBookingRules({
        room: {
          maxOccupancy: room.maxOccupancy,
          maxAdults: room.maxAdults,
          maxChildren: room.maxChildren,
          quantity: room.quantity ?? 1,
          basePrice: room.basePrice,
        },
        checkIn: stayDates.checkIn,
        checkOut: stayDates.checkOut,
        numAdults: queryAdults,
        numChildren: queryChildren,
        availability: calendarRules.filter((rule) => rule.roomId === room.id),
        overlappingBookings: overlaps.filter((booking) => booking.roomId === room.id),
      });
      roomRemaining.set(room.id, rules.ok ? 1 : 0);
      if (rules.ok) {
        roomStayTotals.set(room.id, rules.nightlyPrices.reduce((sum, price) => sum + price, 0));
      }
    }
  }
  // T-030/T-205 : chambre la moins chère pour le CTA "Voir dispo" et alerte
  // prix. Si un séjour est renseigné, on ne choisit plus une chambre vendue ou
  // stop-sell ; le seuil d'alerte suit le total réel du séjour.
  const cheapestRoomCandidates = stayDates
    ? propertyRooms.filter((room) => roomRemaining.get(room.id) !== 0)
    : propertyRooms;
  const cheapestRoom = cheapestRoomCandidates.length > 0
    ? [...cheapestRoomCandidates].sort((a, b) => {
        const aPrice = stayDates ? (roomStayTotals.get(a.id) ?? parseFloat(a.basePrice)) : parseFloat(a.basePrice);
        const bPrice = stayDates ? (roomStayTotals.get(b.id) ?? parseFloat(b.basePrice)) : parseFloat(b.basePrice);
        return aPrice - bPrice;
      })[0]
    : null;
  const alertDefaultMax = cheapestRoom
    ? Math.round((stayDates ? (roomStayTotals.get(cheapestRoom.id) ?? parseFloat(cheapestRoom.basePrice)) : parseFloat(cheapestRoom.basePrice)) * 0.85)
    : 100;
  const rating = property.averageRating ? parseFloat(property.averageRating) : null;
  const ratingInfo = rating ? getRatingLabel(rating, locale) : null;
  const amenities = (property.amenities as string[]) || [];
  const images = (property.images as string[]) || [];

  // T-017 : Schema.org Hotel/Product pour SEO enrichi
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Hotel",
    name: property.name,
    description: property.description ?? undefined,
    image: property.mainImage ?? undefined,
    starRating: property.starRating
      ? { "@type": "Rating", ratingValue: property.starRating }
      : undefined,
    address: {
      "@type": "PostalAddress",
      streetAddress: property.addressLine ?? undefined,
      addressLocality: property.city,
      postalCode: property.postalCode ?? undefined,
      addressCountry: property.country,
    },
    geo: property.latitude && property.longitude
      ? { "@type": "GeoCoordinates", latitude: property.latitude, longitude: property.longitude }
      : undefined,
    aggregateRating:
      property.averageRating && property.totalReviews
        ? {
            "@type": "AggregateRating",
            ratingValue: property.averageRating,
            reviewCount: property.totalReviews,
            bestRating: 10,
            worstRating: 0,
          }
        : undefined,
  };

  return (
    <div className="bg-gray-50">
      <Script
        id="property-json-ld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/" className="hover:text-gray-700">{t("crumb.home")}</Link>
            <span>/</span>
            <Link href="/recherche" className="hover:text-gray-700">{t("crumb.properties")}</Link>
            <span>/</span>
            <Link href={`/recherche?city=${property.city}`} className="hover:text-gray-700">{property.city}</Link>
            <span>/</span>
            <span className="text-gray-900">{property.name}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-gray-500">{getPropertyTypeLabel(property.type, locale)}</span>
              {property.starRating && (
                <span className="text-[#F5A623]">{"★".repeat(property.starRating)}</span>
              )}
              {property.isBestrewards && (
                <Badge variant="bestrewards">💎 BestRewards</Badge>
              )}
              {property.isEcoCertified && (
                <Badge variant="success">{t("badge.eco")}</Badge>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {property.name}
            </h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {property.addressLine && `${property.addressLine}, `}{property.city}, {countryLabel(property.country, t)}
              </span>
              {rating && (
                <span className="flex items-center gap-1">
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-[#1B3A6B] text-white text-sm font-semibold rounded">
                    <Star className="w-3 h-3 fill-current" />
                    {rating.toFixed(1)}
                  </div>
                  <span>{ratingInfo?.label}</span>
                  <span className="text-gray-400">{t("card.reviewsCount").replace("{n}", String(property.totalReviews ?? 0))}</span>
                </span>
              )}
            </div>
          </div>
          <PropertyHeaderActions propertyId={property.id} propertyName={property.name} />
        </div>

        {/* Image Gallery — T-188 : SmartImage (next/image si source
            auto-hébergée, sinon <img> lazy) ; conteneurs `relative` requis
            par fill.
            T-267 (audit n°7, C3) : plus aucune image de substitution —
            jadis, sans photo, le slot principal ET les 4 slots de galerie
            servaient un placeholder qui était une copie de la photo
            d'AUTRE propriété (villa-azure-1). Maintenant : les vraies
            photos si elles existent, sinon un état vide explicite. */}
        {property.mainImage || images.length > 0 ? (
          <div className="grid grid-cols-4 gap-2 mb-8 rounded-xl overflow-hidden">
            <div
              className={
                images.length > 0
                  ? "col-span-2 row-span-2 relative"
                  : "col-span-4 row-span-1 aspect-[21/9] relative"
              }
            >
              <SmartImage
                src={property.mainImage || images[0]}
                alt={property.name}
                className="w-full h-full object-cover"
                sizes={images.length > 0 ? "(max-width: 768px) 100vw, 50vw" : "(max-width: 768px) 100vw, 100vw"}
                priority
              />
            </div>
            {images.slice(0, 4).map((img, i) => (
              <div key={i} className="aspect-[4/3] relative">
                <SmartImage
                  src={img}
                  alt=""
                  className="w-full h-full object-cover"
                  sizes="(max-width: 768px) 50vw, 25vw"
                />
              </div>
            ))}
          </div>
        ) : (
          <div
            className="mb-8 rounded-xl border border-gray-200 bg-gray-100 flex flex-col items-center justify-center gap-2 py-16 text-gray-500"
            data-testid="no-photos"
          >
            <ImageOff className="w-8 h-8" aria-hidden="true" />
            <p className="text-sm">{t("property.noPhotos")}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Trust Banner */}
            <Card className="bg-[#1B3A6B]/5 border-[#1B3A6B]/20">
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[#F5A623] text-xl">✦</span>
                  <span className="font-semibold text-[#1B3A6B]">{t("trust.title")}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#1B3A6B]" />
                    <span>{t("trust.priceChecked")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#00A699]" />
                    <span>{t("trust.feesShown")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-[#F5A623]" />
                    <span>{t("property.verifiedReviews")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-[#1B3A6B]" />
                    <span>{t("trust.supportEmail")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle>{t("property.about")}</CardTitle>
              </CardHeader>
              <CardContent>
                <LocalizedDescription
                  description={property.description ?? null}
                  descriptionEn={property.descriptionEn ?? null}
                />
              </CardContent>
            </Card>

            {/* Amenities */}
            {amenities.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("property.amenities")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {amenities.map((amenity) => (
                      <div key={amenity} className="flex items-center gap-2 text-gray-700">
                        {AMENITY_ICONS[amenity] || <Check className="w-4 h-4" />}
                        <span>{amenityLabel(amenity, locale === "en" ? "en" : "fr")}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Rooms */}
            <Card>
              <CardHeader>
                <CardTitle>{t("property.rooms")}</CardTitle>
              </CardHeader>
              <CardContent>
                {propertyRooms.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">{t("property.noRooms")}</p>
                ) : (
                  <div className="space-y-4">
                    {propertyRooms.map((room) => (
                      <div
                        key={room.id}
                        className="flex flex-col md:flex-row md:items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-[#1B3A6B] transition-colors"
                      >
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{room.name}</h3>
                          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {t("prop.persMax").replace("{n}", String(room.maxOccupancy))}
                            </span>
                            {room.sizeSqm && <span>{room.sizeSqm} m²</span>}
                            {/* T-226 (A6) : la literie était stockée mais
                                jamais affichée (champ inatteignable côté
                                voyageur, donc invérifiable). */}
                            {Array.isArray(room.bedConfiguration) && room.bedConfiguration.length > 0 && (
                              <span>
                                {(room.bedConfiguration as { type: string; count: number }[])
                                  .map((bed) => t("room.bedSummary")
                                    .replace("{count}", String(bed.count))
                                    .replace("{type}", t(`room.bed.${bed.type}` as UiStringKey)))
                                  .join(" · ")}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="info">{cancellationPolicyLabel(property.cancellationPolicy, t)}</Badge>
                            {room.amenities && (room.amenities as string[]).includes("wifi") && (
                              <Badge variant="info">{t("card.wifi")}</Badge>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 md:mt-0 md:text-right">
                          <LocalizedRoomPrice basePrice={room.basePrice} currency={room.currency ?? "EUR"} />
                          {/* T-177 : séjour renseigné + épuisé → on prévient
                              avant le tunnel au lieu du 409 final. Sans
                              dates (ou séjour incohérent) : CTA inchangé. */}
                          {roomRemaining.get(room.id) === 0 ? (
                            <Button className="mt-2" size="sm" variant="outline" disabled>
                              {t("room.soldOut")}
                            </Button>
                          ) : (
                          <Link href={buildReservationUrl({
                            propertyId: property.id,
                            roomId: room.id,
                            checkIn: stayDates?.checkIn,
                            checkOut: stayDates?.checkOut,
                            numAdults: queryAdults,
                            numChildren: queryChildren,
                          })}>
                            <Button className="mt-2" size="sm">
                              {t("book.reserve")}
                            </Button>
                          </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reviews */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  {/* T-258 (audit n°6, B5) : `property.totalReviews` existait
                      déjà en base, mais la section n'en disait rien — un bien
                      à 40 avis n'en montrait que 5, sans le signaler. */}
                  <CardTitle>{t("property.verifiedReviews")} ✓</CardTitle>
                  <div className="flex items-center gap-3">
                    {property.totalReviews ? (
                      <span className="text-sm text-gray-500">
                        {t("property.reviewsCount").replace("{n}", String(property.totalReviews))}
                      </span>
                    ) : null}
                    {rating && (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 px-3 py-1 bg-[#1B3A6B] text-white font-semibold rounded">
                          <Star className="w-4 h-4 fill-current" />
                          {rating.toFixed(1)}
                        </div>
                        <span className="text-sm text-gray-600">
                          {ratingInfo?.emoji} {ratingInfo?.label}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <PropertyReviewsList
                  reviews={propertyReviews}
                  locale={locale}
                  t={t}
                  viewerId={viewer?.id}
                />
                {/* T-258 (audit n°6, B5) : la fiche reste bornée à 5 avis (même
                    coût), mais le visiteur sait combien il en existe et peut
                    lire la suite sur la page dédiée (API déjà paginée). */}
                {(property.totalReviews ?? 0) > propertyReviews.length && (
                  <Link
                    href={`/hebergement/${property.slug}/avis`}
                    className="mt-6 inline-flex items-center gap-1.5 rounded-lg border border-[#1B3A6B] px-4 py-2 text-sm font-medium text-[#1B3A6B] hover:bg-blue-50"
                  >
                    {t("property.reviewsSeeAll").replace("{n}", String(property.totalReviews ?? 0))}
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              {/* Booking Card */}
              <PropertyBookingCard
                propertyId={property.id}
                room={cheapestRoom ? {
                  id: cheapestRoom.id,
                  basePrice: cheapestRoom.basePrice,
                  currency: cheapestRoom.currency,
                  maxAdults: cheapestRoom.maxAdults,
                  maxChildren: cheapestRoom.maxChildren,
                  maxOccupancy: cheapestRoom.maxOccupancy,
                } : null}
                initialCheckIn={stayDates?.checkIn}
                initialCheckOut={stayDates?.checkOut}
                initialAdults={queryAdults}
                initialChildren={queryChildren}
                cancellationPolicy={property.cancellationPolicy}
              />

              {/* T-133 (A3): contact host before booking. Hidden for the
                  listing host (API already refuses that case). */}
              {property.hostId !== viewer?.id && (
                <ContactHostButton propertyId={property.id} />
              )}

              <div className="-mt-1">
                <PriceAlertButton
                  propertyId={property.id}
                  currency={cheapestRoom?.currency ?? "EUR"}
                  defaultMax={alertDefaultMax}
                  checkIn={stayDates?.checkIn}
                  checkOut={stayDates?.checkOut}
                  numAdults={stayDates ? queryAdults : undefined}
                  numChildren={stayDates ? queryChildren : undefined}
                />
              </div>

              {/* Policies */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t("property.policies")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">{t("book.checkIn")}</span>
                    <span className="font-medium">{property.checkInFrom || "14:00"} - {property.checkInUntil || "23:00"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">{t("book.checkOut")}</span>
                    <span className="font-medium">{t("prop.checkoutBefore").replace("{time}", property.checkOutUntil || "11:00")}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">{t("prop.petsShort")}</span>
                    <span className={property.petsAllowed ? "text-green-600" : "text-gray-500"}>
                      {property.petsAllowed ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">{t("prop.smokingShort")}</span>
                    <span className={property.smokingAllowed ? "text-green-600" : "text-gray-500"}>
                      {property.smokingAllowed ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
