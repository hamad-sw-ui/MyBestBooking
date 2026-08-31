import Link from "next/link";
import type { ReactNode } from "react";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const t = makeT(await getServerLocale());
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-[#F5A623] text-xl">✦</span>
              <span className="font-bold text-[#1B3A6B]">MyBest</span>
              <span className="font-bold text-[#FF5A5F]">Booking</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        {children}
      </main>

      <footer className="py-4 text-center text-sm text-gray-500">
        {t("footer.rights").split("—")[0].trim()} — &quot;{t("footer.tagline")}&quot;
      </footer>
    </div>
  );
}
