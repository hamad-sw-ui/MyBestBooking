import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { properties, rooms } from "@/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPrice, getPropertyTypeLabel, getStatusBadgeColor } from "@/lib/utils";
import { Building2, Plus, MapPin, Star, MoreVertical, Pencil, Eye, Trash2 } from "lucide-react";
import Link from "next/link";

async function getProperties(userId: string, isAdmin: boolean) {
  if (isAdmin) {
    return db
      .select()
      .from(properties)
      .orderBy(desc(properties.createdAt));
  }
  
  return db
    .select()
    .from(properties)
    .where(eq(properties.hostId, userId))
    .orderBy(desc(properties.createdAt));
}

export default async function PropertiesPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const isAdmin = user.role === "admin";
  const allProperties = await getProperties(user.id, isAdmin);

  const statusLabels: Record<string, string> = {
    active: "Actif",
    pending: "En attente",
    draft: "Brouillon",
    suspended: "Suspendu",
    archived: "Archivé",
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Hébergements
          </h1>
          <p className="text-gray-600 mt-1">
            {isAdmin ? "Gérez tous les hébergements de la plateforme" : "Gérez vos hébergements"}
          </p>
        </div>
        <Link href="/dashboard/properties/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un hébergement
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold">{allProperties.length}</p>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">Actifs</p>
            <p className="text-2xl font-bold text-green-600">
              {allProperties.filter(p => p.status === "active").length}
            </p>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">En attente</p>
            <p className="text-2xl font-bold text-yellow-600">
              {allProperties.filter(p => p.status === "pending").length}
            </p>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">Suspendus</p>
            <p className="text-2xl font-bold text-red-600">
              {allProperties.filter(p => p.status === "suspended").length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Properties List */}
      <Card padding="none">
        {allProperties.length === 0 ? (
          <EmptyState
            icon={<Building2 className="w-8 h-8" />}
            title="Aucun hébergement"
            description="Commencez par ajouter votre premier hébergement"
            action={
              <Link href="/dashboard/properties/new">
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un hébergement
                </Button>
              </Link>
            }
            className="py-16"
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                  <th className="px-6 py-4 font-medium">Hébergement</th>
                  <th className="px-6 py-4 font-medium">Type</th>
                  <th className="px-6 py-4 font-medium">Localisation</th>
                  <th className="px-6 py-4 font-medium">Note</th>
                  <th className="px-6 py-4 font-medium">Statut</th>
                  <th className="px-6 py-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allProperties.map((property) => (
                  <tr key={property.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                          {property.mainImage ? (
                            <img
                              src={property.mainImage}
                              alt={property.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Building2 className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{property.name}</p>
                          {property.starRating && (
                            <p className="text-sm text-[#F5A623]">
                              {"★".repeat(property.starRating)}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs bg-gray-100 rounded">
                        {getPropertyTypeLabel(property.type)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <MapPin className="w-4 h-4" />
                        {property.city}, {property.country}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {property.averageRating ? (
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-[#F5A623] fill-current" />
                          <span className="font-medium">{parseFloat(property.averageRating).toFixed(1)}</span>
                          <span className="text-sm text-gray-500">({property.totalReviews})</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={getStatusBadgeColor(property.status || "pending")}>
                        {statusLabels[property.status || "pending"] || property.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/hebergement/${property.slug}`}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Voir"
                        >
                          <Eye className="w-4 h-4 text-gray-500" />
                        </Link>
                        <Link
                          href={`/dashboard/properties/${property.id}`}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Modifier"
                        >
                          <Pencil className="w-4 h-4 text-gray-500" />
                        </Link>
                        {isAdmin && property.status === "pending" && (
                          <Link
                            href={`/dashboard/properties/${property.id}?action=validate`}
                            className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                          >
                            Valider
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
