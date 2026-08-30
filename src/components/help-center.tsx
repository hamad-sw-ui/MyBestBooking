"use client";

import { useMemo, useState } from "react";
import { BookOpen, Mail, Search } from "lucide-react";

const articles = [
  { id: "cancel", category: "Réservations", title: "Annuler une réservation", body: "Ouvrez Mes réservations, choisissez une réservation confirmée puis Annuler. Les frais et le remboursement dépendent de la politique snapshotée dans votre réservation." },
  { id: "dates", category: "Réservations", title: "Modifier mes dates", body: "La modification directe n’est pas encore proposée. Annulez selon votre politique puis créez une nouvelle réservation, ou contactez l’hébergeur depuis votre conversation." },
  { id: "payment", category: "Paiement", title: "Paiement et confirmation", body: "Votre réservation est confirmée immédiatement après validation du paiement. En production avec un prestataire (Stripe), la confirmation suit le statut du paiement ; en mode démonstration, aucun débit réel n’est effectué." },
  { id: "refund", category: "Paiement", title: "Remboursement", body: "Après annulation, le montant et le statut de remboursement sont visibles dans Mes réservations. Les délais dépendent du moyen de paiement." },
  { id: "review", category: "Avis", title: "Laisser un avis", body: "Un avis est disponible après la fin effective du séjour. Vous pouvez aussi marquer les avis d’autres voyageurs comme utiles." },
  { id: "rewards", category: "BestRewards", title: "BestRewards et cashback", body: "Les niveaux progressent après les séjours terminés. Les réductions et le cashback Ambassador sont calculés selon les règles actives." },
  { id: "account", category: "Compte", title: "Sécurité et suppression du compte", body: "Mon compte permet de changer le mot de passe, activer la 2FA, gérer les alertes et demander la suppression du compte." },
  { id: "host", category: "Hébergeurs", title: "Gérer une chambre et ses tarifs", body: "Depuis le dashboard, ouvrez une chambre pour modifier son stock, ses capacités, son prix et ses plans tarifaires." },
];

export function HelpCenter() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(articles[0].id);
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    return needle ? articles.filter((article) => `${article.category} ${article.title} ${article.body}`.toLocaleLowerCase("fr").includes(needle)) : articles;
  }, [query]);
  const article = articles.find((item) => item.id === selected) ?? filtered[0] ?? null;

  return (
    <div className="bg-gray-50 min-h-screen">
      <section className="bg-[#1B3A6B] text-white py-16"><div className="max-w-4xl mx-auto px-4 text-center"><h1 className="text-3xl md:text-4xl font-bold mb-4">Comment pouvons-nous vous aider ?</h1><p className="text-white/80 mb-8">Recherchez une réponse ou contactez notre équipe par email.</p><label className="max-w-xl mx-auto relative block"><Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"/><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher dans l’aide…" className="w-full pl-12 pr-4 py-4 rounded-lg text-gray-900"/></label></div></section>
      <main className="max-w-5xl mx-auto px-4 py-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <section className="md:col-span-1 bg-white rounded-xl border border-gray-200 p-4"><h2 className="font-semibold text-gray-900 mb-3">Articles</h2>{filtered.length ? <ul className="space-y-1">{filtered.map((item) => <li key={item.id}><button type="button" onClick={() => setSelected(item.id)} className={`w-full text-left px-3 py-2 rounded text-sm ${selected === item.id ? "bg-blue-50 text-[#1B3A6B]" : "hover:bg-gray-50 text-gray-700"}`}>{item.title}</button></li>)}</ul> : <p className="text-sm text-gray-500">Aucun article ne correspond à votre recherche.</p>}</section>
        <article className="md:col-span-2 bg-white rounded-xl border border-gray-200 p-6"><BookOpen className="w-6 h-6 text-[#1B3A6B] mb-3"/>{article ? <><p className="text-xs text-gray-500">{article.category}</p><h2 className="text-2xl font-bold text-gray-900 mt-1">{article.title}</h2><p className="text-gray-700 mt-4 leading-7">{article.body}</p></> : <p className="text-gray-500">Sélectionnez un article.</p>}<a href="mailto:support@mybestbooking.com?subject=Aide%20MyBestBooking" className="inline-flex items-center mt-8 px-4 py-2 rounded-lg bg-[#1B3A6B] text-white text-sm"><Mail className="w-4 h-4 mr-2"/>Écrire au support</a></article>
      </main>
    </div>
  );
}
