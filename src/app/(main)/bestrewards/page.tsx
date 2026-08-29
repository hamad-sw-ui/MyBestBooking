import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "BestRewards — programme fidélité",
  description: "Cumulez des séjours terminés et débloquez des réductions BestRewards et le cashback Ambassador.",
};
import { Badge } from "@/components/ui/badge";
import { Award, Star, Percent, Wallet } from "lucide-react";
import Link from "next/link";
import { BestRewardsStatus } from "@/components/bestrewards-status";

export default async function BestRewardsPage() {
  const user = await getCurrentUser();
  const settings = await getSetting("bestrewards");
  const [level2Threshold, level3Threshold] = settings.thresholds;
  const [level1Discount, level2Discount, level3Discount] = settings.discounts;

  const levels = [
    {
      level: 1,
      name: "Explorer",
      color: "from-blue-500 to-blue-600",
      requirement: "Dès l'inscription",
      benefits: [
        { icon: Percent, text: `Réduction de ${level1Discount}% sur les hébergements BestRewards` },
        { icon: Star, text: "Suivi de votre niveau dans Mon compte" },
      ],
    },
    {
      level: 2,
      name: "Voyageur",
      color: "from-purple-500 to-purple-600",
      requirement: `${level2Threshold} séjours terminés`,
      benefits: [
        { icon: Percent, text: `Réduction de ${level2Discount}% niveau Voyageur sur BestRewards` },
        { icon: Star, text: "Tous les avantages Explorer" },
      ],
    },
    {
      level: 3,
      name: "Ambassador",
      color: "from-[#F5A623] to-yellow-500",
      requirement: `${level3Threshold} séjours terminés`,
      benefits: [
        { icon: Percent, text: `Réduction de ${level3Discount}% niveau Ambassador sur BestRewards` },
        { icon: Wallet, text: "Cashback 5% en wallet après séjour" },
        { icon: Star, text: "Tous les avantages Voyageur" },
      ],
    },
  ];

  return (
    <div className="bg-gray-50">
      {/* Hero */}
      <section className="bg-gradient-to-br from-[#1B3A6B] to-[#0f2444] text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Award className="w-12 h-12 text-[#F5A623]" />
            <h1 className="text-4xl md:text-5xl font-bold" style={{ fontFamily: "'Poppins', sans-serif" }}>
              BestRewards
            </h1>
          </div>
          <p className="text-xl text-white/80 max-w-2xl mx-auto mb-8">
            Les vrais avantages, dès votre 1ère réservation.<br />
            Rejoignez le programme de fidélité mybestbooking.
          </p>
          {!user && (
            <Link href="/inscription">
              <Button size="lg" variant="secondary" className="text-lg px-8">
                Rejoindre gratuitement
              </Button>
            </Link>
          )}
          {user && (
            <div className="inline-flex items-center gap-3 bg-white/10 px-6 py-3 rounded-full">
              <span className="text-white/70">Votre niveau :</span>
              <Badge variant="bestrewards" className="text-base px-4 py-1">
                💎 Level {user.bestrewardsLevel} — {levels[(user.bestrewardsLevel || 1) - 1].name}
              </Badge>
            </div>
          )}
        </div>
      </section>

      {/* Statut réel du compte connecté (T-114) */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <BestRewardsStatus thresholds={[level2Threshold, level3Threshold]} />
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-12" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Comment ça marche ?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: 1, title: "Inscrivez-vous", desc: "C'est gratuit et instantané. Vous êtes immédiatement Level 1 Explorer." },
              { step: 2, title: "Réservez", desc: "Chaque réservation confirmée compte. Plus vous voyagez, plus vous montez en niveau." },
              { step: 3, title: "Profitez", desc: "Utilisez vos réductions BestRewards et, au niveau Ambassador, votre cashback wallet." },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1B3A6B] text-white flex items-center justify-center text-2xl font-bold">
                  {item.step}
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Levels */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-12" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Les 3 niveaux BestRewards
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {levels.map((level) => (
              <Card 
                key={level.level} 
                className={`overflow-hidden ${
                  user?.bestrewardsLevel === level.level 
                    ? "ring-4 ring-[#F5A623] ring-offset-2" 
                    : ""
                }`}
              >
                <div className={`bg-gradient-to-r ${level.color} text-white p-6`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/70">Level {level.level}</span>
                    {user?.bestrewardsLevel === level.level && (
                      <Badge className="bg-white text-[#1B3A6B]">Votre niveau</Badge>
                    )}
                  </div>
                  <h3 className="text-2xl font-bold">{level.name}</h3>
                  <p className="text-white/80 text-sm mt-1">{level.requirement}</p>
                </div>
                <CardContent className="pt-6">
                  <ul className="space-y-3">
                    {level.benefits.map((benefit, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <benefit.icon className="w-4 h-4 text-green-600" />
                        </div>
                        <span className="text-gray-700">{benefit.text}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-center text-gray-900 mb-12" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Questions fréquentes
          </h2>
          <div className="space-y-6">
            {[
              {
                q: "Comment rejoindre BestRewards ?",
                a: "C'est automatique ! Dès votre inscription sur mybestbooking, vous êtes Level 1 Explorer et bénéficiez immédiatement de la réduction configurée sur les hébergements BestRewards.",
              },
              {
                q: "Comment monter de niveau ?",
                a: `Chaque séjour terminé compte. Après ${level2Threshold} séjours, vous passez Level 2 Voyageur. Après ${level3Threshold} séjours, vous atteignez Level 3 Ambassador.`,
              },
              {
                q: "Les réductions sont-elles cumulables ?",
                a: "Les réductions BestRewards s'appliquent automatiquement sur les hébergements éligibles (badge 💎). Elles peuvent se cumuler avec certaines promotions selon les partenaires.",
              },
              {
                q: "Comment fonctionne le cashback Ambassador ?",
                a: "Au Level 3, vous gagnez 5% de cashback sur chaque réservation, crédité directement sur votre wallet mybestbooking. Ce solde est utilisable sur vos prochaines réservations.",
              },
              {
                q: "Mon niveau peut-il expirer ?",
                a: "Votre niveau progresse après chaque séjour terminé. Les règles de durée de validité ne sont pas encore proposées ; votre niveau n'expire donc pas automatiquement.",
              },
            ].map((faq, i) => (
              <div key={i} className="border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-2">{faq.q}</h3>
                <p className="text-gray-600">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      {!user && (
        <section className="py-16 bg-gradient-to-r from-[#F5A623] to-[#f7b84a]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4" style={{ fontFamily: "'Poppins', sans-serif" }}>
              Prêt à profiter des avantages ?
            </h2>
            <p className="text-white/90 mb-8">
              Rejoignez des milliers de voyageurs qui économisent avec BestRewards
            </p>
            <Link href="/inscription">
              <Button size="lg" className="bg-white text-[#F5A623] hover:bg-gray-100 text-lg px-8">
                Créer mon compte gratuit
              </Button>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
