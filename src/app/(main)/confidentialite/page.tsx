import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Politique de traitement des données personnelles et de cookies de MyBestBooking (RGPD).",
  robots: { index: true, follow: true },
};

/**
 * /confidentialite (T-031)
 * Page RGPD / cookies unique. Contenu de base V1.
 */
export default function ConfidentialitePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h1
        className="text-3xl font-bold text-gray-900 mb-8"
        style={{ fontFamily: "'Poppins', sans-serif" }}
      >
        Politique de confidentialité
      </h1>

      <section className="prose prose-slate max-w-none space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Données collectées</h2>
          <p className="text-gray-700">
            MyBestBooking collecte les données nécessaires au fonctionnement du service :
          </p>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li><strong>Compte</strong> : email, nom, prénom, mot de passe (haché bcrypt coût 12).</li>
            <li><strong>Profil optionnel</strong> : téléphone, pays, langue, devise, fuseau horaire.</li>
            <li><strong>Réservations</strong> : dates, hébergement, montant, mode de paiement (jamais le numéro complet de carte).</li>
            <li><strong>Traçabilité</strong> : IP au moment du login (pour la sécurité), dernière connexion.</li>
            <li><strong>Communication</strong> : messages échangés avec les hôtes.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Cookies</h2>
          <p className="text-gray-700">
            MyBestBooking utilise <strong>uniquement</strong> des cookies techniques
            indispensables au fonctionnement du service (session utilisateur,
            préférence de thème clair/sombre). Aucun cookie tiers publicitaire ou
            de traçage.
          </p>
          <ul className="list-disc pl-6 space-y-1 text-gray-700 mt-3">
            <li><code className="text-xs bg-gray-100 px-1">session</code> — cookie HttpOnly, SameSite=Lax, expiration 30 jours (durée session, paramétrable dans le panneau d&apos;administration).</li>
            <li><code className="text-xs bg-gray-100 px-1">theme</code> — préférence clair/sombre, stockée dans <code className="text-xs bg-gray-100 px-1">localStorage</code>.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Vos droits (RGPD)</h2>
          <p className="text-gray-700">Vous disposez, sur toutes vos données personnelles :</p>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li><strong>Accès</strong> — depuis <a href="/mon-compte" className="text-[#1B3A6B] underline">Mon compte</a>.</li>
            <li><strong>Rectification</strong> — édition directe du profil dans Mon compte.</li>
            <li><strong>Suppression</strong> — bouton « Supprimer mon compte » dans l&apos;onglet Sécurité (soft-delete, anonymisation en base pour conservation des factures et avis conformément aux obligations légales).</li>
            <li><strong>Portabilité</strong> — sur demande à <a href="mailto:support@mybestbooking.com" className="text-[#1B3A6B] underline">support@mybestbooking.com</a>.</li>
            <li><strong>Opposition</strong> — désabonnement possible depuis l&apos;onglet Notifications.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Sécurité</h2>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>Mots de passe hachés (bcrypt coût 12).</li>
            <li>Authentification à deux facteurs (TOTP) disponible.</li>
            <li>Rate-limiting sur toutes les routes d&apos;authentification et de mutation.</li>
            <li>CSP stricte, headers de sécurité (HSTS, X-Frame-Options, Referrer-Policy).</li>
            <li>Rotation des secrets documentée (voir <code className="text-xs bg-gray-100 px-1">.ai/SECURITY.md</code> côté équipe).</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Sous-traitants</h2>
          <p className="text-gray-700">
            Pour fournir le service, MyBestBooking peut faire appel aux
            prestataires suivants (activation par variables d&apos;environnement) :
          </p>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            <li>Hébergement infra (Vercel / AWS / OVH selon déploiement)</li>
            <li>Paiement (Stripe)</li>
            <li>Email transactionnel (Resend)</li>
            <li>Stockage d&apos;images (S3-compatible)</li>
          </ul>
          <p className="text-gray-700 mt-3">
            Chaque prestataire respecte le RGPD. Aucune donnée n&apos;est
            transférée à des tiers à des fins commerciales.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">Contact délégué à la protection des données</h2>
          <p className="text-gray-700">
            <a href="mailto:privacy@mybestbooking.com" className="text-[#1B3A6B] underline">
              privacy@mybestbooking.com
            </a>
          </p>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <p className="text-sm text-gray-500">
            Voir aussi les{" "}
            <a href="/mentions-legales" className="text-[#1B3A6B] underline">Mentions légales</a>.
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}
          </p>
        </div>
      </section>
    </div>
  );
}
