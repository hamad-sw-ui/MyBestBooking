import { notFound } from "next/navigation";
import { db } from "@/db";
import { properties, rooms, reviews, users } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { formatPrice, formatDate, getRatingLabel, getPropertyTypeLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Star, MapPin, Heart, Share2, Check, X, Wifi, Car, Utensils, Waves,
  Dumbbell, Wind, Users, Calendar, Shield, MessageCircle, Award
} from "lucide-react";
import Link from "next/link";

interface PropertyPageProps {
  params: Promise<{ slug: string }>;
}

async function getProperty(slug: string) {
  const [property] = await db
    .select()
    .from(properties)
    .where(eq(properties.slug, slug));

  if (!property) return null;

  const propertyRooms = await db
    .select()
    .from(rooms)
    .where(and(eq(rooms.propertyId, property.id), eq(rooms.isActive, true)));

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

export default async function PropertyPage({ params }: PropertyPageProps) {
  const { slug } = await params;
  const data = await getProperty(slug);
  const user = await getCurrentUser();

  if (!data) {
    notFound();
  }

  const { property, rooms: propertyRooms, reviews: propertyReviews } = data;
  const rating = property.averageRating ? parseFloat(property.averageRating) : null;
  const ratingInfo = rating ? getRatingLabel(rating) : null;
  const amenities = (property.amenities as string[]) || [];
  const images = (property.images as string[]) || [];

  return (
    <div className="bg-gray-50">
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
          <div className="flex items-center gap-2">
            <button className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <Heart className="w-5 h-5 text-gray-500" />
            </button>
            <button className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <Share2 className="w-5 h-5 text-gray-500" />
            </button>
          </div>
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
                  <span className="font-semibold text-[#1B3A6B]">La Promesse mybestbooking</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-[#1B3A6B]" />
                    <span>Prix garanti</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-[#00A699]" />
                    <span>0 frais cachés</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Star className="w-4 h-4 text-[#F5A623]" />
                    <span>Avis vérifiés</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-[#1B3A6B]" />
                    <span>Support 24/7</span>
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
                <p className="text-gray-600 leading-relaxed">
                  {property.description || "Découvrez cet hébergement exceptionnel et profitez d'un séjour inoubliable."}
                </p>
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
                            <Badge variant="success">✓ Annulation gratuite</Badge>
                            {room.amenities && (room.amenities as string[]).includes("wifi") && (
                              <Badge variant="info">WiFi</Badge>
                            )}
                          </div>
                        </div>
                        <div className="mt-4 md:mt-0 md:text-right">
                          <p className="text-2xl font-bold text-gray-900">
                            {formatPrice(room.basePrice, room.currency || "EUR")}
                          </p>
                          <p className="text-sm text-gray-500">par nuit</p>
                          <Link href={user ? `/reservation?property=${property.id}&room=${room.id}` : "/connexion"}>
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
                        <p className="text-xs text-gray-400 mt-2">
                          {formatDate(review.createdAt)}
                        </p>
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
              <Card>
                <CardContent>
                  <div className="text-center mb-4">
                    <p className="text-sm text-gray-500">À partir de</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {propertyRooms.length > 0 
                        ? formatPrice(Math.min(...propertyRooms.map(r => parseFloat(r.basePrice))))
                        : "—"
                      }
                    </p>
                    <p className="text-sm text-gray-500">par nuit</p>
                  </div>

                  <div className="space-y-3 mb-4">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Arrivée</label>
                        <input
                          type="date"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Départ</label>
                        <input
                          type="date"
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Voyageurs</label>
                      <select className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                        <option>1 adulte</option>
                        <option>2 adultes</option>
                        <option>2 adultes, 1 enfant</option>
                        <option>2 adultes, 2 enfants</option>
                      </select>
                    </div>
                  </div>

                  <Button className="w-full" size="lg">
                    Voir les disponibilités
                  </Button>

                  <p className="text-xs text-center text-gray-500 mt-3">
                    ✓ Annulation gratuite • ✓ Paiement sécurisé
                  </p>
                </CardContent>
              </Card>

              {/* Price Guarantee */}
              <Card className="bg-[#F5A623]/10 border-[#F5A623]/30">
                <CardContent>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-5 h-5 text-[#F5A623]" />
                    <span className="font-semibold text-[#1B3A6B]">Garantie Meilleur Prix</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    Trouvé moins cher ailleurs ? On vous rembourse la différence.
                  </p>
                </CardContent>
              </Card>

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
