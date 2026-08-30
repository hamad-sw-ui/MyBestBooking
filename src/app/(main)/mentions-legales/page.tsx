import type { Metadata } from "next";
// T-162 (audit n°30) : page localisée selon la langue du visiteur.
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";

const CONTENT = {
  fr: {
    title: "Mentions légales",
    editor: "Éditeur du site",
    editorBody: [
      "MyBestBooking — plateforme de réservation d'hébergements.",
      "Raison sociale : à compléter par l'éditeur en production.",
      "Contact : support@mybestbooking.com",
    ],
    hosting: "Hébergement",
    hostingBody: "Le site est hébergé sur une infrastructure cloud professionnelle (Vercel / Neon PostgreSQL ou équivalent). Détails à préciser en production.",
    cgu: "Conditions générales d'utilisation",
    cguIntro: "En utilisant MyBestBooking, vous acceptez de :",
    cguItems: [
      "Fournir des informations exactes lors de l'inscription.",
      "Ne pas utiliser le service à des fins illégales.",
      "Respecter les règles de chaque hébergement réservé.",
      "Ne pas publier d'avis diffamatoire ou faux.",
    ],
    cguOutro: "MyBestBooking se réserve le droit de suspendre tout compte en violation de ces règles (voir Modération dans le panneau d'administration).",
    cgv: "Conditions générales de vente",
    cgvBody1: "Les tarifs sont exprimés TTC. La TVA appliquée est paramétrée par l'éditeur dans le panneau d'administration (10 % par défaut). Les frais d'annulation dépendent de la politique d'annulation de chaque hébergement (Free, Flexible, Modérée, Stricte, Non remboursable).",
    cgvBody2: "Le paiement est traité par un prestataire de confiance (Stripe ou équivalent). MyBestBooking n'a jamais accès aux données de carte bancaire complètes.",
    ip: "Propriété intellectuelle",
    ipBody: "L'ensemble des contenus (marque, logo, textes, code) est protégé. Les photos d'hébergement appartiennent à leurs propriétaires respectifs.",
    law: "Droit applicable",
    lawBody: "Le présent document est régi par le droit français. Tout litige relève de la compétence exclusive des tribunaux français, sauf disposition impérative contraire.",
    seeAlso: "Pour la politique de traitement des données personnelles, voir la page",
    updated: "Dernière mise à jour :",
  },
  en: {
    title: "Legal notice",
    editor: "Site publisher",
    editorBody: [
      "MyBestBooking — accommodation booking platform.",
      "Company name: to be completed by the publisher in production.",
      "Contact: support@mybestbooking.com",
    ],
    hosting: "Hosting",
    hostingBody: "The site is hosted on a professional cloud infrastructure (Vercel / Neon PostgreSQL or equivalent). Details to be confirmed in production.",
    cgu: "Terms of use",
    cguIntro: "By using MyBestBooking, you agree to:",
    cguItems: [
      "Provide accurate information when registering.",
      "Not use the service for illegal purposes.",
      "Respect the rules of each booked accommodation.",
      "Not publish defamatory or false reviews.",
    ],
    cguOutro: "MyBestBooking reserves the right to suspend any account violating these rules (see Moderation in the admin panel).",
    cgv: "Terms of sale",
    cgvBody1: "Prices are shown VAT included. The VAT rate is configured by the publisher in the admin panel (10% by default). Cancellation fees depend on each accommodation's cancellation policy (Free, Flexible, Moderate, Strict, Non-refundable).",
    cgvBody2: "Payment is processed by a trusted provider (Stripe or equivalent). MyBestBooking never has access to full bank card details.",
    ip: "Intellectual property",
    ipBody: "All content (brand, logo, texts, code) is protected. Accommodation photos belong to their respective owners.",
    law: "Applicable law",
    lawBody: "This document is governed by French law. Any dispute falls under the exclusive jurisdiction of French courts, unless mandatory provisions state otherwise.",
    seeAlso: "For the personal data policy, see",
    updated: "Last updated:",
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getServerLocale());
  return {
    title: t("legal.meta.title"),
    description: t("legal.meta.description"),
    robots: { index: true, follow: true },
  };
}

/**
 * /mentions-legales (T-031) — Mentions légales + CGU + CGV, bilingue (T-162).
 */
export default async function MentionsLegalesPage() {
  const locale = await getServerLocale();
  const c = CONTENT[locale === "en" ? "en" : "fr"];
  const t = makeT(locale);
  const mailto = (text: string, href: string) => (
    <a className="text-[#1B3A6B] underline" href={href}>{text}</a>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1
        className="text-3xl font-bold text-gray-900 mb-8"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        {c.title}
      </h1>

      <section className="prose prose-slate max-w-none space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{c.editor}</h2>
          <p className="text-gray-700">
            {c.editorBody[0]}<br />
            {c.editorBody[1]}<br />
            {c.editorBody[2].replace("support@mybestbooking.com", "")}
            {mailto("support@mybestbooking.com", "mailto:support@mybestbooking.com")}
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{c.hosting}</h2>
          <p className="text-gray-700">{c.hostingBody}</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{c.cgu}</h2>
          <p className="text-gray-700">{c.cguIntro}</p>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            {c.cguItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-gray-700 mt-3">{c.cguOutro}</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{c.cgv}</h2>
          <p className="text-gray-700">{c.cgvBody1}</p>
          <p className="text-gray-700 mt-3">{c.cgvBody2}</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{c.ip}</h2>
          <p className="text-gray-700">{c.ipBody}</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{c.law}</h2>
          <p className="text-gray-700">{c.lawBody}</p>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <p className="text-sm text-gray-500">
            {c.seeAlso}{" "}
            <a href="/confidentialite" className="text-[#1B3A6B] underline">
              {t("privacy.meta.title")}
            </a>.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            {c.updated} {new Date().toLocaleDateString(locale === "en" ? "en-GB" : "fr-FR")}
          </p>
        </div>
      </section>
    </div>
  );
}
