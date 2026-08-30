import type { Metadata } from "next";
import Link from "next/link";
import { Wrench } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { isMaintenanceActive } from "@/lib/maintenance";
import { redirect } from "next/navigation";

/**
 * Page de maintenance (T-022).
 * Affichée aux non-admins quand `security.maintenanceMode=true`.
 * Si le mode a été désactivé (ou si l'user est admin), on renvoie
 * silencieusement vers l'accueil.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Maintenance en cours — MyBestBooking",
  description: "Le service est momentanément indisponible.",
  robots: { index: false, follow: false },
};

export default async function MaintenancePage() {
  const user = await getCurrentUser();
  const active = await isMaintenanceActive();
  if (!active || (user && user.role === "admin")) {
    redirect("/");
  }

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
          Maintenance en cours
        </h1>
        <p className="text-gray-600 mb-8">
          MyBestBooking est momentanément indisponible pour effectuer
          des opérations de maintenance. Merci de votre patience —
          nous serons de retour très bientôt.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-[#1B3A6B] text-white font-medium hover:bg-[#152d54] transition"
          >
            Réessayer
          </Link>
          {!user && (
            <Link
              href="/connexion"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition"
            >
              Connexion
            </Link>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-8">
          Contact : support@mybestbooking.com
        </p>
      </div>
    </div>
  );
}
