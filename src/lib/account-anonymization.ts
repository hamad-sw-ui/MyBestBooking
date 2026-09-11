import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { bookings, emailOutbox, priceAlerts, sessions, users } from "@/db/schema";
import type { db } from "@/db";

/**
 * T-242 (audit n°4, constat N1) — anonymisation **complète** à la suppression
 * de compte.
 *
 * Avant : seule la table `users` était nettoyée. L'identité du demandeur
 * survivait donc dans trois copies :
 *   - `bookings.guest_email / guest_first_name / guest_last_name` (figées à la
 *     réservation),
 *   - `email_outbox.to` (une ligne par e-mail envoyé),
 *   - `audit_log.metadata.targetEmail` (écrit par la suspension admin).
 *
 * Après : la transaction neutralise ces copies **sans toucher aux agrégats
 * comptables** (référence, dates, montants, devise, commission, statut), afin
 * que les factures et exports restent valides.
 *
 * Contraintes respectées : une seule transaction (aucun état intermédiaire
 * visible), aucun changement de schéma, aucun changement de contrat d'API.
 */

/** Prénom affiché pour un compte effacé (valeur historique conservée). */
export const ANONYMIZED_FIRST_NAME = "Supprimé";
/** Nom affiché pour un compte effacé (valeur historique conservée). */
export const ANONYMIZED_LAST_NAME = "Compte";

/**
 * Adresse de substitution : `deleted-<sha256(email)[:16]>@anonymized.local`.
 * Non déchiffrable mais unique et déterministe (BUG-025, conservé).
 */
export function anonymizedEmailFor(email: string): string {
  const emailHash = createHash("sha256").update(email).digest("hex").slice(0, 16);
  return `deleted-${emailHash}@anonymized.local`;
}

/**
 * Exécuteur minimal partagé par `db` et une transaction Drizzle (même
 * convention que `src/lib/review-aggregates.ts`).
 */
type AnonymizationExecutor = Pick<typeof db, "execute" | "update" | "delete">;

export interface AnonymizeAccountInput {
  userId: string;
  /** Adresse d'origine, encore présente dans `users` au moment de l'appel. */
  originalEmail: string;
  anonymizedEmail: string;
  /** Horodatage de l'opération (injectable pour les tests). */
  now?: Date;
}

/**
 * Neutralise l'identité personnelle partout où elle a été copiée.
 * À appeler **dans la transaction** de suppression de compte.
 */
export async function anonymizeUserAccount(
  executor: AnonymizationExecutor,
  { userId, originalEmail, anonymizedEmail, now = new Date() }: AnonymizeAccountInput,
): Promise<void> {
  await executor
    .update(users)
    .set({
      deletedAt: now,
      updatedAt: now,
      email: anonymizedEmail,
      firstName: ANONYMIZED_FIRST_NAME,
      lastName: ANONYMIZED_LAST_NAME,
      phone: null,
      avatarUrl: null,
      twoFactorSecret: null,
      twoFactorPendingSecret: null,
      // T-231 (A11) : les codes de secours sont des données d'authentification
      // personnelles — ils disparaissent avec le compte.
      twoFactorBackupCodes: null,
      twoFactorEnabled: false,
      // T-230 (A10) : un compte supprimé n'est plus « suspendu » (états distincts).
      suspendedAt: null,
      suspendedReason: null,
      // T-274 (audit n°8, F4) : un compte supprimé ne reçoit plus d'alertes
      // prix — le flag opt-in est coupé avec le compte (l'anonymisation ne
      // touchait que l'identité ; l'alerte active + flag true continuaient
      // d'être scannées par le cron, e-mails « sent » vers l'adresse
      // anonymisée — prouvé runtime pendant l'audit).
      priceAlertEnabled: false,
    })
    .where(eq(users.id, userId));

  // T-274 (audit n°8, F4) : les alertes prix du compte sont désactivées dans
  // la même transaction (l'étape ci-dessus couvrait le flag ; celle-ci couvre
  // les lignes `price_alerts.active` — les deux ensemble : un compte mort ne
  // notifie plus, quelle que soit la porte d'entrée du scan).
  await executor
    .update(priceAlerts)
    .set({ active: false })
    .where(eq(priceAlerts.userId, userId));

  // Copies d'identité figées dans les réservations : le séjour reste
  // incontestable (référence, dates, montants intacts), le nom disparaît.
  await executor
    .update(bookings)
    .set({
      guestEmail: anonymizedEmail,
      guestFirstName: ANONYMIZED_FIRST_NAME,
      guestLastName: ANONYMIZED_LAST_NAME,
    })
    .where(eq(bookings.userId, userId));

  // Historique d'envoi : la trace reste (utile au support), l'adresse part.
  await executor
    .update(emailOutbox)
    .set({ to: anonymizedEmail, updatedAt: now })
    .where(eq(emailOutbox.to, originalEmail));

  // Journal d'audit : l'action et sa date restent, l'adresse visée est
  // masquée (redaction JSON, sans supprimer l'entrée).
  await executor.execute(sql`
    UPDATE audit_log
       SET metadata = jsonb_set(metadata, '{targetEmail}', to_jsonb(${anonymizedEmail}::text))
     WHERE metadata ->> 'targetEmail' = ${originalEmail}
  `);

  await executor.delete(sessions).where(eq(sessions.userId, userId));
}
