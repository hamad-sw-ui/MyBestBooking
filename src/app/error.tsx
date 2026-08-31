"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useT } from "@/components/ui-locale-provider";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  useEffect(() => {
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 text-center">
        <AlertTriangle className="w-14 h-14 mx-auto text-[#D93025] mb-4" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          {t("error.title")}
        </h1>
        <p className="text-gray-600 mb-6">
          {t("error.body")}
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 mb-6 font-mono">
            {t("error.ref")} {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1B3A6B] text-white rounded-lg hover:bg-[#0f2444]"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            {t("error.retry")}
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            {t("notfound.home")}
          </Link>
        </div>
      </div>
    </div>
  );
}
