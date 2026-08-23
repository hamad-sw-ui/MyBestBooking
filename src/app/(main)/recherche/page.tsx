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

  if (params.minPrice) {
    const minPrice = Number(params.minPrice);
    if (Number.isFinite(minPrice) && minPrice >= 0) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM rooms r
        WHERE r.property_id = ${properties.id}
          AND r.is_active = true
          AND r.base_price >= ${minPrice}
      )`);
    }
  }

  if (params.maxPrice) {
    const maxPrice = Number(params.maxPrice);
    if (Number.isFinite(maxPrice) && maxPrice >= 0) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM rooms r
        WHERE r.property_id = ${properties.id}
          AND r.is_active = true
          AND r.base_price <= ${maxPrice}
      )`);
    }
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
        AND r.quantity > (
          SELECT COUNT(*) FROM bookings b
          WHERE b.room_id = r.id
            AND b.status <> 'cancelled'
            AND b.check_in < ${params.checkOut}
            AND b.check_out > ${params.checkIn}
        )
        AND NOT EXISTS (
          SELECT 1 FROM room_availability ra
          WHERE ra.room_id = r.id
            AND ra.date >= ${params.checkIn}
            AND ra.date < ${params.checkOut}
            AND ra.stop_sell = true
        )
    )`);
  }

  const results = await db
    .select({ property: properties, minPrice: min(rooms.basePrice) })
    .from(properties)
    .leftJoin(rooms, and(eq(rooms.propertyId, properties.id), eq(rooms.isActive, true)))
    .where(and(...conditions))
    .groupBy(properties.id)
    .orderBy(desc(properties.averageRating))
    .limit(20);

  return results.map(({ property, minPrice }) => ({
    ...property,
    minPrice: minPrice === null ? null : Number(minPrice),
  }));
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const results = await searchProperties(params);

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
              {results.length} résultat{results.length !== 1 ? "s" : ""} trouvé{results.length !== 1 ? "s" : ""}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {results.map((property) => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
