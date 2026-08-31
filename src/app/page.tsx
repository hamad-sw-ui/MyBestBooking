import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getCurrentUser } from "@/lib/auth";
import { isMaintenanceActive } from "@/lib/maintenance";
import { db } from "@/db";
import { properties, reviews, users, rooms } from "@/db/schema";
import { eq, desc, and, min } from "drizzle-orm";
import { formatPrice, getRatingLabel, getPropertyTypeLabel } from "@/lib/utils";
import { Star, Shield, MessageCircle, Zap, Award, ChevronRight, MapPin, Heart } from "lucide-react";
import { PropertyCard } from "@/components/property-card";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";

async function getFeaturedProperties() {
  const results = await db
    .select({ property: properties, minPrice: min(rooms.basePrice), minCurrency: min(rooms.currency) })
    .from(properties)
    .leftJoin(rooms, and(eq(rooms.propertyId, properties.id), eq(rooms.isActive, true)))
    .where(eq(properties.status, "active"))
    .groupBy(properties.id)
    .orderBy(desc(properties.averageRating))
    .limit(4);

  return results.map(({ property, minPrice, minCurrency }) => ({
    ...property,
    minPrice: minPrice === null ? null : Number(minPrice),
    minCurrency,
  }));
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const locale = await getServerLocale();
  const t = makeT(locale);

  // T-022 : mode maintenance — les non-admins sont redirigés vers
  // /maintenance. La page racine n'est pas dans le groupe (main),
  // donc le guard du layout (main) ne s'y applique pas.
  if ((!user || user.role !== "admin") && (await isMaintenanceActive())) {
    redirect("/maintenance");
  }

  const featuredProperties = await getFeaturedProperties();
  
  const destinations = [
    { name: "Paris", country: t("prop.country.FR"), image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400" },
    { name: "Marrakech", country: t("prop.country.MA"), image: "https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=400" },
    { name: "Barcelone", country: t("prop.country.ES"), image: "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=400" },
    { name: "Rome", country: t("prop.country.IT"), image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400" },
    { name: "Tunis", country: t("prop.country.TN"), image: "https://images.unsplash.com/photo-1590073242678-70ee3fc28f8e?w=400" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} initialLanguage={locale} />
      
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#1B3A6B] to-[#0f2444] text-white">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1920')" }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6" style={{ fontFamily: "'Poppins', sans-serif" }}>
              {t("home.heroTitle1")}<br />
              <span className="text-[#FF5A5F]">{t("home.heroTitle2")}</span>
            </h1>
            <p className="text-xl text-white/80 mb-8">
              {t("home.heroSub1")}<br />
              {t("home.heroSub2")}
            </p>
            
            {/* Search Box */}
            <div className="bg-white rounded-2xl p-4 md:p-6 shadow-xl">
              <form action="/recherche" className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t("search.destination")}</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      name="city"
                      placeholder={t("home.whereGo")}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t("book.checkIn")}</label>
                    <input
                      type="date"
                      name="checkIn"
                      className="px-4 py-3 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">{t("book.checkOut")}</label>
                    <input
                      type="date"
                      name="checkOut"
                      className="px-4 py-3 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="home-guests" className="block text-xs font-medium text-gray-500 mb-1">{t("search.travelers")}</label>
                  <select
                    id="home-guests"
                    name="guests"
                    defaultValue="2"
                    className="px-4 py-3 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                      <option key={n} value={n}>{n} {n > 1 ? t("home.travelerMany") : t("home.travelerOne")}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full md:w-auto px-8 py-3 bg-[#FF5A5F] text-white font-semibold rounded-lg hover:bg-[#e54a4f] transition-colors"
                  >
                    {t("home.search")}
                  </button>
                </div>
              </form>
            </div>
            
            {/* Trust badges */}
            <div className="flex flex-wrap gap-6 mt-8 text-sm">
              <span className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#F5A623]" />
                {t("home.trustPrice")}
              </span>
              <span className="flex items-center gap-2">
                <Star className="w-5 h-5 text-[#F5A623]" />
                {t("home.trustReviews")}
              </span>
              <span className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#F5A623]" />
                {t("home.trustNoFees")}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Properties */}
      {featuredProperties.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  {t("home.featuredTitle")}
                </h2>
                <p className="text-gray-600 mt-1">{t("home.featuredSub")}</p>
              </div>
              <Link
                href="/recherche"
                className="hidden md:flex items-center gap-1 text-[#1B3A6B] font-medium hover:underline"
              >
                {t("home.seeAll")}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredProperties.map((property) => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>

            <div className="mt-8 text-center md:hidden">
              <Link
                href="/recherche"
                className="inline-flex items-center gap-1 text-[#1B3A6B] font-medium"
              >
                {t("home.seeAllProperties")}
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Popular Destinations */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-8" style={{ fontFamily: "'Poppins', sans-serif" }}>
            {t("home.destTitle")}
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {destinations.map((dest) => (
              <Link
                key={dest.name}
                href={`/recherche?city=${encodeURIComponent(dest.name)}`}
                className="group relative rounded-xl overflow-hidden aspect-[4/5]"
              >
                <Image
                  src={dest.image}
                  alt={dest.name}
                  fill
                  sizes="(max-width: 768px) 50vw, 20vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-4 left-4 text-white">
                  <h3 className="font-bold text-lg">{dest.name}</h3>
                  <p className="text-sm text-white/80">{t("home.discover")} {dest.country}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center mb-12" style={{ fontFamily: "'Poppins', sans-serif" }}>
            {t("home.whyTitle")}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1B3A6B]/10 flex items-center justify-center">
                <Shield className="w-8 h-8 text-[#1B3A6B]" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t("home.whyPriceTitle")}</h3>
              <p className="text-gray-600">
                {t("home.whyPriceBody")}
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#FF5A5F]/10 flex items-center justify-center">
                <Star className="w-8 h-8 text-[#FF5A5F]" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t("home.whyReviewTitle")}</h3>
              <p className="text-gray-600">
                {t("home.whyReviewBody")}
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#00A699]/10 flex items-center justify-center">
                <MessageCircle className="w-8 h-8 text-[#00A699]" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{t("home.whySupportTitle")}</h3>
              <p className="text-gray-600">
                {t("home.whySupportBody")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* BestRewards CTA */}
      <section className="py-16 bg-gradient-to-r from-[#F5A623] to-[#f7b84a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left">
              <div className="flex items-center gap-2 justify-center md:justify-start mb-4">
                <Award className="w-8 h-8 text-white" />
                <span className="text-2xl font-bold text-white" style={{ fontFamily: "'Poppins', sans-serif" }}>
                  BestRewards
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-white mb-2">
                {t("home.rewardsTitle")}
              </h2>
              <p className="text-white/90">
                {t("home.rewardsBody")}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/bestrewards"
                className="px-6 py-3 bg-white text-[#F5A623] font-semibold rounded-lg hover:bg-gray-100 transition-colors text-center"
              >
                {t("home.learnMore")}
              </Link>
              {!user && (
                <Link
                  href="/inscription"
                  className="px-6 py-3 bg-[#1B3A6B] text-white font-semibold rounded-lg hover:bg-[#152d54] transition-colors text-center"
                >
                  {t("home.joinFree")}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Seed data notice for demo */}
      {featuredProperties.length === 0 && (
        <section className="py-16 bg-blue-50">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {t("home.firstVisit")}
            </h2>
            <p className="text-gray-600 mb-6">
              {t("home.firstVisitBody")}
            </p>
            <form action="/api/seed" method="POST">
              <button
                type="submit"
                className="px-6 py-3 bg-[#1B3A6B] text-white font-semibold rounded-lg hover:bg-[#152d54] transition-colors"
              >
                {t("home.loadDemo")}
              </button>
            </form>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
