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
            Votre adresse a bien été confirmée. Vous pouvez désormais réserver.
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
            Ce lien de vérification est expiré ou déjà utilisé. Créez un nouveau
            lien en vous inscrivant à nouveau ou contactez le support.
          </p>
          <Link
            href="/connexion"
            className="inline-block px-6 py-3 bg-[#1B3A6B] text-white font-semibold rounded-lg hover:bg-[#0f2444]"
          >
            Se connecter
          </Link>
        </>
      )}
    </div>
  );
}
