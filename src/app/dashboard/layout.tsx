import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getServerLocale } from "@/lib/server-locale";
import { isMaintenanceActive } from "@/lib/maintenance";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { DashboardMobileHeader } from "@/components/layout/dashboard-mobile-header";
import type { ReactNode } from "react";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  // T-164 pattern : langue SSR → navigation dashboard rendue dans la langue
  // du compte dès la première peinture (pas de flash FR pour un compte EN).
  const initialLanguage = await getServerLocale();

  if (!user) {
    redirect("/connexion");
  }

  if (user.role !== "admin" && user.role !== "host") {
    redirect("/");
  }

  // T-022 : en mode maintenance, seuls les admins accèdent au dashboard.
  // Un host est renvoyé vers /maintenance (au même titre qu'un customer).
  if (user.role !== "admin" && (await isMaintenanceActive())) {
    redirect("/maintenance");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <DashboardSidebar user={user} initialLanguage={initialLanguage} />
      </div>
      {/* Mobile header */}
      <DashboardMobileHeader user={user} initialLanguage={initialLanguage} />
      <main className="lg:pl-64 transition-all duration-300">
        <div className="p-4 md:p-8 pt-20 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
