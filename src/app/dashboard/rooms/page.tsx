import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { rooms, properties } from "@/db/schema";
import { count, eq, desc } from "drizzle-orm";
import { RoomsManager, type RoomRow } from "@/components/bulk/rooms-manager";
import { ShowMore } from "@/components/ui/show-more";
import { parsePageWindow } from "@/lib/page-window";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";

/**
 * /dashboard/rooms (refactoré T-034) — Server Component minimaliste
 * qui délègue au <RoomsManager> client (filtres + bulk + delete).
 *
 * T-257 (audit n°6, B4) :
 *  1. **une seule requête** — la branche hôte bouclait sur ses biens
 *     (`for (const prop of hostProperties)`) : une requête par bien, puis un
 *     rendu complet. La jointure `rooms ⋈ properties` filtrée par `host_id`
 *     produit exactement la même liste (mêmes champs, même tri `createdAt desc`)
 *     en un aller-retour ;
 *  2. **fenêtre visible** — comme les 7 autres écrans de liste (T-245) :
 *     `parsePageWindow` borne la requête et `<ShowMore>` affiche « N sur M »
 *     avec les liens d'élargissement (les filtres client portent sur la
 *     fenêtre, ce que le bandeau indique).
 */

async function getRooms(userId: string, isAdmin: boolean, limit: number): Promise<RoomRow[]> {
  const rows = await db
    .select({ room: rooms, propertyName: properties.name })
    .from(rooms)
    .leftJoin(properties, eq(rooms.propertyId, properties.id))
    .where(isAdmin ? undefined : eq(properties.hostId, userId))
    .orderBy(desc(rooms.createdAt))
    .limit(limit);

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

async function countRooms(userId: string, isAdmin: boolean): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(rooms)
    .leftJoin(properties, eq(rooms.propertyId, properties.id))
    .where(isAdmin ? undefined : eq(properties.hostId, userId));
  return row?.total ?? 0;
}

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<{ limit?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const isAdmin = user.role === "admin";
  const t = makeT(await getServerLocale());
  const window = parsePageWindow((await searchParams).limit);

  const [rows, total] = await Promise.all([
    getRooms(user.id, isAdmin, window.queryLimit),
    countRooms(user.id, isAdmin),
  ]);
  const visible = rows.slice(0, window.size);

  return (
    <div>
      <RoomsManager rooms={visible} isAdmin={isAdmin} />
      <ShowMore
        shown={visible.length}
        total={total}
        hasMore={rows.length > visible.length}
        basePath="/dashboard/rooms"
        params={{}}
        labels={{
          shown: t("list.window.shown"),
          showMore: t("list.window.showMore"),
          showAll: t("list.window.showAll"),
          limitReached: t("list.window.limitReached"),
          filterScope: t("list.window.filterScope"),
        }}
      />
    </div>
  );
}
