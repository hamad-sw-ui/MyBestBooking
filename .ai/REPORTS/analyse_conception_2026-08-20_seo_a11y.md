# Conception — T-017

## next/font
```ts
import { Inter, Poppins } from "next/font/google";
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const poppins = Poppins({ subsets: ["latin"], weight: ["600","700"], variable: "--font-poppins" });
```
Appliqué au `<html>` via `className={\`${inter.variable} ${poppins.variable}\`}`.
Puis `body { font-family: var(--font-inter); }` dans globals.css.
On peut garder les inline `style={{ fontFamily: "'Poppins',..." }}`
existants — ils prendront la version next/font grâce à la variable.

## generateMetadata dynamique
```ts
export async function generateMetadata({ params }): Promise<Metadata> {
  const { slug } = await params;
  const property = await getProperty(slug);
  if (!property) return { title: "Hébergement introuvable" };
  return {
    title: property.name,
    description: `${property.name} à ${property.city}. Prix, avis, chambres.`,
    openGraph: {
      title: property.name,
      description: ...,
      images: [property.mainImage].filter(Boolean),
      type: "website",
    },
    twitter: { card: "summary_large_image", ... }
  };
}
```

## sitemap.ts
```ts
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const list = await db.select({ slug: properties.slug, updatedAt: properties.updatedAt })
    .from(properties).where(eq(properties.status, "active"));
  return [
    { url: base, lastModified: new Date() },
    { url: `${base}/recherche`, lastModified: new Date() },
    ...list.map(p => ({ url: `${base}/hebergement/${p.slug}`, lastModified: p.updatedAt })),
  ];
}
```

## robots.ts
```ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard/", "/mon-compte/"] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
```

## JSON-LD Hotel
Injecté dans la page `/hebergement/[slug]` via `<script type="application/ld+json">`.

## CSP (souple pour Next dev/Turbopack)
```
default-src 'self'
img-src 'self' data: https:
style-src 'self' 'unsafe-inline'
script-src 'self' 'unsafe-inline' 'unsafe-eval'  # unsafe-eval pour Turbopack
font-src 'self' data:
connect-src 'self'
frame-ancestors 'none'
```
Renforcable ultérieurement en retirant unsafe-eval en prod (nonce ou SHA).

## error.tsx / not-found.tsx / loading.tsx
Root-level. Erreur → message + bouton retry (`reset()`). Not-found →
message + lien /. Loading → spinner minimal.

## a11y sweep
Header a des boutons hamburger + user menu icône-seul → `aria-label`.
Formulaires : la plupart utilisent `<Input label>` qui a déjà un label
associé. Vérifier PropertyCard heart button.
