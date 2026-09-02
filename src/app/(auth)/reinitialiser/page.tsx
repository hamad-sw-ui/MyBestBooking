import type { Metadata } from "next";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import ResetPasswordPage from "./reset-client";

/**
 * T-172 — wrapper serveur : titre localisé + noindex (page à jeton signé,
 * strictement transactionnelle).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getServerLocale());
  return {
    title: t("auth.meta.resetTitle"),
    description: t("meta.appDescription"),
    robots: { index: false, follow: false },
  };
}

export default function Page() {
  return <ResetPasswordPage />;
}
