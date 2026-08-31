"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Menu, X, User, LogOut, Heart, Calendar, MessageSquare } from "lucide-react";
import { useState } from "react";
import type { User as UserType } from "@/db/schema";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { UnreadMessagesBadge } from "@/components/unread-messages-badge";
import { LanguageSelector } from "@/components/language-selector";
import { useDisplayPreferences } from "@/lib/use-display-currency";
import { makeT } from "@/lib/ui-strings";

interface HeaderProps {
  user: UserType | null;
  /** T-164 pattern : langue résolue côté serveur (cookie/compte) pour le
   *  rendu SSR — évite le flash FR du navbar avant hydratation. */
  initialLanguage?: string | null;
}

export function Header({ user, initialLanguage = null }: HeaderProps) {
  const pathname = usePathname();
  const { language } = useDisplayPreferences();
  // Le hook est l'autorité après hydratation ; la valeur SSR évite le
  // rendu franco-français de la première peinture pour un visiteur EN.
  const t = makeT(language ?? initialLanguage);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isActive = (path: string) => pathname === path;

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-[#F5A623] text-xl">✦</span>
            <span className="font-bold text-[#1B3A6B]">MyBest</span>
            <span className="font-bold text-[#FF5A5F]">Booking</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              href="/recherche"
              className={cn(
                "text-sm font-medium transition-colors",
                isActive("/recherche") ? "text-[#1B3A6B]" : "text-gray-600 hover:text-[#1B3A6B]"
              )}
            >
              {t("nav.accommodations")}
            </Link>
            <Link
              href="/bestrewards"
              className={cn(
                "text-sm font-medium transition-colors",
                isActive("/bestrewards") ? "text-[#F5A623]" : "text-gray-600 hover:text-[#F5A623]"
              )}
            >
              💎 BestRewards
            </Link>
            <Link
              href="/aide"
              className={cn(
                "text-sm font-medium transition-colors",
                isActive("/aide") ? "text-[#1B3A6B]" : "text-gray-600 hover:text-[#1B3A6B]"
              )}
            >
              {t("nav.help")}
            </Link>
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-4">
            <LanguageSelector user={user} initialLanguage={initialLanguage} />
            <DarkModeToggle initialLanguage={initialLanguage} />
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  aria-label={t("nav.userMenu")}
                  aria-expanded={userMenuOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-[#1B3A6B] flex items-center justify-center text-white text-sm font-medium">
                    {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                  </div>
                </button>

                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-2 z-50">
                      <div className="px-4 py-2 border-b border-gray-100">
                        <p className="text-sm font-medium text-gray-900">{user.firstName} {user.lastName}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                        {user.bestrewardsLevel && (
                          <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-[#F5A623] to-[#f7b84a] text-white">
                            💎 {t("nav.level")} {user.bestrewardsLevel}
                          </span>
                        )}
                      </div>
                      <Link
                        href="/mon-compte"
                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <User className="w-4 h-4" />
                        {t("nav.myAccount")}
                      </Link>
                      <Link
                        href="/mes-reservations"
                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Calendar className="w-4 h-4" />
                        {t("nav.bookings")}
                      </Link>
                      <Link
                        href="/mes-favoris"
                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Heart className="w-4 h-4" />
                        {t("nav.favorites")}
                      </Link>
                      <Link
                        href="/messages"
                        className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <MessageSquare className="w-4 h-4" />
                        {t("nav.messages")}
                        <UnreadMessagesBadge viewerRole={user.role} userId={user.id} />
                      </Link>
                      {(user.role === "host" || user.role === "admin") && (
                        <Link
                          href="/dashboard"
                          className="flex items-center gap-3 px-4 py-2 text-sm text-[#1B3A6B] font-medium hover:bg-gray-50 border-t border-gray-100 mt-2 pt-2"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          {t("nav.dashboard")}
                        </Link>
                      )}
                      <form action="/api/auth/logout" method="POST">
                        <button
                          type="submit"
                          className="flex items-center gap-3 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <LogOut className="w-4 h-4" />
                          {t("nav.logout")}
                        </button>
                      </form>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-3">
                <Link
                  href="/connexion"
                  className="text-sm font-medium text-gray-600 hover:text-[#1B3A6B] transition-colors"
                >
                  {t("nav.login")}
                </Link>
                <Link
                  href="/inscription"
                  className="text-sm font-medium px-4 py-2 bg-[#1B3A6B] text-white rounded-lg hover:bg-[#152d54] transition-colors"
                >
                  {t("nav.signup")}
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
              aria-expanded={mobileMenuOpen}
              className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" aria-hidden="true" /> : <Menu className="w-6 h-6" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <div className="px-4 py-4 space-y-2">
            <Link
              href="/recherche"
              className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t("nav.accommodations")}
            </Link>
            <Link
              href="/bestrewards"
              className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
              onClick={() => setMobileMenuOpen(false)}
            >
              💎 BestRewards
            </Link>
            <Link
              href="/aide"
              className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
              onClick={() => setMobileMenuOpen(false)}
            >
              {t("nav.help")}
            </Link>
            {!user ? (
              <div className="pt-4 border-t border-gray-100 space-y-2">
                <Link href="/connexion" className="block w-full px-4 py-2 text-center text-sm font-medium text-[#1B3A6B] border border-[#1B3A6B] rounded-lg" onClick={() => setMobileMenuOpen(false)}>{t("nav.login")}</Link>
                <Link href="/inscription" className="block w-full px-4 py-2 text-center text-sm font-medium text-white bg-[#1B3A6B] rounded-lg" onClick={() => setMobileMenuOpen(false)}>{t("nav.signup")}</Link>
              </div>
            ) : (
              <div className="pt-4 border-t border-gray-100 space-y-1">
                <Link href="/mon-compte" className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg" onClick={() => setMobileMenuOpen(false)}>{t("nav.myAccount")}</Link>
                <Link href="/mes-reservations" className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg" onClick={() => setMobileMenuOpen(false)}>{t("nav.bookings")}</Link>
                <Link href="/mes-favoris" className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg" onClick={() => setMobileMenuOpen(false)}>{t("nav.favorites")}</Link>
                <Link href="/messages" className="block px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg" onClick={() => setMobileMenuOpen(false)}>{t("nav.messages")}</Link>
                {(user.role === "host" || user.role === "admin") && <Link href="/dashboard" className="block px-4 py-2 text-sm font-medium text-[#1B3A6B] hover:bg-gray-50 rounded-lg" onClick={() => setMobileMenuOpen(false)}>{t("nav.dashboard")}</Link>}
                <form action="/api/auth/logout" method="POST" className="pt-2"><button type="submit" className="w-full text-left px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg">{t("nav.logout")}</button></form>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
