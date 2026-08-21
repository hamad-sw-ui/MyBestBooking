import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { MapPin, Star } from "lucide-react";

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

async function fetchShared(token: string): Promise<Shared | null> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const base = `${proto}://${host}`;
  const res = await fetch(`${base}/api/wishlists/shared/${encodeURIComponent(token)}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export const dynamic = "force-dynamic";

export default async function SharedWishlistPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await fetchShared(token);
  if (!data) notFound();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <p className="text-sm text-gray-500">Liste partagée</p>
        <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {data.name}
        </h1>
        <p className="text-gray-600 mt-1">
          {data.itemCount} hébergement{data.itemCount > 1 ? "s" : ""}
        </p>
      </div>

      {data.itemCount === 0 ? (
        <p className="text-gray-600">Cette liste est vide pour le moment.</p>
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
