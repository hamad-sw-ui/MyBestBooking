import type { Metadata } from "next";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import ClaimGuestPage from "./claim-client";

/**
 * T-172 — wrapper serveur : titre localisé + noindex (activation invitée à
 * jeton, strictement transactionnelle).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getServerLocale());
  return {
    title: t("auth.meta.activateTitle"),
    description: t("meta.appDescription"),
    robots: { index: false, follow: false },
  };
}

export default function Page() {
  return <ClaimGuestPage />;
}
