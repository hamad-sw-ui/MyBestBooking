"use client";

import { useT, useUiLocale } from "@/components/ui-locale-provider";

/**
 * T-132 — Description d'hébergement localisée.
 *
 * Choisit la version anglaise (`descriptionEn`) quand la langue d'affichage
 * du visiteur est « en » ; sinon le français (`description`, défaut).
 * L'arabe n'a pas de contenu V1 : on retombe sur le français. Composant
 * client car la préférence de langue est résolue au navigateur.
 */
export function LocalizedDescription({
  description,
  descriptionEn,
  className,
}: {
  description: string | null;
  descriptionEn: string | null;
  className?: string;
}) {
  const locale = useUiLocale();
  const t = useT();
  const fallback = t("prop.descFallback");
  const useEn = locale === "en" && Boolean(descriptionEn);
  const text = useEn ? descriptionEn : description;

  return (
    <p className={className ?? "text-gray-600 leading-relaxed"}>
      {text || fallback}
    </p>
  );
}
