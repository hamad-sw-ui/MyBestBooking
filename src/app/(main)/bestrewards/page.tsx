import type { Metadata } from "next";
import { getCurrentUser } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, Star, Percent, Wallet } from "lucide-react";
import Link from "next/link";
import { BestRewardsStatus } from "@/components/bestrewards-status";
// T-162 (audit n°30) : page public localisée (métadonnées + contenu).
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";

export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getServerLocale());
  return {
    title: t("bestrewards.meta.title"),
    description: t("bestrewards.meta.description"),
  };
}

export default async function BestRewardsPage() {
  const locale = await getServerLocale();
  const t = makeT(locale);
  const user = await getCurrentUser();
  const settings = await getSetting("bestrewards");
  const [level2Threshold, level3Threshold] = settings.thresholds;
  const [level1Discount, level2Discount, level3Discount] = settings.discounts;

  const fmt = (template: string, vars: Record<string, string | number>) =>
    Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), template);

  const levels = [
    {
      level: 1,
      name: t("bestrewards.level1Name"),
      color: "from-blue-500 to-blue-600",
      requirement: t("bestrewards.requirement1"),
      benefits: [
        { icon: Percent, text: fmt(t("bestrewards.benefit1"), { pct: level1Discount }) },
        { icon: Star, text: t("bestrewards.benefit2") },
      ],
    },
    {
      level: 2,
      name: t("bestrewards.level2Name"),
      color: "from-purple-500 to-purple-600",
      requirement: fmt(t("bestrewards.requirementN"), { n: level2Threshold }),
      benefits: [
        { icon: Percent, text: fmt(t("bestrewards.benefitN"), { pct: level2Discount, level: t("bestrewards.level2Name") }) },
        { icon: Star, text: t("bestrewards.benefit2Level2") },
      ],
    },
    {
      level: 3,
      name: t("bestrewards.level3Name"),
      color: "from-[#F5A623] to-yellow-500",
      requirement: fmt(t("bestrewards.requirementN"), { n: level3Threshold }),
      benefits: [
        { icon: Percent, text: fmt(t("bestrewards.benefitN"), { pct: level3Discount, level: t("bestrewards.level3Name") }) },
        { icon: Wallet, text: t("bestrewards.benefitCashback") },
        { icon: Star, text: t("bestrewards.benefit2Level3") },
      ],
    },
  ];

  const steps = [
    { step: 1, title: t("bestrewards.how1Title"), desc: t("bestrewards.how1Desc") },
    { step: 2, title: t("bestrewards.how2Title"), desc: t("bestrewards.how2Desc") },
    { step: 3, title: t("bestrewards.how3Title"), desc: t("bestrewards.how3Desc") },
  ];

  const faqs = [
    { q: t("bestrewards.faq1Q"), a: t("bestrewards.faq1A") },
    { q: t("bestrewards.faq2Q"), a: fmt(t("bestrewards.faq2A"), { n2: level2Threshold, n3: level3Threshold }) },
    { q: t("bestrewards.faq3Q"), a: t("bestrewards.faq3A") },
    { q: t("bestrewards.faq4Q"), a: t("bestrewards.faq4A") },
    { q: t("bestrewards.faq5Q"), a: t("bestrewards.faq5A") },
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
          <p className="text-xl text-white/80 max-w-2xl mx-auto mb-8" dangerouslySetInnerHTML={{ __html: t("bestrewards.hero") }} />
          {!user && (
            <Link href="/inscription">
              <Button size="lg" variant="secondary" className="text-lg px-8">
                {t("bestrewards.join")}
              </Button>
            </Link>
          )}
          {user && (
            <div className="inline-flex items-center gap-3 bg-white/10 px-6 py-3 rounded-full">
              <span className="text-white/70">{t("bestrewards.yourLevel")}</span>
              <Badge variant="bestrewards" className="text-base px-4 py-1">
                💎 {t("nav.level")} {user.bestrewardsLevel} — {levels[(user.bestrewardsLevel || 1) - 1].name}
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
            {t("bestrewards.how")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((item) => (
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
            {t("bestrewards.levelsTitle")}
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
                    <span className="text-white/70">{t("nav.level")} {level.level}</span>
                    {user?.bestrewardsLevel === level.level && (
                      <Badge className="bg-white text-[#1B3A6B]">{t("bestrewards.yourLevelBadge")}</Badge>
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
            {t("bestrewards.faqTitle")}
          </h2>
          <div className="space-y-6">
            {faqs.map((faq, i) => (
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
              {t("bestrewards.ctaTitle")}
            </h2>
            <p className="text-white/90 mb-8">
              {t("bestrewards.ctaDesc")}
            </p>
            <Link href="/inscription">
              <Button size="lg" className="bg-white text-[#F5A623] hover:bg-gray-100 text-lg px-8">
                {t("bestrewards.ctaButton")}
              </Button>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
