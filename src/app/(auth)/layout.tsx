import Link from "next/link";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-16">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-[#F5A623] text-xl">✦</span>
              <span className="font-bold text-[#1B3A6B]">mybest</span>
              <span className="font-bold text-[#FF5A5F]">booking</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        {children}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-sm text-gray-500">
        © 2025 mybestbooking.com — &quot;Réservez mieux. Voyagez plus.&quot;
      </footer>
    </div>
  );
}
