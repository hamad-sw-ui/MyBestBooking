import Link from "next/link";
import { Compass } from "lucide-react";

export default function SharedWishlistNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 text-center">
        <Compass className="w-14 h-14 mx-auto text-[#1B3A6B] mb-4" aria-hidden="true" />
        <p className="text-sm text-gray-500 mb-1">Erreur 404</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Page introuvable</h1>
        <p className="text-gray-600 mb-6">
          Cette liste partagée n&apos;existe pas ou n&apos;est plus disponible.
        </p>
        <Link
          href="/"
          className="inline-flex px-5 py-2.5 bg-[#FF5A5F] text-white rounded-lg hover:bg-[#e54a4f]"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
