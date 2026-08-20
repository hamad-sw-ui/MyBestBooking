import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { properties, reviews, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { formatPrice, getRatingLabel, getPropertyTypeLabel } from "@/lib/utils";
import { Star, Shield, MessageCircle, Zap, Award, ChevronRight, MapPin, Heart } from "lucide-react";
import { PropertyCard } from "@/components/property-card";

async function getFeaturedProperties() {
  const results = await db
    .select()
    .from(properties)
    .where(eq(properties.status, "active"))
    .orderBy(desc(properties.averageRating))
    .limit(4);
  
  return results;
}

export default async function HomePage() {
  const user = await getCurrentUser();
  const featuredProperties = await getFeaturedProperties();
  
  const destinations = [
    { name: "Paris", country: "France", image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400", count: 2450 },
    { name: "Marrakech", country: "Maroc", image: "https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=400", count: 890 },
    { name: "Barcelone", country: "Espagne", image: "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=400", count: 1820 },
    { name: "Rome", country: "Italie", image: "https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400", count: 1650 },
    { name: "Tunis", country: "Tunisie", image: "https://images.unsplash.com/photo-1590073242678-70ee3fc28f8e?w=400", count: 420 },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} />
      
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#1B3A6B] to-[#0f2444] text-white">
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=1920')" }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Réservez mieux.<br />
              <span className="text-[#FF5A5F]">Voyagez plus.</span>
            </h1>
            <p className="text-xl text-white/80 mb-8">
              Trouvez les meilleurs hébergements au meilleur prix.<br />
              Prix garantis, avis vérifiés, zéro frais cachés.
            </p>
            
            {/* Search Box */}
            <div className="bg-white rounded-2xl p-4 md:p-6 shadow-xl">
              <form action="/recherche" className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Destination</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      name="city"
                      placeholder="Où voulez-vous aller ?"
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
                    />
                  </div>
                </div>
                <div className="flex gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Arrivée</label>
                    <input
                      type="date"
                      name="checkIn"
                      className="px-4 py-3 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Départ</label>
                    <input
                      type="date"
                      name="checkOut"
                      className="px-4 py-3 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
                    />
                  </div>
                </div>
                <div className="flex items-end">
                  <button
                    type="submit"
                    className="w-full md:w-auto px-8 py-3 bg-[#FF5A5F] text-white font-semibold rounded-lg hover:bg-[#e54a4f] transition-colors"
                  >
                    Rechercher
                  </button>
                </div>
              </form>
            </div>
            
            {/* Trust badges */}
            <div className="flex flex-wrap gap-6 mt-8 text-sm">
              <span className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-[#F5A623]" />
                Prix garantis
              </span>
              <span className="flex items-center gap-2">
                <Star className="w-5 h-5 text-[#F5A623]" />
                Avis vérifiés
              </span>
              <span className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#F5A623]" />
                0 frais cachés
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
                  🔥 Hébergements populaires
                </h2>
                <p className="text-gray-600 mt-1">Les mieux notés par nos voyageurs</p>
              </div>
              <Link
                href="/recherche"
                className="hidden md:flex items-center gap-1 text-[#1B3A6B] font-medium hover:underline"
              >
                Voir tout
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
                Voir tous les hébergements
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
            🌍 Destinations tendance
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {destinations.map((dest) => (
              <Link
                key={dest.name}
                href={`/recherche?city=${encodeURIComponent(dest.name)}`}
                className="group relative rounded-xl overflow-hidden aspect-[4/5]"
              >
                <img
                  src={dest.image}
                  alt={dest.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-4 left-4 text-white">
                  <h3 className="font-bold text-lg">{dest.name}</h3>
                  <p className="text-sm text-white/80">{dest.count}+ hébergements</p>
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
            ✦ Pourquoi choisir mybestbooking ?
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1B3A6B]/10 flex items-center justify-center">
                <Shield className="w-8 h-8 text-[#1B3A6B]" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Prix Garantis</h3>
              <p className="text-gray-600">
                Trouvé moins cher ailleurs ? On vous rembourse la différence. C&apos;est notre engagement.
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#FF5A5F]/10 flex items-center justify-center">
                <Star className="w-8 h-8 text-[#FF5A5F]" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Avis 100% Vérifiés</h3>
              <p className="text-gray-600">
                Seuls les voyageurs ayant réservé et séjourné peuvent laisser un avis. Zéro faux avis.
              </p>
            </div>
            
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#00A699]/10 flex items-center justify-center">
                <MessageCircle className="w-8 h-8 text-[#00A699]" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Support 24/7</h3>
              <p className="text-gray-600">
                Une équipe humaine disponible à tout moment pour vous aider. Pas des bots.
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
                Les vrais avantages, dès votre 1ère réservation
              </h2>
              <p className="text-white/90">
                Jusqu&apos;à -20% sur vos réservations, petits-déjeuners offerts, surclassements...
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                href="/bestrewards"
                className="px-6 py-3 bg-white text-[#F5A623] font-semibold rounded-lg hover:bg-gray-100 transition-colors text-center"
              >
                En savoir plus
              </Link>
              {!user && (
                <Link
                  href="/inscription"
                  className="px-6 py-3 bg-[#1B3A6B] text-white font-semibold rounded-lg hover:bg-[#152d54] transition-colors text-center"
                >
                  Rejoindre gratuitement
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
              🚀 Première visite ?
            </h2>
            <p className="text-gray-600 mb-6">
              Pour voir l&apos;application en action avec des données de démonstration, cliquez sur le bouton ci-dessous.
            </p>
            <form action="/api/seed" method="POST">
              <button
                type="submit"
                className="px-6 py-3 bg-[#1B3A6B] text-white font-semibold rounded-lg hover:bg-[#152d54] transition-colors"
              >
                Charger les données de démo
              </button>
            </form>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
