import type { Metadata } from "next";
import { ReservationView } from "./reservation-form";
// T-162 (audit n°30) : la page client ne peut pas exporter de metadata —
// ce wrapper serveur fournit un <title>/description localisés (avant :
// titre FR du layout par défaut, même en langue EN).
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";

export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getServerLocale());
  return {
    title: t("reservation.meta.title"),
    description: t("reservation.meta.description"),
  };
}

export default async function Page() {
  return <ReservationView initialLanguage={await getServerLocale()} />;
}
