import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PromotionForm } from "@/components/promotion-form";

export default async function NewPromotionPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Nouveau code promo
      </h1>
      <PromotionForm />
    </div>
  );
}
