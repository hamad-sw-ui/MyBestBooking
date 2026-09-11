import { and, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { emailOutbox, sessions } from "@/db/schema";
import { CRON_RUN_RETENTION_DAYS, purgeCronRuns } from "@/lib/cron-trace";

/**
 * T-243 (audit n°4, constat N2) — rétention des données techniques.
 *
 * Constat : le cron nettoyait les uploads orphelins mais **jamais** les
 * sessions expirées, les e-mails livrés ni le journal d'audit. En production,
 * `sessions` devenait la table la plus volumineuse (une ligne par connexion
 * « se souvenir de moi ») et le journal d'audit croissait indéfiniment.
 *
 * Politique retenue (conservatrice, alignée sur `.ai/DATABASE.md`) :
 *   - `sessions` : suppression 7 jours **après** expiration (fenêtre
 *     conservée pour l'analyse d'incident) ;
 *   - `email_outbox` : suppression des messages **terminaux** (`sent`/`failed`)
 *     de plus de 90 jours ; les `pending` et `sending` ne sont **jamais**
 *     purgés, quel que soit leur âge (sinon un e-mail en attente de livraison
 *     disparaîtrait silencieusement) ;
 *   - `audit_log` : conservation longue, **aucune purge automatique** — la
 *     profondeur de rétention est mesurée et exposée pour l'exploitation ;
 *   - `cron_runs` (T-250) : traces d'exécution de plus de 90 jours supprimées
 *     (une ligne par heure au maximum : volume négligeable, mais aucune raison
 *     de croître sans borne).
 */

export const SESSION_RETENTION_DAYS = 7;
export const OUTBOX_RETENTION_DAYS = 90;

export interface TechnicalPurgeResult {
  /** Sessions expirées supprimées (expiration > 7 jours). */
  sessionsPurged: number;
  /** E-mails terminaux (`sent`/`failed`) de plus de 90 jours supprimés. */
  emailsPurged: number;
  /** Date de la plus ancienne entrée d'audit conservée (`null` si vide). */
  oldestAuditAt: string | null;
  /** Nombre d'entrées d'audit conservées (mesure, aucune purge). */
  auditRows: number;
  /** T-250 : traces d'exécution de cron supprimées (rétention 90 jours). */
  cronRunsPurged: number;
}

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

export async function purgeTechnicalData(now: Date = new Date()): Promise<TechnicalPurgeResult> {
  const purgedSessions = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, daysAgo(now, SESSION_RETENTION_DAYS)))
    .returning({ id: sessions.id });

  const purgedEmails = await db
    .delete(emailOutbox)
    .where(
      and(
        lt(emailOutbox.createdAt, daysAgo(now, OUTBOX_RETENTION_DAYS)),
        // `neq(..., 'pending')` laisserait passer `sending` (claim en cours) :
        // on énumère les états terminaux pour que seuls ceux-là partent.
        sql`${emailOutbox.status} IN ('sent', 'failed')`,
      ),
    )
    .returning({ id: emailOutbox.id });

  const cronRunsPurged = await purgeCronRuns(CRON_RUN_RETENTION_DAYS, now);

  const stats = await db.execute<{ total: string; oldest: string | null }>(sql`
    SELECT COUNT(*)::text AS total, MIN(created_at)::text AS oldest FROM audit_log
  `);
  const row = (stats as unknown as { rows?: { total: string; oldest: string | null }[] }).rows?.[0];

  return {
    sessionsPurged: purgedSessions.length,
    emailsPurged: purgedEmails.length,
    cronRunsPurged,
    auditRows: Number(row?.total ?? 0),
    oldestAuditAt: row?.oldest ?? null,
  };
}
