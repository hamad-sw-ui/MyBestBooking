import type { Metadata } from "next";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import ForgotPasswordPage from "./forgot-client";

/**
 * T-172 — wrapper serveur : titre localisé + noindex (page utilitaire de
 * récupération, sans valeur d'indexation).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getServerLocale());
  return {
    title: t("auth.meta.forgotTitle"),
    description: t("meta.appDescription"),
    robots: { index: false, follow: false },
  };
}

export default function Page() {
  return <ForgotPasswordPage />;
}
