import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";
import { ToastProvider } from "@/components/ui/toast";
import { MaintenanceGate } from "@/components/maintenance-gate";
import { UiLocaleProvider } from "@/components/ui-locale-provider";
import { getCurrentUser } from "@/lib/auth";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import "./globals.css";

// Les polices restent locales afin que le rendu initial ne dépende pas
// d'un CDN externe, notamment dans les environnements sans réseau.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const t = makeT(locale);
  return {
  metadataBase: new URL(APP_URL),
  title: {
    default: t("meta.appTitle"),
    template: "%s | MyBestBooking",
  },
  description: t("meta.appDescription"),
  keywords: [
    t("meta.kw.booking"),
    t("meta.kw.hotel"),
    t("meta.kw.stay"),
    t("meta.kw.travel"),
    "booking",
    t("meta.kw.vacations"),
  ],
  openGraph: {
    type: "website",
    locale: locale === "en" ? "en_GB" : "fr_FR",
    siteName: "MyBestBooking",
    title: t("meta.appTitle"),
    description: t("meta.appDescription"),
  },
  twitter: {
    card: "summary_large_image",
    title: "MyBestBooking",
    description: t("footer.tagline"),
  },
  // T-135 — pas de `robots: { index: true }` forcé ici : il entrait en
  // conflit avec la balise `<meta name="robots" content="noindex">` que
  // Next.js émet automatiquement pour les réponses notFound() streamées
  // (les soft-404 renvoient 200 en streaming — voir doc Next, loading.md
  // « Status codes »). Sans surcharge, les pages normales restent
  // indexables (défaut « index, follow ») et les 404 reçoivent bien
  // « noindex ». Les pages qui veulent forcer une directive le font au
  // niveau page (ex. maintenance : index:false ; mentions légales).
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // T-128 : un admin doit pouvoir traverser le site pendant la maintenance
  // (pour la désactiver). On lit le rôle côté serveur (JWT/session) et on le
  // passe à la garde cliente sous forme d'un simple booléen.
  const user = await getCurrentUser().catch(() => null);
  const isAdmin = user?.role === "admin";
  // T-152 (audit n°24, D) : `lang` suit la langue résolue (compte connecté
  // puis défaut plateforme puis « fr ») au lieu d'être figé sur « fr ».
  const locale = await getServerLocale();
  const hasAccount = Boolean(user);
  return (
    <html lang={locale} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="bg-gray-50 min-h-screen font-sans">
        {/* T-128 : bascule l'affichage vers /maintenance sur plein-chargement. */}
        <MaintenanceGate isAdmin={isAdmin} />
        {/* T-029 : skip link a11y */}
        <a href="#main-content" className="skip-link">{makeT(locale)("a11y.skipToContent")}</a>
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
        {/* T-152 (D) : langue avant hydratation pour les visiteurs sans
            compte (le serveur a déjà rendu lang=compte pour les connectés) */}
        <Script
          id="lang-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "try{var hasAccount=" + JSON.stringify(hasAccount) + ";" +
              "if(!hasAccount){var s=localStorage.getItem('mybb:ui-language');" +
              "if(s==='en'||s==='fr'){document.documentElement.lang=s;" +
              "document.cookie='mybb:ui-language='+s+';path=/;max-age=31536000;SameSite=Lax';}" +
              "}catch(e){}",
          }}
        />
        <UiLocaleProvider initialLanguage={locale}>
          <ToastProvider>{children}</ToastProvider>
        </UiLocaleProvider>
      </body>
    </html>
  );
}
