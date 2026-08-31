import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";

export default async function Loading() {
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
