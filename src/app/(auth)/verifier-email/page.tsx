import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";

export const dynamic = "force-dynamic";

/**
 * T-172 — titre localisé + noindex (page à jeton de vérification d'email).
 */
export async function generateMetadata() {
  const t = makeT(await getServerLocale());
  return {
    title: t("auth.meta.verifyTitle"),
    robots: { index: false, follow: false },
  };
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const { ok } = await searchParams;
  const success = ok === "1";
  const t = makeT(await getServerLocale());

  return (
    <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 text-center">
      {success ? (
        <>
          <CheckCircle2 className="w-14 h-14 mx-auto text-[#00A699] mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("auth.verifyOkTitle")}</h1>
          <p className="text-gray-600 mb-6">
            {t("auth.verifyOkBody")}
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-[#FF5A5F] text-white font-semibold rounded-lg hover:bg-[#e54a4f]"
          >
            {t("notfound.home")}
          </Link>
        </>
      ) : (
        <>
          <XCircle className="w-14 h-14 mx-auto text-[#D93025] mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("auth.verifyFailTitle")}</h1>
          <p className="text-gray-600 mb-6">
            {t("auth.verifyFailBody")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/connexion"
              className="inline-block px-6 py-3 bg-[#1B3A6B] text-white font-semibold rounded-lg hover:bg-[#0f2444]"
            >
              {t("auth.loginButton")}
            </Link>
            <Link
              href="/mon-compte"
              className="inline-block px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50"
            >
              {t("nav.myAccount")}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
