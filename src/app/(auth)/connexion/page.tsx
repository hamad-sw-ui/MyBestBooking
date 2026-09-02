import type { Metadata } from "next";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import LoginPage from "./login-client";

/**
 * T-172 (audit UIT 2026-09-01) — la page de connexion est un composant
 * client (`useSearchParams`…) et ne peut donc pas exporter de métadonnées.
 * Ce wrapper serveur fournit un `<title>` localisé (FR/EN) au lieu du titre
 * générique du layout racine. Pages publiques : restent indexables.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getServerLocale());
  return {
    title: t("auth.meta.loginTitle"),
    description: t("meta.appDescription"),
  };
}

export default function Page() {
  return <LoginPage />;
}
