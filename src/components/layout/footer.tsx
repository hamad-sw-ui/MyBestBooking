import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-[#1B3A6B] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Company */}
          <div>
            <h3 className="text-sm font-semibold mb-4">mybestbooking</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/a-propos" className="text-sm text-gray-300 hover:text-white transition-colors">
                  À propos
                </Link>
              </li>
              <li>
                <Link href="/carrieres" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Carrières
                </Link>
              </li>
              <li>
                <Link href="/presse" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Presse
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          {/* Discover */}
          <div>
            <h3 className="text-sm font-semibold mb-4">Découvrir</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/bestrewards" className="text-sm text-gray-300 hover:text-white transition-colors">
                  💎 BestRewards
                </Link>
              </li>
              <li>
                <Link href="/garantie-prix" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Garantie Prix
                </Link>
              </li>
              <li>
                <Link href="/destinations" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Destinations
                </Link>
              </li>
              <li>
                <Link href="/avis" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Avis vérifiés
                </Link>
              </li>
            </ul>
          </div>

          {/* Partners */}
          <div>
            <h3 className="text-sm font-semibold mb-4">Partenaires</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/devenir-partenaire" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Devenir partenaire
                </Link>
              </li>
              <li>
                <Link href="/extranet" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Extranet hébergeurs
                </Link>
              </li>
              <li>
                <Link href="/affiliation" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Programme d&apos;affiliation
                </Link>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-sm font-semibold mb-4">Aide</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/aide" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Centre d&apos;aide
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-gray-300 hover:text-white transition-colors">
                  Nous contacter
                </Link>
              </li>
              <li>
                <span className="text-sm text-gray-300">
                  📧 support@mybestbooking.com
                </span>
              </li>
              <li>
                <span className="text-sm text-gray-300">
                  💬 Chat 24/7
                </span>
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
              <Link href="/cgu" className="hover:text-white transition-colors">CGU</Link>
              <Link href="/cgv" className="hover:text-white transition-colors">CGV</Link>
              <Link href="/confidentialite" className="hover:text-white transition-colors">Confidentialité</Link>
              <Link href="/cookies" className="hover:text-white transition-colors">Cookies</Link>
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
