import Link from "next/link";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import { hostEntryHref } from "@/lib/host-entry";

/**
 * Footer public. Ne référence QUE des routes qui existent réellement
 * (règle R19 du framework — pas de lien qui envoie sur une 404).
 * Les liens marketing/entreprise non implémentés sont volontairement
 * remplacés par du texte grisé plutôt que par des liens morts.
 *
 * T-180 : le lien « Ajouter mon hébergement » tient désormais compte du
 * rôle du visiteur (passé par le layout) : hôte/admin → son dashboard
 * (inchangé) ; voyageur/anonyme → inscription avec rôle hôte
 * présélectionné, au lieu de l'impasse silencieuse sur `/`.
 */
export async function Footer({ userRole }: { userRole?: string | null } = {}) {
  const t = makeT(await getServerLocale());
  return (
    <footer className="bg-[#1B3A6B] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Découvrir */}
          <div>
            <h3 className="text-sm font-semibold mb-4">{t("footer.discover")}</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/recherche" className="text-sm text-gray-300 hover:text-white transition-colors">
                  {t("footer.searchAccommodation")}
                </Link>
              </li>
              <li>
                <Link href="/bestrewards" className="text-sm text-gray-300 hover:text-white transition-colors">
                  💎 BestRewards
                </Link>
              </li>
              <li>
                <Link href="/aide" className="text-sm text-gray-300 hover:text-white transition-colors">
                  {t("footer.helpCenter")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Voyageurs */}
          <div>
            <h3 className="text-sm font-semibold mb-4">{t("footer.travelers")}</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/mon-compte" className="text-sm text-gray-300 hover:text-white transition-colors">
                  {t("nav.myAccount")}
                </Link>
              </li>
              <li>
                <Link href="/mes-reservations" className="text-sm text-gray-300 hover:text-white transition-colors">
                  {t("nav.bookings")}
                </Link>
              </li>
              <li>
                <Link href="/mes-favoris" className="text-sm text-gray-300 hover:text-white transition-colors">
                  {t("nav.favorites")}
                </Link>
              </li>
              <li>
                <Link href="/messages" className="text-sm text-gray-300 hover:text-white transition-colors">
                  {t("footer.messaging")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Hébergeurs */}
          <div>
            <h3 className="text-sm font-semibold mb-4">{t("footer.hosts")}</h3>
            <ul className="space-y-2">
              <li>
                <Link href={hostEntryHref(userRole)} className="text-sm text-gray-300 hover:text-white transition-colors">
                  {t("footer.addProperty")}
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-sm text-gray-300 hover:text-white transition-colors">
                  {t("footer.hostArea")}
                </Link>
              </li>
              <li>
                <Link href="/inscription" className="text-sm text-gray-300 hover:text-white transition-colors">
                  {t("footer.createAccount")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold mb-4">{t("footer.contact")}</h3>
            <ul className="space-y-2">
              <li>
                <a
                  href="mailto:support@mybestbooking.com"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  📧 support@mybestbooking.com
                </a>
              </li>
              <li>
                <a
                  href="mailto:partners@mybestbooking.com"
                  className="text-sm text-gray-300 hover:text-white transition-colors"
                >
                  🤝 partners@mybestbooking.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="mt-12 pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[#F5A623] text-xl">✦</span>
              <span className="font-bold">MyBest</span>
              <span className="font-bold text-[#FF5A5F]">Booking</span>
              <span className="text-xs text-gray-400">.com</span>
            </div>
            <p className="text-sm text-gray-400">
              &ldquo;{t("footer.tagline")}&rdquo;
            </p>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <Link href="/mentions-legales" className="hover:text-white transition-colors">
                {t("footer.legal")}
              </Link>
              <Link href="/confidentialite" className="hover:text-white transition-colors">
                {t("footer.privacy")}
              </Link>
            </div>
          </div>
          <p className="text-center text-xs text-gray-500 mt-6">
            {t("footer.rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}
