import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

// T-017 (note) : les fonts sont chargées via <link> plutôt que
// `next/font/google` parce que le sandbox n'a pas d'accès au CDN
// Google Fonts au build time et fait échouer `next build`. En prod
// avec accès CDN, `next/font/google` est préférable (inlining + no
// FOUT). Migration prévue backlog quand la CI aura un accès réseau
// stable. Voir KNOWN_LIMITATIONS.md.

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
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Poppins:wght@600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-gray-50 min-h-screen font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
