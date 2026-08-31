"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Building2,
  BedDouble,
  Calendar,
  MessageSquare,
  Star,
  Users,
  Settings,
  BarChart3,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  LogOut,
  HelpCircle,
  Tag,
  ScrollText,
} from "lucide-react";
import { useState } from "react";
import type { User } from "@/db/schema";
import { UnreadMessagesBadge } from "@/components/unread-messages-badge";
import { useDisplayPreferences } from "@/lib/use-display-currency";
import { makeT } from "@/lib/ui-strings";

interface DashboardSidebarProps {
  user: User;
  /** T-164 pattern : locale serveur pour le SSR (évite le flash FR). */
  initialLanguage?: string | null;
}

export function DashboardSidebar({ user, initialLanguage = null }: DashboardSidebarProps) {
  const pathname = usePathname();
  const { language } = useDisplayPreferences();
  const t = makeT(language ?? initialLanguage);
  const [collapsed, setCollapsed] = useState(false);

  const isAdmin = user.role === "admin";
  const isHost = user.role === "host" || isAdmin;

  const hostLinks = [
    { href: "/dashboard", icon: LayoutDashboard, label: t("dash.overview") },
    { href: "/dashboard/properties", icon: Building2, label: t("dash.properties") },
    { href: "/dashboard/rooms", icon: BedDouble, label: t("dash.rooms") },
    { href: "/dashboard/bookings", icon: Calendar, label: t("dash.bookings") },
    { href: "/dashboard/reviews", icon: Star, label: t("dash.reviews") },
    { href: "/dashboard/messages", icon: MessageSquare, label: t("dash.messages") },
    { href: "/dashboard/analytics", icon: BarChart3, label: t("dash.analytics") },
    { href: "/dashboard/billing", icon: CreditCard, label: t("dash.billing") },
  ];

  const adminLinks = [
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
  ];

  const links = isAdmin ? adminLinks : (isHost ? hostLinks : []);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-full bg-[#1B3A6B] text-white transition-all duration-300 z-50",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className={cn("h-16 flex items-center border-b border-white/10 px-4", collapsed && "justify-center")}>
        {!collapsed && (
          <Link href="/" className="flex items-center gap-2">
            <span className="text-[#F5A623] text-xl">✦</span>
            <span className="font-bold text-white">MyBest</span>
            <span className="font-bold text-[#FF5A5F]">Booking</span>
          </Link>
        )}
        {collapsed && (
          <span className="text-[#F5A623] text-2xl">✦</span>
        )}
      </div>

      {/* User info */}
      {!collapsed && (
        <div className="px-4 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-sm font-medium">
              {user.firstName.charAt(0)}{user.lastName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.firstName} {user.lastName}</p>
              <p className="text-xs text-white/60 capitalize">{t(user.role === "admin" ? "nav.roleAdmin" : "nav.roleHost")}</p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {links.map((link) => {
          const Icon = link.icon;
          const isActive = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
          
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                isActive 
                  ? "bg-white/20 text-white" 
                  : "text-white/70 hover:bg-white/10 hover:text-white",
                collapsed && "justify-center"
              )}
              title={collapsed ? link.label : undefined}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="text-sm font-medium">{link.label}</span>}
              {!collapsed && link.href.includes("/messages") && (
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
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors",
            collapsed && "justify-center"
          )}
          title={collapsed ? t("dash.help") : undefined}
        >
          <HelpCircle className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">{t("dash.help")}</span>}
        </Link>
        
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors w-full",
              collapsed && "justify-center"
            )}
            title={collapsed ? t("nav.logout") : undefined}
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium">{t("nav.logout")}</span>}
          </button>
        </form>

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full mt-2 p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>
    </aside>
  );
}
