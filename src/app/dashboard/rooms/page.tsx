import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { rooms, properties } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { RoomsManager, type RoomRow } from "@/components/bulk/rooms-manager";

/**
 * /dashboard/rooms (refactoré T-034) — Server Component minimaliste
 * qui délègue au <RoomsManager> client (filtres + bulk + delete).
 */

async function getRooms(userId: string, isAdmin: boolean): Promise<RoomRow[]> {
  if (isAdmin) {
    // Admin voit toutes les chambres avec le nom de leur property
    const rows = await db
      .select({
        room: rooms,
        propertyName: properties.name,
      })
      .from(rooms)
      .leftJoin(properties, eq(rooms.propertyId, properties.id))
      .orderBy(desc(rooms.createdAt));
    return rows.map((r) => ({
      id: r.room.id,
      propertyId: r.room.propertyId,
      propertyName: r.propertyName,
      name: r.room.name,
      roomType: r.room.roomType,
      maxOccupancy: r.room.maxOccupancy,
      quantity: r.room.quantity,
      sizeSqm: r.room.sizeSqm ? String(r.room.sizeSqm) : null,
      basePrice: String(r.room.basePrice),
      currency: r.room.currency,
      isActive: r.room.isActive,
      createdAt: r.room.createdAt.toISOString(),
    }));
  }

  const hostProperties = await db
    .select({ id: properties.id, name: properties.name })
    .from(properties)
    .where(eq(properties.hostId, userId));
  if (hostProperties.length === 0) return [];

  const all: RoomRow[] = [];
  for (const prop of hostProperties) {
    const propRooms = await db
      .select()
      .from(rooms)
      .where(eq(rooms.propertyId, prop.id))
      .orderBy(desc(rooms.createdAt));
    for (const r of propRooms) {
      all.push({
        id: r.id,
        propertyId: r.propertyId,
        propertyName: prop.name,
        name: r.name,
        roomType: r.roomType,
        maxOccupancy: r.maxOccupancy,
        quantity: r.quantity,
        sizeSqm: r.sizeSqm ? String(r.sizeSqm) : null,
        basePrice: String(r.basePrice),
        currency: r.currency,
        isActive: r.isActive,
        createdAt: r.createdAt.toISOString(),
      });
    }
  }
  return all;
}

export default async function RoomsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const isAdmin = user.role === "admin";
  const list = await getRooms(user.id, isAdmin);
  return <RoomsManager rooms={list} isAdmin={isAdmin} />;
}
