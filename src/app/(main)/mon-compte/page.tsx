import type { Metadata } from "next";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import MyAccountPage from "./account-client";

/**
 * T-172 — wrapper serveur : titre localisé + noindex (compte personnel,
 * données privées non indexables).
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getServerLocale());
  return {
    title: t("account.meta.title"),
    description: t("meta.appDescription"),
    robots: { index: false, follow: false },
  };
}

export default function Page() {
  return <MyAccountPage />;
}
