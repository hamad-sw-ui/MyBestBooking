import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { promotions } from "@/db/schema";
import { desc } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPrice, formatDate } from "@/lib/utils";
import { Tag, Plus, Percent, Calendar, Users, Edit, Trash2, Copy } from "lucide-react";
import Link from "next/link";

async function getPromotions() {
  return db
    .select()
    .from(promotions)
    .orderBy(desc(promotions.createdAt));
}

export default async function PromotionsPage() {
  const user = await getCurrentUser();

  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }

  const allPromotions = await getPromotions();

  const typeLabels: Record<string, string> = {
    percentage: "Pourcentage",
    fixed_amount: "Montant fixe",
    free_night: "Nuit gratuite",
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Promotions
          </h1>
          <p className="text-gray-600 mt-1">
            Gérez les codes promo et offres spéciales
          </p>
        </div>
        <Link href="/dashboard/promotions/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nouvelle promotion
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold">{allPromotions.length}</p>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">Actives</p>
            <p className="text-2xl font-bold text-green-600">
              {allPromotions.filter(p => p.isActive && new Date(p.validUntil) > new Date()).length}
            </p>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">Utilisations</p>
            <p className="text-2xl font-bold text-blue-600">
              {allPromotions.reduce((sum, p) => sum + (p.currentUses || 0), 0)}
            </p>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">Expirées</p>
            <p className="text-2xl font-bold text-gray-400">
              {allPromotions.filter(p => new Date(p.validUntil) <= new Date()).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Promotions List */}
      <Card padding="none">
        {allPromotions.length === 0 ? (
          <EmptyState
            icon={<Tag className="w-8 h-8" />}
            title="Aucune promotion"
            description="Créez votre première promotion pour attirer plus de clients"
            action={
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Créer une promotion
              </Button>
            }
            className="py-16"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                  <th className="px-6 py-4 font-medium">Code</th>
                  <th className="px-6 py-4 font-medium">Nom</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Valeur</th>
                  <th className="px-6 py-4 font-medium">Validité</th>
                  <th className="px-6 py-4 font-medium">Utilisations</th>
                  <th className="px-6 py-4 font-medium">Statut</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allPromotions.map((promo) => {
                  const isExpired = new Date(promo.validUntil) <= new Date();
                  const isActive = promo.isActive && !isExpired;
                  const usagePercent = promo.maxUses 
                    ? ((promo.currentUses || 0) / promo.maxUses) * 100 
                    : 0;

                  return (
                    <tr key={promo.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono font-medium">
                            {promo.code}
                          </code>
                          <button className="p-1 hover:bg-gray-200 rounded" title="Copier">
                            <Copy className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">{promo.name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {promo.type === "percentage" ? (
                            <Percent className="w-4 h-4 text-gray-400" />
                          ) : (
                            <Tag className="w-4 h-4 text-gray-400" />
                          )}
                          <span className="text-sm">{typeLabels[promo.type]}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-medium text-[#FF5A5F]">
                          {promo.type === "percentage" 
                            ? `-${promo.value}%`
                            : promo.type === "fixed_amount"
                            ? `-${formatPrice(promo.value)}`
                            : "1 nuit offerte"
                          }
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm">
                          <p className="text-gray-900">
                            {formatDate(promo.validFrom, { day: "numeric", month: "short" })}
                          </p>
                          <p className="text-gray-500">
                            → {formatDate(promo.validUntil, { day: "numeric", month: "short" })}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium">
                            {promo.currentUses || 0}
                            {promo.maxUses && ` / ${promo.maxUses}`}
                          </p>
                          {promo.maxUses && (
                            <div className="w-20 h-1.5 bg-gray-200 rounded-full mt-1">
                              <div
                                className="h-full bg-[#1B3A6B] rounded-full"
                                style={{ width: `${Math.min(usagePercent, 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {isExpired ? (
                          <Badge variant="default">Expirée</Badge>
                        ) : isActive ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="warning">Inactive</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                            <Edit className="w-4 h-4 text-gray-500" />
                          </button>
                          <button className="p-2 rounded-lg hover:bg-red-50 transition-colors">
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Quick Add */}
      <Card className="mt-6 bg-[#F5A623]/10 border-[#F5A623]/30">
        <CardContent className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-[#1B3A6B]">💡 Codes promo populaires</h3>
            <p className="text-sm text-gray-600 mt-1">
              BIENVENUE10 (10% nouveaux), ETE2025 (15% été), LASTMINUTE (20% dernière minute)
            </p>
          </div>
          <Button variant="outline">
            Créer depuis un modèle
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
