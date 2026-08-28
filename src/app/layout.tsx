import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { ToastProvider } from "@/components/ui/toast";
import { MaintenanceGate } from "@/components/maintenance-gate";
import { getCurrentUser } from "@/lib/auth";
import "./globals.css";

// Les polices restent locales afin que le rendu initial ne dépende pas
// d'un CDN externe, notamment dans les environnements sans réseau.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "mybestbooking — Réservez mieux. Voyagez plus.",
    template: "%s | mybestbooking",
  },
  description:
    "Trouvez des hébergements, consultez les avis vérifiés et comparez les offres disponibles.",
  keywords: [
    "réservation",
    "hôtel",
    "hébergement",
    "voyage",
    "booking",
    "vacances",
  ],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: "mybestbooking",
    title: "mybestbooking — Réservez mieux. Voyagez plus.",
    description:
      "Trouvez des hébergements, consultez les avis vérifiés et comparez les offres disponibles.",
  },
  twitter: {
    card: "summary_large_image",
    title: "mybestbooking",
    description: "Réservez mieux. Voyagez plus.",
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // T-128 : un admin doit pouvoir traverser le site pendant la maintenance
  // (pour la désactiver). On lit le rôle côté serveur (JWT/session) et on le
  // passe à la garde cliente sous forme d'un simple booléen.
  const user = await getCurrentUser().catch(() => null);
  const isAdmin = user?.role === "admin";
  return (
    <html lang="fr" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="bg-gray-50 min-h-screen font-sans">
        {/* T-128 : bascule l'affichage vers /maintenance sur plein-chargement. */}
        <MaintenanceGate isAdmin={isAdmin} />
        {/* T-029 : skip link a11y */}
        <a href="#main-content" className="skip-link">Aller au contenu principal</a>
        {/* T-029 : pré-applique la classe .dark sans FOUC */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('theme');" +
              "var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);" +
              "if(d)document.documentElement.classList.add('dark');}catch(e){}",
          }}
        />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
