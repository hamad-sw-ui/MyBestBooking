import type { Metadata } from "next";
import { db } from "@/db";
import { bookings, properties, rooms } from "@/db/schema";
import { asc, count, eq, and, ilike, inArray, or, desc, sql, type SQL } from "drizzle-orm";
import { PropertyCard } from "@/components/property-card";
import { toPublicPropertyCard } from "@/lib/public-property";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Search, MapPin, Building2 } from "lucide-react";
import Link from "next/link";
import { RATES_FROM_EUR, priceBoundToStorage } from "@/lib/i18n";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import { SearchPriceFilter } from "@/components/search-price-filter";
import { getCurrentUser } from "@/lib/auth";
import { formatPrice } from "@/lib/utils";
// T-154e (audit n°26, P3-13) : tous les équipements portés par des biens
// sont filtrables (avant : 5 options codées en dur, kitchen/sea_view/…
// inaccessibles via l'UI alors que le filtre ?amenity= les gère).
import { AMENITIES, amenityLabel } from "@/lib/amenities";

interface SearchPageProps {
  searchParams: Promise<{
    city?: string;
    country?: string;
    type?: string;
    checkIn?: string;
    checkOut?: string;
    minPrice?: string;
    maxPrice?: string;
    /** T-133/A1 : devise dans laquelle l'utilisateur saisit la fourchette
     *  de prix (celle affichée, ex. XAF). Les bornes sont converties vers la
     *  devise de stockage (EUR) avant le filtrage. Absent/EUR = comportement
     *  historique. */
    displayCurrency?: string;
    guests?: string;
    amenity?: string;
    sort?: string;
    page?: string;
    /** T-153 (audit n°25, F) : arrivée depuis « Utiliser mon solde »
     *  (/mon-compte) — affiche un bandeau rappelant le wallet. */
    wallet?: string;
  }>;
}



function validStay(params: Awaited<SearchPageProps["searchParams"]>): params is Awaited<SearchPageProps["searchParams"]> & { checkIn: string; checkOut: string } {
  return Boolean(
    params.checkIn && params.checkOut
    && /^\d{4}-\d{2}-\d{2}$/.test(params.checkIn)
    && /^\d{4}-\d{2}-\d{2}$/.test(params.checkOut)
    && params.checkOut > params.checkIn,
  );
}

/** Taux de conversion EUR d'une devise de chambre (mêmes taux figés que
 * l'affichage, source unique). Inconnue → 1 (comportement historique). */
function rateFor(currency: string | null | undefined): number {
  return RATES_FROM_EUR[(currency ?? "EUR").toUpperCase()] ?? 1;
}

/** Prix de base normalisé en EUR (SQL) — mêmes taux figés que l'affichage. */
function roomPriceEur(alias: "r" | "r2"): SQL {
  const room = sql.raw(alias);
  // Les taux sont castés en numeric : sinon le driver infère le type depuis
  // le premier paramètre (EUR = 1, entier) et refuse « 1.08 » (22P02).
  const rateCases = Object.entries(RATES_FROM_EUR)
    .map(([c, rate]) => sql`WHEN ${c} THEN ${rate}::numeric`)
    .reduce((acc, part) => sql`${acc} ${part}`);
  return sql`(${room}.base_price::numeric / COALESCE((CASE ${room}.currency ${rateCases} ELSE 1::numeric END), 1))`;
}

/** Prédicat d'éligibilité d'une room (hors bornes de prix, appliquées au min).
 * Une seule room doit satisfaire tous les critères. `room` est la référence
 * de table : `sql.raw("r"/"r2")` dans les sous-requêtes (alias), ou la table
 * `rooms` elle-même pour une requête principale. */
function eligibleRoomPredicate(room: SQL | typeof rooms, params: Awaited<SearchPageProps["searchParams"]>): SQL {
  const clauses: SQL[] = [sql`${room}.is_active = true`];
  const guests = Number(params.guests);
  if (Number.isInteger(guests) && guests > 0) clauses.push(sql`${room}.max_occupancy >= ${guests}`);

  if (validStay(params)) {
    clauses.push(sql`
      COALESCE((
        SELECT ra.min_stay FROM room_availability ra
        WHERE ra.room_id = ${room}.id AND ra.date = ${params.checkIn}
      ), 1) <= (${params.checkOut}::date - ${params.checkIn}::date)
      AND NOT EXISTS (
        SELECT 1
        FROM generate_series(${params.checkIn}::date, ${params.checkOut}::date - interval '1 day', interval '1 day') AS stay(day)
        LEFT JOIN room_availability ra
          ON ra.room_id = ${room}.id AND ra.date = stay.day::date
        WHERE COALESCE(ra.stop_sell, false) = true
           OR COALESCE(ra.available_count, ${room}.quantity) <= (
             SELECT COUNT(*) FROM bookings b
             WHERE b.room_id = ${room}.id
               AND b.status <> 'cancelled'
               AND b.check_in <= stay.day::date
               AND b.check_out > stay.day::date
           )
      )
    `);
  }
  return sql.join(clauses, sql` AND `);
}

/** Bornes de prix converties en EUR (saisie dans la devise d'affichage). */
function priceBounds(params: Awaited<SearchPageProps["searchParams"]>): { min: number | null; max: number | null } {
  const minRaw = params.minPrice ? Number(params.minPrice) : null;
  const maxRaw = params.maxPrice ? Number(params.maxPrice) : null;
  return {
    min: minRaw !== null && Number.isFinite(minRaw) && minRaw >= 0
      ? priceBoundToStorage(minRaw, params.displayCurrency) : null,
    max: maxRaw !== null && Number.isFinite(maxRaw) && maxRaw >= 0
      ? priceBoundToStorage(maxRaw, params.displayCurrency) : null,
  };
}

/** Sous-requête « prix à partir de » (MIN normalisé EUR) — utilisée UNIQUEMENT
 * en position WHERE/ORDER BY. Ne jamais la placer dans la projection SELECT :
 * Drizzle y rend la référence à la table externe SANS qualificatif
 * (`r2.property_id = "id"` → se lie à `r2.id` → NULL partout) alors que les
 * contextes WHERE/ORDER BY la rendent correctement (`"properties"."id"`). */
function minEligiblePriceEur(alias: "r2", params: Awaited<SearchPageProps["searchParams"]>): SQL {
  const room = sql.raw(alias);
  return sql`(SELECT MIN(${roomPriceEur(alias)}) FROM rooms ${room}
    WHERE ${room}.property_id = ${properties.id}
      AND ${eligibleRoomPredicate(room, params)})`;
}

async function searchProperties(params: Awaited<SearchPageProps["searchParams"]>) {
  const conditions: SQL[] = [eq(properties.status, "active")];

  if (params.city) {
    conditions.push(or(ilike(properties.city, `%${params.city}%`), ilike(properties.name, `%${params.city}%`))!);
  }
  if (params.country) conditions.push(eq(properties.country, params.country));
  if (params.type) conditions.push(eq(properties.type, params.type));
  // T-155 (audit n°27, P3) : certains équipements sont portés par les
  // CHAMBRES (tv, minibar…) et jamais par la propriété — le filtre
  // `?amenity=` (exposé par le formulaire depuis T-154e) ne trouvait donc
  // rien. On matche la propriété OU une de ses chambres (même contrat).
  if (params.amenity) conditions.push(sql`(
    ${properties.amenities} @> ${JSON.stringify([params.amenity])}::jsonb
    OR EXISTS (
      SELECT 1 FROM rooms ra
      WHERE ra.property_id = ${properties.id}
        AND ra.amenities @> ${JSON.stringify([params.amenity])}::jsonb
    )
  )`);

  // Une property est éligible seulement si une room l'est sur la totalité des
  // filtres (hors prix) ; les bornes de prix s'appliquent ensuite au MIN
  // (« à partir de »), pas à une chambre quelconque (audit n°26, P1-2).
  conditions.push(sql`EXISTS (
    SELECT 1 FROM rooms r
    WHERE r.property_id = ${properties.id}
      AND ${eligibleRoomPredicate(sql.raw("r"), params)}
  )`);
  const { min, max } = priceBounds(params);
  const minPriceEur = minEligiblePriceEur("r2", params);
  if (min !== null) conditions.push(sql`${minPriceEur} >= ${min}`);
  if (max !== null) conditions.push(sql`${minPriceEur} <= ${max}`);

  const requestedPage = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const [{ total }] = await db.select({ total: count() }).from(properties).where(and(...conditions));
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const page = Math.min(requestedPage, totalPages);
  const order = params.sort === "price_asc"
    ? [sql`${minPriceEur} ASC`, asc(properties.id)]
    : params.sort === "price_desc"
      ? [sql`${minPriceEur} DESC`, asc(properties.id)]
      : [desc(properties.averageRating), asc(properties.id)];

  const rows = await db
    .select({ property: properties })
    .from(properties)
    .where(and(...conditions))
    .orderBy(...order)
    .limit(20)
    .offset((page - 1) * 20);

  // Prix d'affichage : seconde requête au lieu de sous-requêtes corrélées en
  // projection (voir minEligiblePriceEur). On récupère les rooms éligibles des
  // résultats puis on calcule le min normalisé EUR en JS (valeur + devise
  // d'origine conservées pour la carte).
  const ids = rows.map((row) => row.property.id);
  const eligibleRooms = ids.length === 0 ? [] : await db
    .select()
    .from(rooms)
    .where(and(inArray(rooms.propertyId, ids), eligibleRoomPredicate(rooms, params)));

  const cheapestByProperty = new Map<string, { price: number; currency: string; id: string; eur: number }>();
  for (const room of eligibleRooms) {
    const price = Number(room.basePrice);
    if (!Number.isFinite(price)) continue;
    const eur = price / rateFor(room.currency);
    const current = cheapestByProperty.get(room.propertyId);
    if (!current || eur < current.eur || (eur === current.eur && room.id < current.id)) {
      cheapestByProperty.set(room.propertyId, { price, currency: room.currency ?? "EUR", id: room.id, eur });
    }
  }

  return {
    total,
    page,
    totalPages,
    results: rows.map(({ property }) => {
      const best = cheapestByProperty.get(property.id);
      return toPublicPropertyCard(property, {
        minPrice: best?.price ?? null,
        minCurrency: best?.currency ?? null,
      });
    }),
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const locale = await getServerLocale();
  const t = makeT(locale);
  // T-153 (F) : bandeau « pensez à utiliser vos crédits » — lecture seule du
  // solde EUR du wallet (aucun changement de contrat API, aucun filtre).
  let walletAmount: number | null = null;
  if (params.wallet === "1") {
    const user = await getCurrentUser();
    if (user) walletAmount = Number(user.walletBalance ?? "0");
  }
  const search = await searchProperties(params);
  const { results, total, page: currentPage, totalPages } = search;
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
    { value: "", label: t("search.allTypes") },
    { value: "hotel", label: t("search.type.hotel") },
    { value: "apartment", label: t("search.type.apartment") },
    { value: "villa", label: t("search.type.villa") },
    { value: "hostel", label: t("search.type.hostel") },
    { value: "guesthouse", label: t("search.type.guesthouse") },
    { value: "riad", label: t("search.type.riad") },
    { value: "resort", label: t("search.type.resort") },
  ];

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* T-153 (F) : bandeau wallet affiché uniquement à l'arrivée depuis
          « Utiliser mon solde » (/mon-compte → /recherche?wallet=1). */}
      {walletAmount !== null && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 text-sm text-amber-900">
            💰 {t("search.walletBanner").replace("{amount}", formatPrice(walletAmount, "EUR"))}
          </div>
        </div>
      )}
      {/* Search Header */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <form method="get" action="/recherche" className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">{t("search.destination")}</label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  name="city"
                  defaultValue={params.city}
                  placeholder={t("search.destinationPlaceholder")}
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
                />
              </div>
            </div>
            <div className="w-[140px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">{t("search.arrival")}</label>
              <input
                type="date"
                name="checkIn"
                defaultValue={params.checkIn}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
              />
            </div>
            <div className="w-[140px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">{t("search.departure")}</label>
              <input
                type="date"
                name="checkOut"
                defaultValue={params.checkOut}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
              />
            </div>
            <div className="w-[160px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">{t("search.type")}</label>
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
              <label className="block text-xs font-medium text-gray-500 mb-1">{t("search.travelers")}</label>
              <input type="number" name="guests" min="1" defaultValue={params.guests} placeholder={t("search.travelersPlaceholder")} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div className="w-[150px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">{t("search.amenity")}</label>
              <select name="amenity" defaultValue={params.amenity ?? ""} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="">{t("search.amenity.all")}</option>
                {AMENITIES.map((a) => (
                  <option key={a.id} value={a.id}>{amenityLabel(a.id, locale === "en" ? "en" : "fr")}</option>
                ))}
              </select>
            </div>
            <div className="w-[150px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">{t("search.sort")}</label>
              <select name="sort" defaultValue={params.sort ?? "rating"} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                <option value="rating">{t("search.sort.rating")}</option><option value="price_asc">{t("search.sort.priceAsc")}</option><option value="price_desc">{t("search.sort.priceDesc")}</option>
              </select>
            </div>
            <SearchPriceFilter minPrice={params.minPrice} maxPrice={params.maxPrice} initialLanguage={locale} />
            <Button type="submit" size="md">
              <Search className="w-4 h-4 mr-2" />
              {t("search.button")}
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
                <>{t("search.accommodationsIn")} {params.city}</>
              ) : (
                <>{t("search.allAccommodations")}</>
              )}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {total} {total !== 1 ? t("search.resultsPlural") : t("search.resultsCount")} · {t("search.pageShort")} {currentPage} {t("search.pageOf")} {totalPages}
            </p>
          </div>
        </div>

        {/* Results Grid */}
        {results.length === 0 ? (
          <EmptyState
            icon={<Building2 className="w-8 h-8" />}
            title={t("search.noResults")}
            description={params.city 
              ? t("search.noneInCity").replace("{city}", params.city)
              : t("search.startSearch")
            }
            action={
              <Link href="/">
                <Button variant="outline">{t("search.backHome")}</Button>
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
            <nav aria-label={t("search.pagination")} className="mt-8 flex justify-center gap-3">
              {currentPage > 1 && <Link href={pageHref(currentPage - 1)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">{t("search.prev")}</Link>}
              {currentPage < totalPages && <Link href={pageHref(currentPage + 1)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">{t("search.next")}</Link>}
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
