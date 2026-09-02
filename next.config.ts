import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // T-008 (BUG-006) : autorise next/image à optimiser les images
  // hébergées sur Unsplash (utilisées par le seed et le hero).
  // T-186 : optimizer `/_next/image` ACTIVÉ — TOUTES les sources passant
  // par <Image> sont désormais locales (`public/seed-images/`, 23 visuels
  // versionnés) ou servies par /uploads statique ; le sandbox n'a pas
  // d'egress Unsplash (mesuré T-181), d'où l'exigence « zéro source
  // distante dans <Image> » avant activation. Les remotePatterns restent
  // pour compatibilité descendante (anciennes lignes, uploads API).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "plus.unsplash.com" },
    ],
    // T-014 : les uploads locaux (public/uploads/*) sont servis en
    // static, pas besoin de remotePattern.
    // Si S3_PUBLIC_BASE_URL est défini, l'ajouter ci-dessus.
  },

  // T-181 : `experimental.optimizePackageImports` (lucide-react/date-fns)
  // essayé puis RETIRÉ — mesure honnête : 0 octet de gagné sur le bundle
  // prod (Turbopack tree-shake déjà les barils, 1 483 688 o avant/après).
  // On n'embarque pas de config sans effet mesurable.

  // Headers de sécurité (BUG-connexe P2, appliqué en même temps que T-008
  // pour éviter un deuxième cycle). Voir SECURITY.md pour les
  // recommandations restantes (CSP fine à définir).
  async headers() {
    // T-017 : CSP souple compatible Next.js/Turbopack (dev+prod). En prod
    // stricte, on retirerait unsafe-eval et on ajouterait des nonces.
    const csp = [
      "default-src 'self'",
      "img-src 'self' data: blob: https:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
