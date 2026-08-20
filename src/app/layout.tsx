import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "mybestbooking — Réservez mieux. Voyagez plus.",
    template: "%s | mybestbooking",
  },
  description: "Trouvez les meilleurs hébergements au meilleur prix. Prix garantis, avis vérifiés, 0 frais cachés.",
  keywords: ["réservation", "hôtel", "hébergement", "voyage", "booking", "vacances"],
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
      <body className="bg-gray-50 min-h-screen" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
