import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { properties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { NewRoomForm } from "@/components/new-room-form";
import { getServerLocale } from "@/lib/server-locale";
import { makeT } from "@/lib/ui-strings";

/**
 * /dashboard/rooms/new (T-030)
 * Formulaire d'ajout d'une chambre pour un host. Admin peut choisir
 * n'importe quelle property, host uniquement les siennes.
 */
export default async function NewRoomPage() {
  const user = await getCurrentUser();
  const t = makeT(await getServerLocale());
  if (!user) redirect("/connexion");
  if (user.role !== "host" && user.role !== "admin") redirect("/dashboard");

  const props = user.role === "admin"
    ? await db.select({ id: properties.id, name: properties.name }).from(properties)
    : await db
        .select({ id: properties.id, name: properties.name })
        .from(properties)
        .where(eq(properties.hostId, user.id));

  return (
    <div className="max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {t("room.newTitle")}
        </h1>
        <p className="text-gray-600 mt-1">
          {t("room.newSubtitle")}
        </p>
      </div>
      <NewRoomForm properties={props} />
    </div>
  );
}
