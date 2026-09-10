import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";

/**
 * T-217 — squelette de chargement partagé des routes **feuilles**.
 *
 * ⚠️ Ne pas remonter ce fichier à la racine (`src/app/loading.tsx`) ni sur un
 * segment parent d'une route `[id]` : une frontière `Suspense` placée au-dessus
 * d'une page qui appelle `notFound()` fige le statut HTTP à **200** avant que
 * l'exception ne soit levée (soft-404 — BUG-051). Les `loading.tsx` ne sont donc
 * posés que sur des routes de liste sans enfant dynamique, où aucun `notFound()`
 * ne peut survenir.
 */
export default async function PageLoading() {
  const t = makeT(await getServerLocale());
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-3 text-gray-500"
      >
        <div className="w-8 h-8 border-3 border-[#1B3A6B] border-t-transparent rounded-full animate-spin" />
        <span className="sr-only">{t("loading.label")}</span>
      </div>
    </div>
  );
}
