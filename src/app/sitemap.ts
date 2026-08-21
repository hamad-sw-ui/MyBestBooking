import type { MetadataRoute } from "next";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const list = await db
    .select({
      slug: properties.slug,
      updatedAt: properties.updatedAt,
    })
    .from(properties)
    .where(eq(properties.status, "active"));

  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/recherche`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${BASE}/aide`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/bestrewards`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/connexion`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/inscription`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    ...list.map((p) => ({
      url: `${BASE}/hebergement/${p.slug}`,
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
