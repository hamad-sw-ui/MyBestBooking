import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { getCurrentUser } from "@/lib/auth";
import { getServerLocale } from "@/lib/server-locale";
import { isMaintenanceActive } from "@/lib/maintenance";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

// T-022 : force execution at request time (empêche le cache RSC de
// figer la décision maintenance/normal entre deux visiteurs).
export const dynamic = "force-dynamic";

export default async function MainLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  // T-164 (pattern) : langue SSR → le navbar est rendu dans la langue du
  // visiteur dès la première peinture (pas de flash FR pour un visiteur EN).
  const initialLanguage = await getServerLocale();

  // T-022 : mode maintenance — les non-admins sont renvoyés vers la
  // page /maintenance. Les admins traversent normalement (pour pouvoir
  // désactiver le mode depuis /dashboard/settings).
  if ((!user || user.role !== "admin") && (await isMaintenanceActive())) {
    redirect("/maintenance");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user} initialLanguage={initialLanguage} />
      <main id="main-content" className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
