import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { ToastProvider } from "@/components/ui/toast";
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
    "Trouvez les meilleurs hébergements au meilleur prix. Prix garantis, avis vérifiés, 0 frais cachés.",
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
      "Trouvez les meilleurs hébergements au meilleur prix. Prix garantis, avis vérifiés, 0 frais cachés.",
  },
  twitter: {
    card: "summary_large_image",
    title: "mybestbooking",
    description: "Réservez mieux. Voyagez plus.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="bg-gray-50 min-h-screen font-sans">
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
