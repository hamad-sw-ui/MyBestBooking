import type { MetadataRoute } from "next";
import { appBaseUrl } from "@/lib/app-url";

// B3 (audit n°6) : base unique `appBaseUrl()` (repli absolu documenté).
const BASE = appBaseUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/dashboard/",
          "/mon-compte/",
          "/mes-reservations/",
          "/mes-favoris/",
          "/messages/",
          "/reservation",
          "/reinitialiser",
          "/verifier-email",
          "/mot-de-passe-oublie",
        ],
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: BASE,
  };
}
