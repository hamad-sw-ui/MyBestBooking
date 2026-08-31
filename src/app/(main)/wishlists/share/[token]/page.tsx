import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { cache } from "react";
import { MapPin, Star } from "lucide-react";
// T-162/T-163 (audit n°30) : contenu localisé + métadonnées + vrai 404
// (data chargée AVANT le rendu → notFound() dans generateMetadata renvoie
// un statut HTTP 404 au lieu du 200 de flux streaming).
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import { countryLabel } from "@/lib/country-label";

interface SharedItem {
  property: {
    id: string;
    slug: string;
    name: string;
    city: string;
    country: string;
    mainImage: string | null;
    starRating: number | null;
    averageRating: string | null;
  } | null;
  addedAt: string;
}

interface Shared {
  name: string;
  itemCount: number;
  items: SharedItem[];
}

/** T-163 : mise en cache de la requête au niveau de la requête HTTP —
 *  generateMetadata et la page partagent le même résultat (1 seul fetch). */
const fetchShared = cache(async (token: string): Promise<Shared | null> => {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = `${proto}://${host}`;
  const res = await fetch(`${base}/api/wishlists/shared/${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
});

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<{ title: string; description: string }> {
  const { token } = await params;
  const t = makeT(await getServerLocale());
  const data = await fetchShared(token);
  // T-163 : token inconnu → vrai 404 avant tout streaming.
  if (!data) notFound();
  return {
    title: t("share.meta.title").replace("{name}", data.name),
    description: t("share.meta.description"),
  };
}

export default async function SharedWishlistPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const t = makeT(await getServerLocale());
  const data = await fetchShared(token);
  if (!data) notFound();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <p className="text-sm text-gray-500">{t("share.label")}</p>
        <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {data.name}
        </h1>
        <p className="text-gray-600 mt-1">
          {data.itemCount > 1
            ? t("share.countMany").replace("{count}", String(data.itemCount))
            : t("share.countOne").replace("{count}", String(data.itemCount))}
        </p>
      </div>

      {data.itemCount === 0 ? (
        <p className="text-gray-600">{t("share.empty")}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.items.map((it) =>
            it.property ? (
              <Link
                key={it.property.id}
                href={`/hebergement/${it.property.slug}`}
                className="group block rounded-2xl overflow-hidden border border-gray-100 hover:shadow-lg transition-shadow"
              >
                <div className="relative aspect-[4/3] bg-gray-100">
                  {it.property.mainImage && (
                    <Image
                      src={it.property.mainImage}
                      alt={it.property.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 group-hover:text-[#1B3A6B]">
                    {it.property.name}
                  </h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                    <MapPin className="w-3 h-3" />
                    {it.property.city}, {it.property.country}
                  </p>
                  {it.property.averageRating && (
                    <p className="text-sm text-gray-700 mt-2 flex items-center gap-1">
                      <Star className="w-3 h-3 text-[#F5A623]" fill="#F5A623" />
                      {it.property.averageRating}
                    </p>
                  )}
                </div>
              </Link>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
