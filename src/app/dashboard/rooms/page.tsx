import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { rooms, properties } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatPrice } from "@/lib/utils";
import { BedDouble, Plus, Users, Maximize, Edit, Trash2 } from "lucide-react";
import Link from "next/link";

const ROOM_TYPE_LABELS: Record<string, string> = {
  single: "Simple",
  double: "Double",
  twin: "Twin",
  suite: "Suite",
  studio: "Studio",
  dormitory: "Dortoir",
  family: "Familiale",
};

async function getRooms(userId: string) {
  // Get host's properties first
  const hostProperties = await db
    .select({ id: properties.id, name: properties.name })
    .from(properties)
    .where(eq(properties.hostId, userId));

  if (hostProperties.length === 0) return [];

  const allRooms = [];
  for (const prop of hostProperties) {
    const propRooms = await db
      .select()
      .from(rooms)
      .where(eq(rooms.propertyId, prop.id))
      .orderBy(desc(rooms.createdAt));

    allRooms.push(
      ...propRooms.map(r => ({
        ...r,
        propertyName: prop.name,
      }))
    );
  }

  return allRooms;
}

export default async function RoomsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const allRooms = await getRooms(user.id);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Chambres
          </h1>
          <p className="text-gray-600 mt-1">
            Gérez les chambres de vos hébergements
          </p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Ajouter une chambre
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">Total chambres</p>
            <p className="text-2xl font-bold">{allRooms.length}</p>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">Actives</p>
            <p className="text-2xl font-bold text-green-600">
              {allRooms.filter(r => r.isActive).length}
            </p>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">Unités totales</p>
            <p className="text-2xl font-bold text-blue-600">
              {allRooms.reduce((sum, r) => sum + (r.quantity || 0), 0)}
            </p>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">Prix moyen</p>
            <p className="text-2xl font-bold text-[#1B3A6B]">
              {allRooms.length > 0
                ? formatPrice(allRooms.reduce((sum, r) => sum + parseFloat(r.basePrice), 0) / allRooms.length)
                : "—"
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Rooms Grid */}
      {allRooms.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BedDouble className="w-8 h-8" />}
            title="Aucune chambre"
            description="Ajoutez d'abord un hébergement, puis configurez ses chambres"
            action={
              <Link href="/dashboard/properties/new">
                <Button>Ajouter un hébergement</Button>
              </Link>
            }
            className="py-16"
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allRooms.map((room) => (
            <Card key={room.id} className={!room.isActive ? "opacity-60" : ""}>
              <CardContent>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{room.name}</h3>
                    <p className="text-sm text-gray-500">{room.propertyName}</p>
                  </div>
                  {!room.isActive && (
                    <Badge variant="default">Inactive</Badge>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <BedDouble className="w-4 h-4 mx-auto text-gray-400 mb-1" />
                    <p className="text-xs text-gray-500">{ROOM_TYPE_LABELS[room.roomType] || room.roomType}</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <Users className="w-4 h-4 mx-auto text-gray-400 mb-1" />
                    <p className="text-xs text-gray-500">{room.maxOccupancy} pers.</p>
                  </div>
                  <div className="text-center p-2 bg-gray-50 rounded">
                    <Maximize className="w-4 h-4 mx-auto text-gray-400 mb-1" />
                    <p className="text-xs text-gray-500">{room.sizeSqm || "—"} m²</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <div>
                    <p className="text-xl font-bold text-[#1B3A6B]">
                      {formatPrice(room.basePrice, room.currency || "EUR")}
                    </p>
                    <p className="text-xs text-gray-500">par nuit • {room.quantity} unité{(room.quantity || 0) > 1 ? "s" : ""}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/dashboard/rooms/${room.id}/calendrier`}
                      className="px-3 py-1.5 text-xs bg-[#1B3A6B] text-white rounded-lg hover:bg-[#0f2444]"
                      title="Éditer le calendrier prix/stock"
                    >
                      Calendrier
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
