import Image from "next/image";
import { isLocallyServedImage } from "@/lib/local-image";

/**
 * T-188 — `<SmartImage>` : remplacement non-régressif des `<img>` natifs.
 *
 * - Source **auto-hébergée** (`/seed-images/*`, `/uploads/*`) →
 *   `next/image` avec `fill` (retaillage + WebP via `/_next/image`,
 *   LCP/bande passante). **Le parent doit avoir `position: relative`**
 *   (ou `absolute`/`fixed`) — `fill` positionne l'image en absolu.
 * - Source **distante ou variable** (photos d'hôtes hébergées ailleurs,
 *   avatars externes…) → `<img>` natif enrichi (`loading="lazy"`,
 *   `decoding="async"`) : jamais cassée par la whitelist de domains
 *   de l'optimizer.
 *
 * API volontairement réduite au subset utilisé dans le code existant.
 */
export function SmartImage({
  src,
  alt,
  className,
  sizes,
  priority,
}: {
  src: string;
  alt: string;
  className?: string;
  /** Transmis à next/image quand la source est locale. */
  sizes?: string;
  /** Transmis à next/image (LCP above-the-fold) quand la source est locale. */
  priority?: boolean;
}) {
  if (isLocallyServedImage(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        className={className}
        sizes={sizes ?? "(max-width: 768px) 100vw, 50vw"}
        priority={priority}
      />
    );
  }
  // Volontaire T-188 : sources distantes arbitraires (hôtes/utilisateurs)
  // incompatibles avec l'optimizer (domaine inconnu) ; lazy + async limitent le coût.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={className} loading="lazy" decoding="async" />;
}
