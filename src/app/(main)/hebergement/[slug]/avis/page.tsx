import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, count, desc, eq } from "drizzle-orm";
import { ArrowLeft, Star } from "lucide-react";
import { db } from "@/db";
import { properties, reviews, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { activeHostCondition } from "@/lib/host-suspension";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";
import type { UiStringKey } from "@/lib/ui-strings";
import { getRatingLabel } from "@/lib/utils";
import { PropertyReviewsList } from "@/components/property-reviews-list";

/**
 * T-258 (audit n°6, B5) — « tous les avis » d'un hébergement.
 *
 * Constat d'exécution : la fiche publique chargeait `.limit(5)` et n'affichait
 * ni compteur ni lien — un bien à 40 avis en montrait 5 pour toujours, alors
 * que `GET /api/reviews?propertyId=…&limit=…&offset=…` était **déjà paginé**.
 *
 * Cette page est strictement additive : la fiche garde ses 5 avis (même
 * performance, même cache), et le lien n'apparaît que s'il y a plus de 5 avis.
 * Elle réutilise le balisage partagé (`PropertyReviewsList`) et les mêmes règles
 * de visibilité que la fiche (bien actif, hôte actif ; l'hôte propriétaire et
 * l'admin voient aussi une annonce non publiée, pour ne pas casser le lien
 * depuis la vue privée).
 */

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

async function getPropertyForReviews(slug: string, viewerId?: string, isAdmin = false) {
  const [row] = await db
    .select({
      id: properties.id,
      name: properties.name,
      slug: properties.slug,
      city: properties.city,
      country: properties.country,
      status: properties.status,
      hostId: properties.hostId,
      averageRating: properties.averageRating,
      totalReviews: properties.totalReviews,
      suspendedAt: users.suspendedAt,
      deletedAt: users.deletedAt,
    })
    .from(properties)
    .innerJoin(users, eq(properties.hostId, users.id))
    .where(eq(properties.slug, slug));

  if (!row) return null;

  const privileged = isAdmin || row.hostId === viewerId;
  const hostInactive = row.suspendedAt !== null || row.deletedAt !== null;
  if (!privileged && (hostInactive || row.status !== "active")) return null;
  return row;
}

async function getApprovedReviews(propertyId: string, page: number) {
  const [rows, [totalRow]] = await Promise.all([
    db
      .select({
        review: reviews,
        user: {
          firstName: users.firstName,
          lastName: users.lastName,
          country: users.country,
        },
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .where(and(eq(reviews.propertyId, propertyId), eq(reviews.status, "approved")))
      .orderBy(desc(reviews.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(reviews)
      .where(and(eq(reviews.propertyId, propertyId), eq(reviews.status, "approved"))),
  ]);
  return { rows, total: totalRow?.total ?? 0 };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const t = makeT(await getServerLocale());
  const [row] = await db
    .select({ name: properties.name, city: properties.city })
    .from(properties)
    .innerJoin(users, eq(properties.hostId, users.id))
    .where(and(eq(properties.slug, slug), eq(properties.status, "active"), activeHostCondition(users)))
    .limit(1);
  if (!row) return { title: t("meta.notFound") };
  return {
    title: `${t("property.reviews")} — ${row.name}`,
    description: `${row.name} (${row.city}) — ${t("property.reviews")}`,
  };
}

export default async function PropertyReviewsPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const viewer = await getCurrentUser();
  const locale = await getServerLocale();
  const t = makeT(locale);

  const property = await getPropertyForReviews(slug, viewer?.id, viewer?.role === "admin");
  if (!property) notFound();

  const requestedPage = Math.max(1, Number.parseInt((await searchParams).page ?? "1", 10) || 1);
  const totalPages = Math.max(1, Math.ceil((property.totalReviews ?? 0) / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const { rows } = await getApprovedReviews(property.id, page);

  const rating = property.averageRating && Number(property.averageRating) > 0 ? Number(property.averageRating) : null;
  const ratingInfo = rating ? getRatingLabel(rating, locale) : null;
  const backLabel = t("property.backToProperty");
  const pageHref = (target: number) => `/hebergement/${property.slug}/avis?page=${target}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <Link
          href={`/hebergement/${property.slug}`}
          className="inline-flex items-center gap-2 text-sm text-[#1B3A6B] hover:underline mb-6"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          {backLabel}
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
                {t("property.reviews")}
              </h1>
              <p className="text-gray-600 mt-1">
                {property.name} · {property.city} — {t("property.reviewsCount").replace("{n}", String(property.totalReviews ?? rows.length))}
              </p>
            </div>
            {rating && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 px-3 py-1 bg-[#1B3A6B] text-white font-semibold rounded">
                  <Star className="w-4 h-4 fill-current" />
                  {rating.toFixed(1)}
                </div>
                <span className="text-sm text-gray-600">
                  {ratingInfo?.emoji} {ratingInfo?.label}
                </span>
              </div>
            )}
          </div>

          <PropertyReviewsList
            reviews={rows}
            locale={locale}
            t={t as (key: UiStringKey) => string}
            viewerId={viewer?.id}
          />

          {totalPages > 1 && (
            <nav className="mt-8 flex items-center justify-between" aria-label={t("property.reviews")}>
              {page > 1 ? (
                <Link href={pageHref(page - 1)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
                  {t("search.prev")}
                </Link>
              ) : (
                <span />
              )}
              <span className="text-sm text-gray-500">
                {t("search.pageShort")} {page} {t("search.pageOf")} {totalPages}
              </span>
              {page < totalPages ? (
                <Link href={pageHref(page + 1)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
                  {t("search.next")}
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </div>
      </div>
    </div>
  );
}
