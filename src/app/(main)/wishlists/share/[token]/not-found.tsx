import Link from "next/link";
import { Compass } from "lucide-react";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";

export default async function SharedWishlistNotFound() {
  const t = makeT(await getServerLocale());
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 text-center">
        <Compass className="w-14 h-14 mx-auto text-[#1B3A6B] mb-4" aria-hidden="true" />
        <p className="text-sm text-gray-500 mb-1">{t("share.error404")}</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("share.notFoundTitle")}</h1>
        <p className="text-gray-600 mb-6">
          {t("share.notFoundBody")}
        </p>
        <Link
          href="/"
          className="inline-flex px-5 py-2.5 bg-[#FF5A5F] text-white rounded-lg hover:bg-[#e54a4f]"
        >
          {t("notfound.home")}
        </Link>
      </div>
    </div>
  );
}
