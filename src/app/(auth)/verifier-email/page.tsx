import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string }>;
}) {
  const { ok } = await searchParams;
  const success = ok === "1";

  return (
    <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 text-center">
      {success ? (
        <>
          <CheckCircle2 className="w-14 h-14 mx-auto text-[#00A699] mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Email vérifié</h1>
          <p className="text-gray-600 mb-6">
            Votre adresse a bien été confirmée. Nous l&apos;utiliserons pour sécuriser vos communications de réservation.
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-[#FF5A5F] text-white font-semibold rounded-lg hover:bg-[#e54a4f]"
          >
            Retour à l&apos;accueil
          </Link>
        </>
      ) : (
        <>
          <XCircle className="w-14 h-14 mx-auto text-[#D93025] mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Lien invalide</h1>
          <p className="text-gray-600 mb-6">
            Ce lien de vérification est expiré ou déjà utilisé. Connectez-vous
            puis demandez un nouveau lien depuis votre compte (Mon compte), ou
            contactez le support.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/connexion"
              className="inline-block px-6 py-3 bg-[#1B3A6B] text-white font-semibold rounded-lg hover:bg-[#0f2444]"
            >
              Se connecter
            </Link>
            <Link
              href="/mon-compte"
              className="inline-block px-6 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50"
            >
              Mon compte
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
