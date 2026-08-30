import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mentions légales",
  description: "Mentions légales, conditions générales d'utilisation et de vente de MyBestBooking.",
  robots: { index: true, follow: true },
};

/**
 * /mentions-legales (T-031)
 * Page unique regroupant Mentions légales + CGU + CGV.
 * Contenu de base V1 pour ne plus avoir de lien mort en footer.
 * L'entreprise éditrice remplacera les blocs [Raison sociale], etc.
 * avant mise en production.
 */
export default function MentionsLegalesPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1
        className="text-3xl font-bold text-gray-900 mb-8"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        Mentions légales
      </h1>

      <section className="prose prose-slate max-w-none space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Éditeur du site</h2>
          <p className="text-gray-700">
            <strong>MyBestBooking</strong> — plateforme de réservation d&apos;hébergements.
            <br />
            Raison sociale : à compléter par l&apos;éditeur en production.
            <br />
            Contact : <a className="text-[#1B3A6B] underline" href="mailto:support@mybestbooking.com">support@mybestbooking.com</a>
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Hébergement</h2>
          <p className="text-gray-700">
            Le site est hébergé sur une infrastructure cloud
            professionnelle (Vercel / Neon PostgreSQL ou équivalent).
            Détails à préciser en production.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Conditions générales d&apos;utilisation</h2>
          <p className="text-gray-700">
            En utilisant MyBestBooking, vous acceptez de :
          </p>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>Fournir des informations exactes lors de l&apos;inscription.</li>
            <li>Ne pas utiliser le service à des fins illégales.</li>
            <li>Respecter les règles de chaque hébergement réservé.</li>
            <li>Ne pas publier d&apos;avis diffamatoire ou faux.</li>
          </ul>
          <p className="text-gray-700 mt-3">
            MyBestBooking se réserve le droit de suspendre tout compte
            en violation de ces règles (voir Modération dans le panneau
            d&apos;administration).
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Conditions générales de vente</h2>
          <p className="text-gray-700">
            Les tarifs sont exprimés TTC. La TVA appliquée est
            paramétrée par l&apos;éditeur dans le panneau d&apos;administration
            (10 % par défaut). Les frais d&apos;annulation dépendent de la
            politique d&apos;annulation de chaque hébergement (Free,
            Flexible, Modérée, Stricte, Non remboursable).
          </p>
          <p className="text-gray-700 mt-3">
            Le paiement est traité par un prestataire de confiance
            (Stripe ou équivalent). MyBestBooking n&apos;a jamais accès
            aux données de carte bancaire complètes.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Propriété intellectuelle</h2>
          <p className="text-gray-700">
            L&apos;ensemble des contenus (marque, logo, textes, code) est
            protégé. Les photos d&apos;hébergement appartiennent à leurs
            propriétaires respectifs.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Droit applicable</h2>
          <p className="text-gray-700">
            Le présent document est régi par le droit français. Tout
            litige relève de la compétence exclusive des tribunaux
            français, sauf disposition impérative contraire.
          </p>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <p className="text-sm text-gray-500">
            Pour la politique de traitement des données personnelles,
            voir la page{" "}
            <a href="/confidentialite" className="text-[#1B3A6B] underline">
              Confidentialité
            </a>.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}
          </p>
        </div>
      </section>
    </div>
  );
}
