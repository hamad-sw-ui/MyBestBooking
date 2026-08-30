"use client";

import { useMemo, useState } from "react";
import { BookOpen, Mail, Search } from "lucide-react";
// T-158 (audit n°29) : centre d'aide bilingue — un visiteur en langue EN ne
// doit plus voir les articles/libellés FR en dur.
import { useDisplayPreferences } from "@/lib/use-display-currency";
import { makeT } from "@/lib/ui-strings";

type HelpArticle = {
  id: string;
  fr: { category: string; title: string; body: string };
  en: { category: string; title: string; body: string };
};

/** Articles du centre d'aide — contenu éditorial bilingue (V1 fr/en). */
const HELP_ARTICLES: HelpArticle[] = [
  {
    id: "cancel",
    fr: {
      category: "Réservations",
      title: "Annuler une réservation",
      body: "Ouvrez Mes réservations, choisissez une réservation confirmée puis Annuler. Les frais et le remboursement dépendent de la politique snapshotée dans votre réservation.",
    },
    en: {
      category: "Bookings",
      title: "Cancel a booking",
      body: "Open My bookings, choose a confirmed booking then Cancel. Fees and refunds depend on the policy snapshot stored in your booking.",
    },
  },
  {
    id: "dates",
    fr: {
      category: "Réservations",
      title: "Modifier mes dates",
      body: "La modification directe n'est pas encore proposée. Annulez selon votre politique puis créez une nouvelle réservation, ou contactez l'hébergeur depuis votre conversation.",
    },
    en: {
      category: "Bookings",
      title: "Change my dates",
      body: "Direct date changes are not available yet. Cancel according to your policy then create a new booking, or contact the host from your conversation.",
    },
  },
  {
    id: "payment",
    fr: {
      category: "Paiement",
      title: "Paiement et confirmation",
      body: "Votre réservation est confirmée immédiatement après validation du paiement. En production avec un prestataire (Stripe), la confirmation suit le statut du paiement ; en mode démonstration, aucun débit réel n'est effectué.",
    },
    en: {
      category: "Payment",
      title: "Payment and confirmation",
      body: "Your booking is confirmed right after the payment is validated. In production with a provider (Stripe), confirmation follows the payment status; in demo mode, no real charge is made.",
    },
  },
  {
    id: "refund",
    fr: {
      category: "Paiement",
      title: "Remboursement",
      body: "Après annulation, le montant et le statut de remboursement sont visibles dans Mes réservations. Les délais dépendent du moyen de paiement.",
    },
    en: {
      category: "Payment",
      title: "Refund",
      body: "After a cancellation, the amount and refund status are visible in My bookings. Delays depend on the payment method.",
    },
  },
  {
    id: "review",
    fr: {
      category: "Avis",
      title: "Laisser un avis",
      body: "Un avis est disponible après la fin effective du séjour. Vous pouvez aussi marquer les avis d'autres voyageurs comme utiles.",
    },
    en: {
      category: "Reviews",
      title: "Leave a review",
      body: "A review becomes available once the stay is over. You can also mark other travellers' reviews as helpful.",
    },
  },
  {
    id: "rewards",
    fr: {
      category: "BestRewards",
      title: "BestRewards et cashback",
      body: "Les niveaux progressent après les séjours terminés. Les réductions et le cashback Ambassador sont calculés selon les règles actives.",
    },
    en: {
      category: "BestRewards",
      title: "BestRewards and cashback",
      body: "Tiers progress after completed stays. Discounts and Ambassador cashback are calculated according to the active rules.",
    },
  },
  {
    id: "account",
    fr: {
      category: "Compte",
      title: "Sécurité et suppression du compte",
      body: "Mon compte permet de changer le mot de passe, activer la 2FA, gérer les alertes et demander la suppression du compte.",
    },
    en: {
      category: "Account",
      title: "Security and account deletion",
      body: "My account lets you change your password, enable 2FA, manage alerts and request account deletion.",
    },
  },
  {
    id: "host",
    fr: {
      category: "Hébergeurs",
      title: "Gérer une chambre et ses tarifs",
      body: "Depuis le dashboard, ouvrez une chambre pour modifier son stock, ses capacités, son prix et ses plans tarifaires.",
    },
    en: {
      category: "Hosts",
      title: "Manage a room and its rates",
      body: "From the dashboard, open a room to change its stock, capacity, price and rate plans.",
    },
  },
];

export function HelpCenter() {
  const { language } = useDisplayPreferences();
  const t = makeT(language);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(HELP_ARTICLES[0].id);

  // Articles de la langue courante (le contenu éditorial est bilingue) —
  // la recherche filtre le texte affiché, donc dans la langue active.
  const articles = useMemo(
    () =>
      HELP_ARTICLES.map((a) => ({ id: a.id, ...(language === "en" ? a.en : a.fr) })),
    [language],
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase(language === "en" ? "en" : "fr");
    return needle
      ? articles.filter((article) =>
          `${article.category} ${article.title} ${article.body}`
            .toLocaleLowerCase(language === "en" ? "en" : "fr")
            .includes(needle),
        )
      : articles;
  }, [query, articles, language]);
  const article = articles.find((item) => item.id === selected) ?? filtered[0] ?? null;

  return (
    <div className="bg-gray-50 min-h-screen">
      <section className="bg-[#1B3A6B] text-white py-16"><div className="max-w-4xl mx-auto px-4 text-center"><h1 className="text-3xl md:text-4xl font-bold mb-4">{t("help.heroTitle")}</h1><p className="text-white/80 mb-8">{t("help.heroSubtitle")}</p><label className="max-w-xl mx-auto relative block"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"/><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("help.searchPlaceholder")} className="w-full pl-12 pr-4 py-4 rounded-lg text-gray-900"/></label></div></section>
      <main className="max-w-5xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <section className="md:col-span-1 bg-white rounded-xl border border-gray-200 p-4"><h2 className="font-semibold text-gray-900 mb-3">{t("help.articles")}</h2>{filtered.length ? <ul className="space-y-1">{filtered.map((item) => <li key={item.id}><button type="button" onClick={() => setSelected(item.id)} className={`w-full text-left px-3 py-2 rounded text-sm ${selected === item.id ? "bg-blue-50 text-[#1B3A6B]" : "hover:bg-gray-50 text-gray-700"}`}>{item.title}</button></li>)}</ul> : <p className="text-sm text-gray-500">{t("help.noResults")}</p>}</section>
        <article className="md:col-span-2 bg-white rounded-xl border border-gray-200 p-6"><BookOpen className="w-6 h-6 text-[#1B3A6B] mb-3"/>{article ? <><p className="text-xs text-gray-500">{article.category}</p><h2 className="text-2xl font-bold text-gray-900 mt-1">{article.title}</h2><p className="text-gray-700 mt-4 leading-7">{article.body}</p></> : <p className="text-gray-500">{t("help.selectArticle")}</p>}<a href={`mailto:support@mybestbooking.com?subject=${encodeURIComponent(t("help.mailSubject"))}`} className="inline-flex items-center mt-8 px-4 py-2 rounded-lg bg-[#1B3A6B] text-white text-sm"><Mail className="w-4 h-4 mr-2"/>{t("help.writeSupport")}</a></article>
      </main>
    </div>
  );
}
