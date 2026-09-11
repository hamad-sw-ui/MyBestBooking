import Link from "next/link";
import { ChevronDown, ListEnd } from "lucide-react";
import { WINDOW_MAX, nextWindowSize } from "@/lib/page-window";
import { cn } from "@/lib/utils";

interface Props {
  /** Nombre de lignes réellement affichées. */
  shown: number;
  /** Nombre total de lignes (avant la fenêtre). */
  total: number;
  /** Reste-t-il des lignes au-delà de la fenêtre ? */
  hasMore: boolean;
  /** Route courante (ex. `/dashboard/bookings`). */
  basePath: string;
  /** Paramètres à conserver dans les liens (filtres éventuels). */
  params: Record<string, string | undefined>;
  /** Libellés déjà traduits (le composant est rendu côté serveur). */
  labels: {
    shown: string;
    showMore: string;
    showAll: string;
    limitReached: string;
    filterScope: string;
  };
  className?: string;
}

function href(
  basePath: string,
  params: Record<string, string | undefined>,
  limit: number,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "limit") query.set(key, value);
  }
  query.set("limit", String(limit));
  const qs = query.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/**
 * T-245 (audit n°5, A2) — bandeau de fenêtre des écrans de liste.
 *
 * Rend visible ce que l'écran n'affiche pas : le nombre de lignes chargées sur
 * le total, un lien pour élargir la fenêtre, un lien « tout afficher » quand
 * c'est raisonnable, et un avertissement quand le plafond est atteint. Les
 * liens sont de simples `<Link>` : aucune requête supplémentaire, les filtres
 * de l'écran sont conservés dans l'URL.
 */
export function ShowMore({
  shown,
  total,
  hasMore,
  basePath,
  params,
  labels,
  className,
}: Props) {
  if (total <= shown && !hasMore) return null;

  const canGrow = shown < WINDOW_MAX;
  const showAllOffered = total <= WINDOW_MAX && total > shown;
  const atCeiling = shown >= WINDOW_MAX && hasMore;

  return (
    <div
      className={cn(
        "mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm",
        className,
      )}
      data-testid="show-more"
    >
      <div className="text-gray-600">
        <span data-testid="show-more-counter">
          {labels.shown.replace("{shown}", String(shown)).replace("{total}", String(total))}
        </span>
        {hasMore && <span className="ml-2 text-xs text-gray-500">{labels.filterScope}</span>}
      </div>
      <div className="flex items-center gap-2">
        {hasMore && canGrow && (
          <Link
            href={href(basePath, params, nextWindowSize(shown))}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
            {labels.showMore.replace("{n}", String(nextWindowSize(shown) - shown))}
          </Link>
        )}
        {showAllOffered && (
          <Link
            href={href(basePath, params, total)}
            className="inline-flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
          >
            <ListEnd className="h-4 w-4" aria-hidden="true" />
            {labels.showAll.replace("{total}", String(total))}
          </Link>
        )}
      </div>
      {atCeiling && (
        <p role="status" className="w-full text-xs text-amber-700">
          {labels.limitReached.replace("{max}", String(WINDOW_MAX))}
        </p>
      )}
    </div>
  );
}
