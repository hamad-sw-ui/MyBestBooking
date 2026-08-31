"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Building2, Calendar, Star,
  BarChart3, CreditCard, Users, Menu, X, Settings,
  Tag, BedDouble, MessageSquare, LogOut, HelpCircle, ScrollText
} from "lucide-react";
import { useState } from "react";
import type { User } from "@/db/schema";
import { UnreadMessagesBadge } from "@/components/unread-messages-badge";
import { DarkModeToggle } from "@/components/dark-mode-toggle";
import { useDisplayPreferences } from "@/lib/use-display-currency";
import { makeT } from "@/lib/ui-strings";

interface DashboardMobileHeaderProps {
  user: User;
  /** T-164 pattern : locale serveur pour le SSR (évite le flash FR). */
  initialLanguage?: string | null;
}

export function DashboardMobileHeader({ user, initialLanguage = null }: DashboardMobileHeaderProps) {
  const pathname = usePathname();
  const { language } = useDisplayPreferences();
  const t = makeT(language ?? initialLanguage);
  const [open, setOpen] = useState(false);

  const isAdmin = user.role === "admin";

  const links = isAdmin
    ? [
        { href: "/dashboard", icon: LayoutDashboard, label: t("dash.overview") },
        { href: "/dashboard/properties", icon: Building2, label: t("dash.properties") },
        { href: "/dashboard/bookings", icon: Calendar, label: t("dash.bookings") },
        { href: "/dashboard/users", icon: Users, label: t("dash.users") },
        { href: "/dashboard/reviews", icon: Star, label: t("dash.reviews") },
        { href: "/dashboard/promotions", icon: Tag, label: t("dash.promotions") },
        { href: "/dashboard/analytics", icon: BarChart3, label: t("dash.analytics") },
        { href: "/dashboard/billing", icon: CreditCard, label: t("dash.billing") },
        { href: "/dashboard/audit", icon: ScrollText, label: t("dash.audit") },
        { href: "/dashboard/settings", icon: Settings, label: t("dash.settings") },
      ]
    : [
        { href: "/dashboard", icon: LayoutDashboard, label: t("dash.overview") },
        { href: "/dashboard/properties", icon: Building2, label: t("dash.properties") },
        { href: "/dashboard/rooms", icon: BedDouble, label: t("dash.rooms") },
        { href: "/dashboard/bookings", icon: Calendar, label: t("dash.bookings") },
        { href: "/dashboard/reviews", icon: Star, label: t("dash.reviews") },
        { href: "/dashboard/messages", icon: MessageSquare, label: t("dash.messages") },
        { href: "/dashboard/analytics", icon: BarChart3, label: t("dash.analytics") },
        { href: "/dashboard/billing", icon: CreditCard, label: t("dash.billing") },
      ];

  return (
    <div className="lg:hidden fixed top-0 left-0 right-0 z-50">
      {/* Top bar */}
      <div className="h-16 bg-[#1B3A6B] flex items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-[#F5A623] text-xl">✦</span>
          <span className="font-bold text-white">MyBest</span>
          <span className="font-bold text-[#FF5A5F]">Booking</span>
        </Link>
        <div className="flex items-center gap-1">
          {/* T-154e (audit n°26, P3-11) : bascule dark mode accessible depuis
              le header mobile du dashboard (avant : uniquement header public). */}
          <DarkModeToggle className="p-2 rounded-lg text-white hover:bg-white/10 transition" />
          <button
            onClick={() => setOpen(!open)}
            className="p-2 rounded-lg text-white hover:bg-white/10"
          >
            {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Drawer */}
      {open && (
        <>
          <div className="fixed inset-0 top-16 bg-black/50" onClick={() => setOpen(false)} />
          <div className="fixed top-16 left-0 bottom-0 w-72 bg-[#1B3A6B] overflow-y-auto z-50">
            {/* User */}
            <div className="px-4 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white text-sm font-medium">
                  {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                </div>
                <div>
                  <p className="text-sm text-white font-medium truncate">{user.firstName} {user.lastName}</p>
                  <p className="text-xs text-white/60 capitalize">{user.role === "admin" ? t("dash.roleAdmin") : t("dash.roleHost")}</p>
                </div>
              </div>
            </div>

            {/* Nav */}
            <nav className="px-2 py-4 space-y-1">
              {links.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                      isActive
                        ? "bg-white/20 text-white"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="text-sm font-medium">{link.label}</span>
                    {link.href.includes("/messages") && (
                      <UnreadMessagesBadge viewerRole={user.role} userId={user.id} />
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Bottom */}
            <div className="px-2 py-4 border-t border-white/10 space-y-1">
              <Link
                href="/aide"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
              >
                <HelpCircle className="w-5 h-5" />
                <span className="text-sm font-medium">{t("dash.help")}</span>
              </Link>
              <form action="/api/auth/logout" method="POST">
                <button
                  type="submit"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 hover:bg-white/10 hover:text-white w-full"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="text-sm font-medium">{t("nav.logout")}</span>
                </button>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
