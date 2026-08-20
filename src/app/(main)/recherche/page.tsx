import { db } from "@/db";
import { properties, rooms } from "@/db/schema";
import { eq, and, ilike, or, desc, sql } from "drizzle-orm";
import { PropertyCard } from "@/components/property-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, MapPin, SlidersHorizontal, Building2 } from "lucide-react";
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

  const results = await db
    .select()
    .from(properties)
    .where(and(...conditions))
    .orderBy(desc(properties.averageRating))
    .limit(20);

  return results;
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
          <form className="flex flex-wrap gap-4 items-end">
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
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
            <SlidersHorizontal className="w-4 h-4" />
            Filtres
          </button>
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
