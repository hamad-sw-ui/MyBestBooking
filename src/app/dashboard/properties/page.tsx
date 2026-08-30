import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  PropertiesManager,
  type PropertyRow,
} from "@/components/bulk/properties-manager";

async function getProperties(userId: string, isAdmin: boolean) {
  if (isAdmin) {
    return db.select().from(properties).orderBy(desc(properties.createdAt));
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
  const rows = await getProperties(user.id, isAdmin);

  const serialized: PropertyRow[] = rows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    type: p.type,
    status: p.status,
    city: p.city,
    country: p.country,
    starRating: p.starRating,
    averageRating: p.averageRating ? String(p.averageRating) : null,
    totalReviews: p.totalReviews,
    mainImage: p.mainImage,
    hostId: p.hostId,
    createdAt:
      p.createdAt instanceof Date ? p.createdAt.toISOString() : String(p.createdAt),
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Hébergements
          </h1>
          <p className="text-gray-600 mt-1">
            {isAdmin
              ? "Gérez tous les hébergements — filtres, sélection, actions groupées."
              : "Gérez vos hébergements — filtres et recherche."}
          </p>
        </div>
        {!isAdmin && (
          <Link href="/dashboard/properties/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Ajouter un hébergement
            </Button>
          </Link>
        )}
      </div>
      <PropertiesManager properties={serialized} isAdmin={isAdmin} />
    </div>
  );
}
