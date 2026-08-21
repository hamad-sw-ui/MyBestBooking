import Link from "next/link";

/**
 * Footer public. Ne référence QUE des routes qui existent réellement
 * (règle R19 du framework — pas de lien qui envoie sur une 404).
 * Les liens marketing/entreprise non implémentés sont volontairement
 * remplacés par du texte grisé plutôt que par des liens morts.
 */
export function Footer() {
  return (
    <footer className="bg-[#1B3A6B] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Découvrir */}
          <div>
            <h3 className="text-sm font-semibold mb-4">Découvrir</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/recherche" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Rechercher un hébergement
                </Link>
              </li>
              <li>
                <Link href="/bestrewards" className="text-sm text-gray-300 hover:text-white transition-colors">
                  💎 BestRewards
                </Link>
              </li>
              <li>
                <Link href="/aide" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Centre d&apos;aide
                </Link>
              </li>
            </ul>
          </div>

          {/* Voyageurs */}
          <div>
            <h3 className="text-sm font-semibold mb-4">Voyageurs</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/mon-compte" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Mon compte
                </Link>
              </li>
              <li>
                <Link href="/mes-reservations" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Mes réservations
                </Link>
              </li>
              <li>
                <Link href="/mes-favoris" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Mes favoris
                </Link>
              </li>
              <li>
                <Link href="/messages" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Messagerie
                </Link>
              </li>
            </ul>
          </div>

          {/* Hébergeurs */}
          <div>
            <h3 className="text-sm font-semibold mb-4">Hébergeurs</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/dashboard/properties/new" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Ajouter mon hébergement
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Espace hébergeur
                </Link>
              </li>
              <li>
                <Link href="/inscription" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Créer un compte
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-sm font-semibold mb-4">Contact</h3>
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
              <span className="font-bold">mybest</span>
              <span className="font-bold text-[#FF5A5F]">booking</span>
              <span className="text-xs text-gray-400">.com</span>
            </div>
            <p className="text-sm text-gray-400">
              &quot;Réservez mieux. Voyagez plus.&quot;
            </p>
            <div className="flex items-center gap-4 text-sm text-gray-400">
              <Link href="/mentions-legales" className="hover:text-white transition-colors">
                Mentions légales
              </Link>
              <Link href="/confidentialite" className="hover:text-white transition-colors">
                Confidentialité
              </Link>
            </div>
          </div>
          <p className="text-center text-xs text-gray-500 mt-6">
            © 2025 mybestbooking.com — Tous droits réservés
          </p>
        </div>
      </div>
    </footer>
  );
}
