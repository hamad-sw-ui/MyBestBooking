import type { Metadata } from "next";
import { db } from "@/db";
import { bookings, properties, rooms } from "@/db/schema";
import { eq, and, ilike, or, desc, sql, min } from "drizzle-orm";

export const metadata: Metadata = {
  title: "Recherche d'hébergements",
  description: "Trouvez le meilleur hébergement pour votre séjour : hôtel, riad, villa, appartement, camping.",
};
import { PropertyCard } from "@/components/property-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Building2 } from "lucide-react";
import Link from "next/link";

interface SearchPageProps {
  searchParams: Promise<{
    city?: string;
    country?: string;
    type?: string;
    checkIn?: string;
    checkOut?: string;
    minPrice?: string;
    maxPrice?: string;
    guests?: string;
    amenity?: string;
    sort?: string;
    page?: string;
  }>;
}

async function searchProperties(params: Awaited<SearchPageProps["searchParams"]>) {
  const conditions = [eq(properties.status, "active")];

  if (params.city) {
    conditions.push(
      or(
        ilike(properties.city, `%${params.city}%`),
        ilike(properties.name, `%${params.city}%`)
      )!
    );
  }

  if (params.country) {
    conditions.push(eq(properties.country, params.country));
  }

  if (params.type) {
    conditions.push(eq(properties.type, params.type));
  }
  if (params.amenity) {
    conditions.push(sql`${properties.amenities} @> ${JSON.stringify([params.amenity])}::jsonb`);
  }
  if (params.guests) {
    const guests = Number(params.guests);
    if (Number.isInteger(guests) && guests > 0) {
      conditions.push(sql`EXISTS (SELECT 1 FROM rooms r WHERE r.property_id = ${properties.id} AND r.is_active = true AND r.max_occupancy >= ${guests})`);
    }
  }

  const minPrice = params.minPrice ? Number(params.minPrice) : null;
  const maxPrice = params.maxPrice ? Number(params.maxPrice) : null;
  if ((minPrice !== null && Number.isFinite(minPrice) && minPrice >= 0) || (maxPrice !== null && Number.isFinite(maxPrice) && maxPrice >= 0)) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.property_id = ${properties.id}
        AND r.is_active = true
        ${minPrice !== null && Number.isFinite(minPrice) && minPrice >= 0 ? sql`AND r.base_price >= ${minPrice}` : sql``}
        ${maxPrice !== null && Number.isFinite(maxPrice) && maxPrice >= 0 ? sql`AND r.base_price <= ${maxPrice}` : sql``}
    )`);
  }

  if (
    params.checkIn &&
    params.checkOut &&
    /^\d{4}-\d{2}-\d{2}$/.test(params.checkIn) &&
    /^\d{4}-\d{2}-\d{2}$/.test(params.checkOut) &&
    params.checkOut > params.checkIn
  ) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.property_id = ${properties.id}
        AND r.is_active = true
        AND COALESCE((
          SELECT ra.min_stay FROM room_availability ra
          WHERE ra.room_id = r.id AND ra.date = ${params.checkIn}
        ), 1) <= (${params.checkOut}::date - ${params.checkIn}::date)
        AND NOT EXISTS (
          SELECT 1
          FROM generate_series(${params.checkIn}::date, ${params.checkOut}::date - interval '1 day', interval '1 day') AS stay(day)
          LEFT JOIN room_availability ra
            ON ra.room_id = r.id AND ra.date = stay.day::date
          WHERE COALESCE(ra.stop_sell, false) = true
             OR COALESCE(ra.available_count, r.quantity) <= (
               SELECT COUNT(*) FROM bookings b
               WHERE b.room_id = r.id
                 AND b.status <> 'cancelled'
                 AND b.check_in <= stay.day::date
                 AND b.check_out > stay.day::date
             )
        )
    )`);
  }

  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const order = params.sort === "price_asc"
    ? sql`MIN(${rooms.basePrice}) ASC`
    : params.sort === "price_desc"
      ? sql`MIN(${rooms.basePrice}) DESC`
      : desc(properties.averageRating);
  const results = await db
    .select({ property: properties, minPrice: min(rooms.basePrice), minCurrency: min(rooms.currency) })
    .from(properties)
    .leftJoin(rooms, and(eq(rooms.propertyId, properties.id), eq(rooms.isActive, true)))
    .where(and(...conditions))
    .groupBy(properties.id)
    .orderBy(order)
    .limit(20)
    .offset((page - 1) * 20);

  return results.map(({ property, minPrice, minCurrency }) => ({
    ...property,
    minPrice: minPrice === null ? null : Number(minPrice),
    minCurrency,
  }));
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const results = await searchProperties(params);
  const currentPage = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const pageQuery = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value && key !== "page") pageQuery.set(key, value);
  function pageHref(page: number) {
    const query = new URLSearchParams(pageQuery);
    query.set("page", String(page));
    return `/recherche?${query.toString()}`;
  }
  const stayQuery = new URLSearchParams();
  if (params.checkIn) stayQuery.set("checkIn", params.checkIn);
  if (params.checkOut) stayQuery.set("checkOut", params.checkOut);

  const propertyTypes = [
    { value: "", label: "Tous les types" },
    { value: "hotel", label: "Hôtel" },
    { value: "apartment", label: "Appartement" },
    { value: "villa", label: "Villa" },
    { value: "hostel", label: "Auberge" },
    { value: "guesthouse", label: "Maison d'hôtes" },
    { value: "riad", label: "Riad" },
    { value: "resort", label: "Resort" },
  ];

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Search Header */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <form method="get" action="/recherche" className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Destination</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  name="city"
                  defaultValue={params.city}
                  placeholder="Ville ou hébergement"
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
                />
              </div>
            </div>
            <div className="w-[140px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Arrivée</label>
              <input
                type="date"
                name="checkIn"
                defaultValue={params.checkIn}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
              />
            </div>
            <div className="w-[140px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Départ</label>
              <input
                type="date"
                name="checkOut"
                defaultValue={params.checkOut}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
              />
            </div>
            <div className="w-[160px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select
                name="type"
                defaultValue={params.type}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
              >
                {propertyTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-[110px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Voyageurs</label>
              <input type="number" name="guests" min="1" defaultValue={params.guests} placeholder="Pers." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div className="w-[150px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Équipement</label>
              <select name="amenity" defaultValue={params.amenity ?? ""} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">Tous</option><option value="wifi">WiFi</option><option value="parking">Parking</option><option value="pool">Piscine</option><option value="spa">Spa</option><option value="restaurant">Restaurant</option>
              </select>
            </div>
            <div className="w-[150px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Tri</label>
              <select name="sort" defaultValue={params.sort ?? "rating"} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="rating">Mieux notés</option><option value="price_asc">Prix croissant</option><option value="price_desc">Prix décroissant</option>
              </select>
            </div>
            <div className="w-[120px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Prix min.</label>
              <input
                type="number"
                name="minPrice"
                min="0"
                step="1"
                defaultValue={params.minPrice}
                placeholder="€ min"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
              />
            </div>
            <div className="w-[120px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">Prix max.</label>
              <input
                type="number"
                name="maxPrice"
                min="0"
                step="1"
                defaultValue={params.maxPrice}
                placeholder="€ max"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
              />
            </div>
            <Button type="submit" size="md">
              <Search className="w-4 h-4 mr-2" />
              Rechercher
            </Button>
          </form>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Results Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {params.city ? (
                <>Hébergements à {params.city}</>
              ) : (
                <>Tous les hébergements</>
              )}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {results.length} résultat{results.length !== 1 ? "s" : ""} affiché{results.length !== 1 ? "s" : ""} · page {currentPage}
            </p>
          </div>
        </div>

        {/* Results Grid */}
        {results.length === 0 ? (
          <EmptyState
            icon={<Building2 className="w-8 h-8" />}
            title="Aucun résultat"
            description={params.city 
              ? `Aucun hébergement trouvé à "${params.city}". Essayez une autre destination.`
              : "Commencez votre recherche pour trouver des hébergements."
            }
            action={
              <Link href="/">
                <Button variant="outline">Retour à l&apos;accueil</Button>
              </Link>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {results.map((property) => (
                <PropertyCard key={property.id} property={property} searchQuery={stayQuery.toString()} />
              ))}
            </div>
            <nav aria-label="Pagination des résultats" className="mt-8 flex justify-center gap-3">
              {currentPage > 1 && <Link href={pageHref(currentPage - 1)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Précédent</Link>}
              {results.length === 20 && <Link href={pageHref(currentPage + 1)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">Suivant</Link>}
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
