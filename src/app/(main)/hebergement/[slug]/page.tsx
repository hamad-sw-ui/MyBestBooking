import type { Metadata } from "next";
import Script from "next/script";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { properties, rooms, reviews, users } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { formatPrice, formatDate, getRatingLabel, getPropertyTypeLabel } from "@/lib/utils";
import { safeJsonForScript } from "@/lib/safe-json-ld";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [p] = await db.select().from(properties).where(and(eq(properties.slug, slug), eq(properties.status, "active"))).limit(1);
  if (!p) return { title: "Hébergement introuvable" };
  const desc = `${p.name} à ${p.city}, ${p.country}. ${p.description ? p.description.slice(0, 140) : "Réservez au meilleur prix."}`;
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
import { ReviewHelpfulButton } from "@/components/review-helpful-button";
import { PropertyBookingCard } from "@/components/property-booking-card";
import { LocalizedRoomPrice } from "@/components/localized-room-price";
import { LocalizedDescription } from "@/components/localized-description";
import { buildReservationUrl } from "@/lib/reservation-url";
import {
  Star, MapPin, Check, X, Wifi, Car, Utensils, Waves,
  Dumbbell, Wind, Users, Calendar, Shield, MessageCircle, Award
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
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.slug, slug));

  if (!property) return null;
  const canSeePrivate = isAdmin || property.hostId === viewerId;
  if (property.status !== "active" && !canSeePrivate) return null;

  const propertyRooms = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.propertyId, property.id), ...(canSeePrivate ? [] : [eq(rooms.isActive, true)])));

  const propertyReviews = await db
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
    .limit(5);

  return { property, rooms: propertyRooms, reviews: propertyReviews };
}

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  wifi: <Wifi className="w-4 h-4" />,
  parking: <Car className="w-4 h-4" />,
  restaurant: <Utensils className="w-4 h-4" />,
  pool: <Waves className="w-4 h-4" />,
  gym: <Dumbbell className="w-4 h-4" />,
  air_conditioning: <Wind className="w-4 h-4" />,
};

const AMENITY_LABELS: Record<string, string> = {
  wifi: "WiFi gratuit",
  parking: "Parking",
  restaurant: "Restaurant",
  pool: "Piscine",
  gym: "Salle de sport",
  air_conditioning: "Climatisation",
  spa: "Spa",
  bar: "Bar",
  room_service: "Room service",
  concierge: "Conciergerie",
  beach_access: "Accès plage",
  garden: "Jardin",
};

export default async function PropertyPage({ params, searchParams }: PropertyPageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const viewer = await getCurrentUser();
  const data = await getProperty(slug, viewer?.id, viewer?.role === "admin");

  if (!data) {
    notFound();
  }

  const { property, rooms: propertyRooms, reviews: propertyReviews } = data;
  // T-030 : chambre la moins chère pour le CTA "Voir dispo" et alerte prix
  const cheapestRoom = propertyRooms.length > 0
    ? [...propertyRooms].sort((a, b) => parseFloat(a.basePrice) - parseFloat(b.basePrice))[0]
    : null;
  const rating = property.averageRating ? parseFloat(property.averageRating) : null;
  const ratingInfo = rating ? getRatingLabel(rating) : null;
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
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Link href="/" className="hover:text-gray-700">Accueil</Link>
            <span>/</span>
            <Link href="/recherche" className="hover:text-gray-700">Hébergements</Link>
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
              <span className="text-sm text-gray-500">{getPropertyTypeLabel(property.type)}</span>
              {property.starRating && (
                <span className="text-[#F5A623]">{"★".repeat(property.starRating)}</span>
              )}
              {property.isBestrewards && (
                <Badge variant="bestrewards">💎 BestRewards</Badge>
              )}
              {property.isEcoCertified && (
                <Badge variant="success">🌱 Éco</Badge>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {property.name}
            </h1>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {property.addressLine && `${property.addressLine}, `}{property.city}, {property.country}
              </span>
              {rating && (
                <span className="flex items-center gap-1">
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-[#1B3A6B] text-white text-sm font-semibold rounded">
                    <Star className="w-3 h-3 fill-current" />
                    {rating.toFixed(1)}
                  </div>
                  <span>{ratingInfo?.label}</span>
                  <span className="text-gray-400">({property.totalReviews} avis)</span>
                </span>
              )}
            </div>
          </div>
          <PropertyHeaderActions propertyId={property.id} propertyName={property.name} />
        </div>

        {/* Image Gallery */}
        <div className="grid grid-cols-4 gap-2 mb-8 rounded-xl overflow-hidden">
          <div className="col-span-2 row-span-2">
            <img
              src={property.mainImage || images[0] || "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800"}
              alt={property.name}
              className="w-full h-full object-cover"
            />
          </div>
          {(images.length > 0 ? images.slice(0, 4) : [1, 2, 3, 4]).map((img, i) => (
            <div key={i} className="aspect-[4/3]">
              <img
                src={typeof img === "string" ? img : `https://images.unsplash.com/photo-156607377125${i}-6a8506099945?w=400`}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Trust Banner */}
            <Card className="bg-[#1B3A6B]/5 border-[#1B3A6B]/20">
              <CardContent>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[#F5A623] text-xl">✦</span>
                  <span className="font-semibold text-[#1B3A6B]">Informations mybestbooking</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#1B3A6B]" />
                    <span>Prix vérifié au paiement</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#00A699]" />
                    <span>Frais affichés avant confirmation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-[#F5A623]" />
                    <span>Avis vérifiés</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-[#1B3A6B]" />
                    <span>Contact support par email</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            <Card>
              <CardHeader>
                <CardTitle>À propos</CardTitle>
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
                  <CardTitle>Équipements</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {amenities.map((amenity) => (
                      <div key={amenity} className="flex items-center gap-2 text-gray-700">
                        {AMENITY_ICONS[amenity] || <Check className="w-4 h-4" />}
                        <span>{AMENITY_LABELS[amenity] || amenity}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Rooms */}
            <Card>
              <CardHeader>
                <CardTitle>Chambres disponibles</CardTitle>
              </CardHeader>
              <CardContent>
                {propertyRooms.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Aucune chambre disponible pour le moment</p>
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
                              {room.maxOccupancy} pers. max
                            </span>
                            {room.sizeSqm && <span>{room.sizeSqm} m²</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="info">Politique : {property.cancellationPolicy === "free" ? "annulation gratuite" : property.cancellationPolicy === "non_refundable" ? "non remboursable" : property.cancellationPolicy ?? "voir le tarif"}</Badge>
                            {room.amenities && (room.amenities as string[]).includes("wifi") && (
                              <Badge variant="info">WiFi</Badge>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 md:mt-0 md:text-right">
                          <LocalizedRoomPrice basePrice={room.basePrice} currency={room.currency ?? "EUR"} />
                          <Link href={buildReservationUrl({
                            propertyId: property.id,
                            roomId: room.id,
                            checkIn: query.checkIn,
                            checkOut: query.checkOut,
                            numAdults: Number(query.adults ?? "2"),
                            numChildren: Number(query.children ?? "0"),
                          })}>
                            <Button className="mt-2" size="sm">
                              Réserver
                            </Button>
                          </Link>
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
                  <CardTitle>Avis vérifiés ✓</CardTitle>
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
              </CardHeader>
              <CardContent>
                {propertyReviews.length === 0 ? (
                  <div className="text-center py-8">
                    <Award className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500">Nouveau partenaire — pas encore d&apos;avis</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {propertyReviews.map(({ review, user: reviewer }) => (
                      <div key={review.id} className="border-b border-gray-100 pb-6 last:border-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#1B3A6B] flex items-center justify-center text-white font-medium">
                              {reviewer?.firstName?.charAt(0)}{reviewer?.lastName?.charAt(0)}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {reviewer?.firstName} {reviewer?.lastName?.charAt(0)}.
                              </p>
                              <p className="text-sm text-gray-500">
                                {review.travelerType && (
                                  <span className="capitalize">{review.travelerType}</span>
                                )}
                                {reviewer?.country && ` · ${reviewer.country}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm font-medium">
                            <Star className="w-3 h-3 text-[#F5A623] fill-current" />
                            {parseFloat(review.overallRating).toFixed(1)}
                          </div>
                        </div>
                        {review.positiveComment && (
                          <p className="text-gray-700 mb-2">
                            <span className="text-green-600 font-medium">👍</span> {review.positiveComment}
                          </p>
                        )}
                        {review.negativeComment && (
                          <p className="text-gray-600 text-sm">
                            <span className="text-gray-400">👎</span> {review.negativeComment}
                          </p>
                        )}
                        {review.hostReply && (
                          <div className="mt-3 ml-3 border-l-2 border-[#1B3A6B] bg-blue-50/60 p-3 rounded-r-lg">
                            <p className="text-xs font-semibold text-[#1B3A6B]">Réponse de l&apos;hébergement</p>
                            <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{review.hostReply}</p>
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mt-2">
                          {formatDate(review.createdAt)}
                        </p>
                        <ReviewHelpfulButton reviewId={review.id} initialCount={review.helpfulCount} />
                      </div>
                    ))}
                  </div>
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
                  maxOccupancy: cheapestRoom.maxOccupancy,
                } : null}
                initialCheckIn={query.checkIn}
                initialCheckOut={query.checkOut}
                initialAdults={Number(query.adults ?? "2") || 2}
                initialChildren={Number(query.children ?? "0") || 0}
              />

              <div className="-mt-1">
                <PriceAlertButton
                  propertyId={property.id}
                  currency={cheapestRoom?.currency ?? "EUR"}
                  defaultMax={cheapestRoom ? Math.round(parseFloat(cheapestRoom.basePrice) * 0.85) : 100}
                  checkIn={query.checkIn}
                  checkOut={query.checkOut}
                  numAdults={Number(query.adults ?? "") || undefined}
                  numChildren={Number(query.children ?? "") || undefined}
                />
              </div>

              {/* Policies */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Politiques</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Check-in</span>
                    <span className="font-medium">{property.checkInFrom || "14:00"} - {property.checkInUntil || "23:00"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Check-out</span>
                    <span className="font-medium">Avant {property.checkOutUntil || "11:00"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Animaux</span>
                    <span className={property.petsAllowed ? "text-green-600" : "text-gray-500"}>
                      {property.petsAllowed ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Fumeurs</span>
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
