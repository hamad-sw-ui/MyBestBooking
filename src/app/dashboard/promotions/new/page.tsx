import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PromotionForm } from "@/components/promotion-form";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";

export default async function NewPromotionPage() {
  const user = await getCurrentUser();
  const t = makeT(await getServerLocale());
  if (!user || user.role !== "admin") redirect("/dashboard");

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        {t("promo.newTitle")}
      </h1>
      <PromotionForm />
    </div>
  );
}
