import type { Metadata } from "next";
import Link from "next/link";
import { Wrench } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { isMaintenanceActive } from "@/lib/maintenance";
import { redirect } from "next/navigation";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = makeT(await getServerLocale());
  return {
    title: t("maintenance.meta.title"),
    description: t("maintenance.meta.description"),
    robots: { index: false, follow: false },
  };
}

export default async function MaintenancePage() {
  const user = await getCurrentUser();
  const active = await isMaintenanceActive();
  if (!active || (user && user.role === "admin")) {
    redirect("/");
  }
  const t = makeT(await getServerLocale());

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-white px-6 py-16">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mb-6">
          <Wrench className="w-10 h-10 text-amber-600" />
        </div>
        <h1
          className="text-3xl font-bold text-gray-900 mb-3"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          {t("maintenance.title")}
        </h1>
        <p className="text-gray-600 mb-8">
          {t("maintenance.body")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[#1B3A6B] text-white font-medium hover:bg-[#152d54] transition"
          >
            {t("maintenance.retry")}
          </Link>
          {!user && (
            <Link
              href="/connexion"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
            >
              {t("auth.login")}
            </Link>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-8">
          {t("maintenance.contact")}
        </p>
      </div>
    </div>
  );
}
