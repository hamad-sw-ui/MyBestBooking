import type { Metadata } from "next";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import RegisterPage from "./register-client";

/**
 * T-172 — wrapper serveur : titre/description localisés pour la page
 * d'inscription (composant client). Page publique, reste indexable.
 */
export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getServerLocale());
  return {
    title: t("auth.meta.registerTitle"),
    description: t("meta.appDescription"),
  };
}

export default function Page() {
  return <RegisterPage />;
}
