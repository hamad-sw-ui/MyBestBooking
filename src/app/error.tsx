"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";

/**
 * Écran d'erreur global côté client (T-017).
 * Voir https://nextjs.org/docs/app/api-reference/file-conventions/error
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[error boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 text-center">
        <AlertTriangle className="w-14 h-14 mx-auto text-[#D93025] mb-4" aria-hidden="true" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Une erreur est survenue
        </h1>
        <p className="text-gray-600 mb-6">
          Nous n&apos;avons pas pu afficher cette page. Vous pouvez
          réessayer, ou revenir à l&apos;accueil.
        </p>
        {error.digest && (
          <p className="text-xs text-gray-400 mb-6 font-mono">
            Réf : {error.digest}
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1B3A6B] text-white rounded-lg hover:bg-[#0f2444]"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            Réessayer
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
