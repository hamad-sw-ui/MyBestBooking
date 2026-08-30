import type { Metadata } from "next";
import { HelpCenter } from "@/components/help-center";
// T-158 (audit n°29) : métadonnées localisées (titre/description restaient FR
// pour un visiteur anonyme EN — même mécanisme que la fiche propriété).
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";

export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getServerLocale());
  return {
    title: t("help.meta.title"),
    description: t("help.meta.description"),
  };
}

export default function HelpPage() {
  return <HelpCenter />;
}
