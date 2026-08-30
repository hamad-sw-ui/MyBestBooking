import type { Metadata } from "next";
// T-162 (audit n°30) : page localisée — un visiteur en langue EN ne doit
// plus voir le contenu FR (titre du navigateur + libellés visibles).
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";

const CONTENT = {
  fr: {
    title: "Politique de confidentialité",
    collected: "Données collectées",
    collectedIntro: "MyBestBooking collecte les données nécessaires au fonctionnement du service :",
    collectedItems: [
      ["Compte", "email, nom, prénom, mot de passe (haché bcrypt coût 12)."],
      ["Profil optionnel", "téléphone, pays, langue, devise, fuseau horaire."],
      ["Réservations", "dates, hébergement, montant, mode de paiement (jamais le numéro complet de carte)."],
      ["Traçabilité", "IP au moment du login (pour la sécurité), dernière connexion."],
      ["Communication", "messages échangés avec les hôtes."],
    ],
    cookies: "Cookies",
    cookiesIntro: "MyBestBooking utilise uniquement des cookies techniques indispensables au fonctionnement du service (session utilisateur, préférence de thème clair/sombre). Aucun cookie tiers publicitaire ou de traçage.",
    cookiesItems: [
      ["session", "cookie HttpOnly, SameSite=Lax, expiration 30 jours (durée session, paramétrable dans le panneau d'administration)."],
      ["theme", "préférence clair/sombre, stockée dans localStorage."],
    ],
    rights: "Vos droits (RGPD)",
    rightsIntro: "Vous disposez, sur toutes vos données personnelles :",
    rightsItems: [
      ["Accès", "depuis Mon compte."],
      ["Rectification", "édition directe du profil dans Mon compte."],
      ["Suppression", "bouton « Supprimer mon compte » dans l'onglet Sécurité (soft-delete, anonymisation en base pour conservation des factures et avis conformément aux obligations légales)."],
      ["Portabilité", "sur demande à support@mybestbooking.com."],
      ["Opposition", "désabonnement possible depuis l'onglet Notifications."],
    ],
    security: "Sécurité",
    securityItems: [
      "Mots de passe hachés (bcrypt coût 12).",
      "Authentification à deux facteurs (TOTP) disponible.",
      "Rate-limiting sur toutes les routes d'authentification et de mutation.",
      "CSP stricte, headers de sécurité (HSTS, X-Frame-Options, Referrer-Policy).",
      "Rotation des secrets documentée (voir .ai/SECURITY.md côté équipe).",
    ],
    processors: "Sous-traitants",
    processorsIntro: "Pour fournir le service, MyBestBooking peut faire appel aux prestataires suivants (activation par variables d'environnement) :",
    processorsItems: [
      "Hébergement infra (Vercel / AWS / OVH selon déploiement)",
      "Paiement (Stripe)",
      "Email transactionnel (Resend)",
      "Stockage d'images (S3-compatible)",
    ],
    processorsOutro: "Chaque prestataire respecte le RGPD. Aucune donnée n'est transférée à des tiers à des fins commerciales.",
    dpo: "Contact délégué à la protection des données",
    seeAlso: "Voir aussi les Mentions légales.",
    updated: "Dernière mise à jour :",
  },
  en: {
    title: "Privacy policy",
    collected: "Data we collect",
    collectedIntro: "MyBestBooking collects the data needed to run the service:",
    collectedItems: [
      ["Account", "email, first name, last name, password (hashed, bcrypt cost 12)."],
      ["Optional profile", "phone, country, language, currency, timezone."],
      ["Bookings", "dates, accommodation, amount, payment method (never the full card number)."],
      ["Traceability", "IP at login (for security), last connection."],
      ["Communication", "messages exchanged with hosts."],
    ],
    cookies: "Cookies",
    cookiesIntro: "MyBestBooking uses only technical cookies required for the service to work (user session, light/dark theme preference). No third-party advertising or tracking cookies.",
    cookiesItems: [
      ["session", "HttpOnly cookie, SameSite=Lax, 30-day expiry (session duration, configurable in the admin panel)."],
      ["theme", "light/dark preference stored in localStorage."],
    ],
    rights: "Your rights (GDPR)",
    rightsIntro: "On all your personal data, you have:",
    rightsItems: [
      ["Access", "from My account."],
      ["Rectification", "direct profile editing in My account."],
      ["Deletion", "the “Delete my account” button in the Security tab (soft delete, anonymisation in the database to keep invoices and reviews as required by law)."],
      ["Portability", "on request to support@mybestbooking.com."],
      ["Opposition", "unsubscribe from the Notifications tab."],
    ],
    security: "Security",
    securityItems: [
      "Passwords hashed (bcrypt cost 12).",
      "Two-factor authentication (TOTP) available.",
      "Rate limiting on every authentication and mutation route.",
      "Strict CSP, security headers (HSTS, X-Frame-Options, Referrer-Policy).",
      "Secret rotation documented (see .ai/SECURITY.md for the team).",
    ],
    processors: "Sub-processors",
    processorsIntro: "To provide the service, MyBestBooking may use the following providers (enabled through environment variables):",
    processorsItems: [
      "Infrastructure hosting (Vercel / AWS / OVH depending on deployment)",
      "Payment (Stripe)",
      "Transactional email (Resend)",
      "Image storage (S3-compatible)",
    ],
    processorsOutro: "Each provider complies with the GDPR. No data is transferred to third parties for commercial purposes.",
    dpo: "Data protection officer contact",
    seeAlso: "See also our Legal notice.",
    updated: "Last updated:",
  },
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getServerLocale());
  return {
    title: t("privacy.meta.title"),
    description: t("privacy.meta.description"),
    robots: { index: true, follow: true },
  };
}

/**
 * /confidentialite (T-031) — page RGPD/cookies unique, contenue bilingue
 * (T-162 : la langue est celle du compte/cookie, français par défaut).
 */
export default async function ConfidentialitePage() {
  const locale = await getServerLocale();
  const c = CONTENT[locale === "en" ? "en" : "fr"];
  const t = makeT(locale);

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
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{c.collected}</h2>
          <p className="text-gray-700">{c.collectedIntro}</p>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            {c.collectedItems.map(([label, value]) => (
              <li key={label}><strong>{label}</strong> : {value}</li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{c.cookies}</h2>
          <p className="text-gray-700">{c.cookiesIntro}</p>
          <ul className="list-disc pl-6 space-y-1 text-gray-700 mt-3">
            {c.cookiesItems.map(([name, value]) => (
              <li key={name}><code className="text-xs bg-gray-100 px-1">{name}</code> — {value}</li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{c.rights}</h2>
          <p className="text-gray-700">{c.rightsIntro}</p>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            {c.rightsItems.map(([label, value]) => (
              <li key={label}><strong>{label}</strong> — {value}</li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{c.security}</h2>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            {c.securityItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{c.processors}</h2>
          <p className="text-gray-700">{c.processorsIntro}</p>
          <ul className="list-disc pl-6 space-y-1 text-gray-700">
            {c.processorsItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="text-gray-700 mt-3">{c.processorsOutro}</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-3">{c.dpo}</h2>
          <p className="text-gray-700">
            <a href="mailto:privacy@mybestbooking.com" className="text-[#1B3A6B] underline">
              privacy@mybestbooking.com
            </a>
          </p>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <p className="text-sm text-gray-500">
            {c.seeAlso}{" "}
            <a href="/mentions-legales" className="text-[#1B3A6B] underline">
              {t("legal.meta.title")}
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
