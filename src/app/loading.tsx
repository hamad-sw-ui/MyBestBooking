/**
 * Écran de chargement root (T-017).
 * Next affiche automatiquement ce composant pendant le rendu RSC.
 */
export default function Loading() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-3 text-gray-500"
      >
        <div className="w-8 h-8 border-3 border-[#1B3A6B] border-t-transparent rounded-full animate-spin" />
        <span className="sr-only">Chargement en cours…</span>
      </div>
    </div>
  );
}
