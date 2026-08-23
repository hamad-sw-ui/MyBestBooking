import { sql } from "drizzle-orm";

/** Exécuteur minimal partagé par db et transaction Drizzle. */
type SqlExecutor = { execute: (query: ReturnType<typeof sql>) => Promise<unknown> };

/**
 * Recalcule les données dénormalisées d’une property à partir des seuls avis
 * approuvés. À appeler dans la même transaction que create/moderate/delete.
 */
export async function recomputePropertyReviewAggregate(executor: SqlExecutor, propertyId: string): Promise<void> {
  await executor.execute(sql`
    UPDATE properties
       SET average_rating = COALESCE((
             SELECT ROUND(AVG(overall_rating)::numeric, 1)
               FROM reviews
              WHERE property_id = ${propertyId}
                AND status = 'approved'
           ), 0),
           total_reviews = (
             SELECT COUNT(*)::int
               FROM reviews
              WHERE property_id = ${propertyId}
                AND status = 'approved'
           )
     WHERE id = ${propertyId}
  `);
}
