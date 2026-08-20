import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { DashboardSidebar } from "@/components/layout/dashboard-sidebar";
import { DashboardMobileHeader } from "@/components/layout/dashboard-mobile-header";
import type { ReactNode } from "react";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/connexion");
  }

  if (user.role !== "admin" && user.role !== "host") {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <DashboardSidebar user={user} />
      </div>
      {/* Mobile header */}
      <DashboardMobileHeader user={user} />
      <main className="lg:pl-64 transition-all duration-300">
        <div className="p-4 md:p-8 pt-20 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
