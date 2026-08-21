import type { Metadata } from "next";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const metadata: Metadata = {
  title: "Aide et FAQ",
  description: "Trouvez des réponses à vos questions sur MyBestBooking : réservation, annulation, paiement, compte.",
};
import { 
  Search, MessageCircle, Phone, Mail, Book, 
  HelpCircle, CreditCard, Calendar, Shield, 
  Star, ArrowRight, ChevronRight, ExternalLink
} from "lucide-react";
import Link from "next/link";

export default function HelpPage() {
  const categories = [
    {
      icon: Calendar,
      title: "Réservations",
      description: "Gérer, modifier ou annuler une réservation",
      articles: ["Comment annuler une réservation ?", "Modifier mes dates", "Ajouter un voyageur"],
    },
    {
      icon: CreditCard,
      title: "Paiements & Facturation",
      description: "Questions sur les paiements et remboursements",
      articles: ["Modes de paiement acceptés", "Obtenir une facture", "Demander un remboursement"],
    },
    {
      icon: Shield,
      title: "Garantie Prix",
      description: "Comment fonctionne notre garantie meilleur prix",
      articles: ["Conditions de la garantie", "Soumettre une réclamation", "Délais de remboursement"],
    },
    {
      icon: Star,
      title: "BestRewards",
      description: "Tout sur notre programme de fidélité",
      articles: ["Les niveaux BestRewards", "Utiliser mon cashback", "Avantages exclusifs"],
    },
    {
      icon: HelpCircle,
      title: "Mon compte",
      description: "Paramètres, sécurité et préférences",
      articles: ["Changer mon mot de passe", "Supprimer mon compte", "Notifications"],
    },
    {
      icon: Book,
      title: "Hébergeurs",
      description: "Guide pour les partenaires hébergeurs",
      articles: ["Devenir partenaire", "Gérer mon établissement", "Comprendre les commissions"],
    },
  ];

  const popularQuestions = [
    "Comment annuler ma réservation ?",
    "Puis-je modifier les dates de mon séjour ?",
    "Comment fonctionne la Garantie Meilleur Prix ?",
    "Comment laisser un avis ?",
    "Comment contacter mon hébergeur ?",
    "Quels sont les avantages BestRewards ?",
  ];

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Hero */}
      <section className="bg-[#1B3A6B] text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Comment pouvons-nous vous aider ?
          </h1>
          <p className="text-white/80 mb-8">
            Trouvez des réponses à vos questions ou contactez notre équipe
          </p>
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher dans l'aide..."
              className="w-full pl-12 pr-4 py-4 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FF5A5F]"
            />
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Contact Options */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardContent className="py-8">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#1B3A6B]/10 flex items-center justify-center">
                <MessageCircle className="w-6 h-6 text-[#1B3A6B]" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Messagerie</h3>
              <p className="text-sm text-gray-500 mb-4">Écrivez-nous par email</p>
              <a
                href="mailto:support@mybestbooking.com?subject=Aide%20MyBestBooking"
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#1B3A6B] text-white text-sm font-medium hover:bg-[#152d54] transition"
              >
                Écrire à l&apos;équipe
              </a>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardContent className="py-8">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#FF5A5F]/10 flex items-center justify-center">
                <Phone className="w-6 h-6 text-[#FF5A5F]" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Téléphone</h3>
              <p className="text-sm text-gray-500 mb-4">+237 XXX XX XX XX</p>
              <span className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-500">
                Numéro à activer
              </span>
            </CardContent>
          </Card>

          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardContent className="py-8">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-[#F5A623]/10 flex items-center justify-center">
                <Mail className="w-6 h-6 text-[#F5A623]" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Email direct</h3>
              <p className="text-sm text-gray-500 mb-4">support@mybestbooking.com</p>
              <a
                href="mailto:support@mybestbooking.com"
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg border border-[#1B3A6B] text-[#1B3A6B] text-sm font-medium hover:bg-[#1B3A6B] hover:text-white transition"
              >
                Ouvrir mon client mail
              </a>
            </CardContent>
          </Card>
        </div>

        {/* Categories */}
        <h2 className="text-2xl font-bold text-gray-900 mb-6" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Parcourir par catégorie
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {categories.map((cat) => (
            <Card key={cat.title} className="hover:shadow-lg transition-shadow cursor-pointer group">
              <CardContent>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-[#1B3A6B]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#1B3A6B] transition-colors">
                    <cat.icon className="w-5 h-5 text-[#1B3A6B] group-hover:text-white transition-colors" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{cat.title}</h3>
                    <p className="text-sm text-gray-500 mb-3">{cat.description}</p>
                    <ul className="space-y-2">
                      {cat.articles.map((article) => (
                        <li key={article}>
                          <span className="text-sm text-gray-600 flex items-center gap-1">
                            <ChevronRight className="w-3 h-3 text-gray-400" />
                            {article}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Popular Questions */}
        <h2 className="text-2xl font-bold text-gray-900 mb-6" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Questions fréquentes
        </h2>
        <Card className="mb-12">
          <CardContent className="divide-y divide-gray-100">
            {popularQuestions.map((question, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-4 -mx-6 px-6"
              >
                <span className="text-gray-900">{question}</span>
                <ArrowRight className="w-4 h-4 text-gray-300" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Still need help */}
        <Card className="bg-gradient-to-r from-[#1B3A6B] to-[#0f2444] text-white">
          <CardContent className="flex flex-col md:flex-row items-center justify-between gap-6 py-8">
            <div>
              <h3 className="text-xl font-bold mb-2">Vous n&apos;avez pas trouvé votre réponse ?</h3>
              <p className="text-white/80">
                Notre équipe support est disponible 24h/24 pour vous aider.
              </p>
            </div>
            <div className="flex gap-4">
              <a
                href="mailto:support@mybestbooking.com?subject=Aide%20MyBestBooking"
                className="inline-flex items-center px-5 py-2.5 rounded-lg bg-white text-[#1B3A6B] font-medium hover:bg-gray-100 transition"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                Écrire à l&apos;équipe
              </a>
              <a
                href="mailto:support@mybestbooking.com"
                className="inline-flex items-center px-5 py-2.5 rounded-lg border border-white text-white hover:bg-white/10 transition"
              >
                <Mail className="w-4 h-4 mr-2" />
                support@mybestbooking.com
              </a>
            </div>
          </CardContent>
        </Card>

        {/* For hosts */}
        <div className="mt-12 text-center">
          <p className="text-gray-500 mb-4">
            Vous êtes un hébergeur partenaire ?
          </p>
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-[#1B3A6B] font-medium hover:underline">
            Accéder à l&apos;aide hébergeurs
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
