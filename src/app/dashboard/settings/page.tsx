import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAllSettings, getProviderStatus } from "@/lib/settings";
import { SettingsPanel } from "@/components/admin/settings-panel";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";

/**
 * /dashboard/settings (T-021, ADR-007)
 *
 * Panneau d'administration configurable. Toutes les sections sont
 * branchées à des endpoints `/api/admin/settings/[key]`. Les valeurs
 * initiales sont récupérées côté serveur pour éviter un flash de
 * défauts.
 */
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }

  const t = makeT(await getServerLocale());
  const settings = await getAllSettings();
  const providers = getProviderStatus();

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h1
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          {t("dash.settings")}
        </h1>
        <p className="text-gray-600 mt-1">
          {t("dash.settingsSub")}
        </p>
      </div>

      <SettingsPanel initial={settings} providers={providers} />
    </div>
  );
}
