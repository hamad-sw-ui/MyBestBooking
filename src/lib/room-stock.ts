import { sql } from "drizzle-orm";
import { db } from "@/db";

export { remainingStock } from "@/lib/room-stock-rules";

/**
 * T-244 (audit n°4, constat N3) — stock affiché vs stock vendable.
 *
 * Le calendrier hôte n'affichait que le **stock déclaré** (`room_availability`),
 * sans retirer les séjours en cours, alors que le tunnel de réservation
 * applique bien les deux (stock déclaré puis chevauchements de réservations).
 * Résultat : « 2 disponibles » à l'écran pour une seule unité réellement
 * vendable.
 *
 * Ici, une seule règle de calcul — celle du tunnel — exprimée en SQL
 * (`d >= check_in AND d < check_out`, convention hôtelière) pour éviter toute
 * dépendance au fuseau du serveur Node.
 */

/**
 * Nombre de séjours actifs couvrant chaque jour de `[from, to]` (bornes
 * incluses, format `YYYY-MM-DD`). Les réservations `cancelled` sont exclues
 * (même périmètre que le tunnel).
 */
export async function loadBookedCounts(
  roomId: string,
  from: string,
  to: string,
): Promise<Record<string, number>> {
  const result = await db.execute<{ date: string; booked: number | string }>(sql`
    SELECT d::date::text AS date,
           COUNT(b.id)::int AS booked
      FROM generate_series(${from}::date, ${to}::date, INTERVAL '1 day') AS d
      LEFT JOIN bookings b
             ON b.room_id = ${roomId}::uuid
            AND b.status <> 'cancelled'
            AND d::date >= b.check_in
            AND d::date <  b.check_out
     GROUP BY d
     ORDER BY d
  `);
  const rows = (result as unknown as { rows?: { date: string; booked: number | string }[] }).rows ?? [];
  const counts: Record<string, number> = {};
  for (const row of rows) {
    counts[typeof row.date === "string" ? row.date.slice(0, 10) : String(row.date)] = Number(row.booked);
  }
  return counts;
}
