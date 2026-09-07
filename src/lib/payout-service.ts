import { and, eq, sql, desc, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { bookings, properties, payouts, payoutAccounts } from "@/db/schema";
import { aggregatePayouts, previousMonthRange, type PayoutDraft } from "@/lib/payouts";
import { sealSecretValue, openSecretValue, ProviderCredentialsError } from "@/lib/provider-credentials";
import { format, subMonths } from "date-fns";

/**
 * T-195 — Couche d'accès aux versements (ledger + projection).
 *
 * Un « versement projeté » expose ce qu'un hôte/admin PEUT recevoir pour une
 * période (agrégation des bookings payés) ; un « versement créé » est un payout
 * persistant (idempotent) dont le statut suit l'exécution du provider.
 * La projection est calculée à la volée (pas de table de dénormalisation) pour
 * rester non-régressive et toujours cohérente avec le bilan.
 */

export interface ProjectedPayout {
  /** Hôte concerné (présent pour un admin qui voit tous les hôtes). */
  hostId?: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  gross: number;
  commission: number;
  net: number;
  bookingsCount: number;
}

const isAdminFilter = (hostId: string, isAdmin: boolean) =>
  isAdmin ? sql`1 = 1` : eq(properties.hostId, hostId);

/** Sélectionne les bookings payés (non annulés) de l'hôte sur une période. */
async function paidBookingsOfHost(
  hostId: string,
  isAdmin: boolean,
  start: string,
  end: string,
): Promise<Array<{ hostId: string; createdAt: Date; currency: string | null; total: string; commissionAmount: string; netToHost: string; paymentStatus: string | null; status: string | null }>> {
  const rows = await db
    .select({
      hostId: properties.hostId,
      createdAt: bookings.createdAt,
      currency: bookings.currency,
      total: bookings.total,
      commissionAmount: bookings.commissionAmount,
      netToHost: bookings.netToHost,
      paymentStatus: bookings.paymentStatus,
      status: bookings.status,
    })
    .from(bookings)
    .innerJoin(properties, eq(bookings.propertyId, properties.id))
    .where(and(
      isAdminFilter(hostId, isAdmin),
      eq(bookings.paymentStatus, "paid"),
      sql`${bookings.status} <> 'cancelled'`,
      gte(bookings.createdAt, new Date(`${start}T00:00:00.000Z`)),
      lte(bookings.createdAt, new Date(`${end}T23:59:59.999Z`)),
    ));
  return rows;
}

/** Versements projetés sur les 6 derniers mois, pour un hôte (ou tous si admin). */
export async function listProjectedPayouts(
  hostId: string,
  isAdmin: boolean,
  months = 6,
): Promise<ProjectedPayout[]> {
  const out: ProjectedPayout[] = [];
  const now = new Date();
  for (let i = 1; i <= months; i++) {
    const month = subMonths(now, i);
    const start = format(new Date(month.getFullYear(), month.getMonth(), 1), "yyyy-MM-dd");
    const end = format(new Date(month.getFullYear(), month.getMonth() + 1, 0), "yyyy-MM-dd");
    const rows = await paidBookingsOfHost(hostId, isAdmin, start, end);
    // P3 : quand `isAdmin`, `rows` couvre TOUS les hôtes ; `isPayoutEligible`
    // exige `b.hostId === hostId`, donc il faut agréger **par hôte** (un draft
    // par hôte+devise), sinon la projection admin serait toujours vide.
    let drafts: PayoutDraft[] = [];
    if (isAdmin) {
      const hosts = [...new Set(rows.map((r) => r.hostId))];
      drafts = hosts.flatMap((hId) =>
        aggregatePayouts(
          rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
          hId,
          start,
          end,
        ),
      );
    } else {
      drafts = aggregatePayouts(
        rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
        hostId,
        start,
        end,
      );
    }
    for (const d of drafts) out.push({ ...d, bookingsCount: d.bookingsCount });
  }
  return out;
}

/** Versements PERSISTÉS (ledger) d'un hôte / tous si admin. */
export async function listPersistedPayouts(hostId: string, isAdmin: boolean) {
  const rows = await db
    .select()
    .from(payouts)
    .where(isAdmin ? sql`1 = 1` : eq(payouts.hostId, hostId))
    .orderBy(desc(payouts.createdAt))
    .limit(50);
  return rows;
}

/**
 * Crée un payout persistant par devise pour une période (idempotent). Chaque
 * draft (un par devise) est consigné sous sa propre clé
 * `payout:host:period:currency` ; un draft déjà présent est renvoyé tel quel.
 * Appelé par la route « demander un versement » ou le cron. Ne déclenche PAS
 * le transfert (fait par le provider séparément) : on consigne d'abord, on
 * exécute ensuite.
 *
 * ⚠️ G6 : une période avec des bookings en plusieurs devises (EUR + XAF) génère
 * UN payout par devise — jamais une somme inter-devises.
 */
export async function createPayoutsForPeriod(
  hostId: string,
  isAdmin: boolean,
  start: string,
  end: string,
): Promise<{ created: boolean; createdCount: number; payouts: typeof payouts.$inferSelect[]; drafts: PayoutDraft[] }> {
  const rows = await paidBookingsOfHost(hostId, isAdmin, start, end);
  // P3 : quand `isAdmin`, `rows` couvre TOUS les hôtes ; on agrège **par hôte**
  // (un draft par hôte+devise). Pour un hôte simple, le comportement est intact
  // (un seul hôte dans `rows`).
  let drafts: PayoutDraft[] = [];
  if (isAdmin) {
    const hosts = [...new Set(rows.map((r) => r.hostId))];
    drafts = hosts.flatMap((hId) =>
      aggregatePayouts(
        rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
        hId,
        start,
        end,
      ),
    );
  } else {
    drafts = aggregatePayouts(
      rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
      hostId,
      start,
      end,
    );
  }
  if (drafts.length === 0) {
    return { created: false, createdCount: 0, payouts: [], drafts: [] };
  }
  const result: typeof payouts.$inferSelect[] = [];
  let createdCount = 0;
  for (const draft of drafts) {
    const [existing] = await db
      .select()
      .from(payouts)
      .where(eq(payouts.idempotencyKey, draft.idempotencyKey))
      .limit(1);
    if (existing) {
      result.push(existing);
      continue;
    }
    const [inserted] = await db
      .insert(payouts)
      .values({
        hostId: draft.hostId, // hôte réel (pour un hôte simple == param ; pour admin, le vrai hôte)
        periodStart: draft.periodStart,
        periodEnd: draft.periodEnd,
        currency: draft.currency,
        grossAmount: draft.gross.toFixed(2),
        commissionAmount: draft.commission.toFixed(2),
        netAmount: draft.net.toFixed(2),
        bookingsCount: draft.bookingsCount,
        status: "pending",
        idempotencyKey: draft.idempotencyKey,
      })
      .returning();
    result.push(inserted);
    createdCount += 1;
  }
  return { created: createdCount > 0, createdCount, payouts: result, drafts };
}

/** Rétro-compatibilité d'appel : alias mono-premier-draft (tests historiques). */
export async function createPayoutForPeriod(
  hostId: string,
  isAdmin: boolean,
  start: string,
  end: string,
): Promise<{ created: boolean; payout: typeof payouts.$inferSelect | null; draft: PayoutDraft | null }> {
  const res = await createPayoutsForPeriod(hostId, isAdmin, start, end);
  return { created: res.created, payout: res.payouts[0] ?? null, draft: res.drafts[0] ?? null };
}

/**
 * Consigne qu'un versement est en cours de traitement côté provider.
 * Persiste le `providerPayoutId` reçu (même pendant le traitement asynchrone)
 * pour qu'un webhook `payout.paid` ultérieur puisse le confirmer.
 */
export async function markPayoutProcessing(payoutId: string, providerPayoutId: string): Promise<void> {
  await db
    .update(payouts)
    .set({ status: "processing", providerPayoutId, processingAt: new Date(), updatedAt: new Date() })
    .where(eq(payouts.id, payoutId));
}

/** Marque un payout payé après succès provider (idempotent). */
export async function markPayoutPaid(payoutId: string, providerPayoutId: string): Promise<void> {
  await db
    .update(payouts)
    .set({ status: "paid", providerPayoutId, paidAt: new Date(), updatedAt: new Date() })
    .where(eq(payouts.id, payoutId));
}

/** Retrouve un payout par son identifiant fournisseur (`po_...`). */
export async function findPayoutByProviderId(providerPayoutId: string) {
  const [row] = await db
    .select()
    .from(payouts)
    .where(eq(payouts.providerPayoutId, providerPayoutId))
    .limit(1);
  return row ?? null;
}

/**
 * Confirme un payout `payout.paid`/`payout.succeeded` reçu par webhook.
 * Idempotent : un payout déjà `paid` (ou déjà `failed`) n'est jamais écrasé.
 * Renvoie `true` si un payout a été retrouvé et basculé (ou déjà payé).
 */
export async function markPayoutPaidByProviderId(providerPayoutId: string): Promise<boolean> {
  const payout = await findPayoutByProviderId(providerPayoutId);
  if (!payout) return false;
  if (payout.status === "paid") return true; // déjà confirmé — ne pas déplacer `paidAt`.
  await db
    .update(payouts)
    .set({ status: "paid", paidAt: new Date(), updatedAt: new Date(), lastError: null })
    .where(eq(payouts.id, payout.id));
  return true;
}

/** Signale un échec définitif de versement (`payout.failed`/`payout.canceled`). */
export async function markPayoutFailedByProviderId(providerPayoutId: string): Promise<boolean> {
  const payout = await findPayoutByProviderId(providerPayoutId);
  if (!payout) return false;
  if (payout.status === "failed") return true;
  await db
    .update(payouts)
    .set({ status: "failed", failedAt: new Date(), updatedAt: new Date() })
    .where(eq(payouts.id, payout.id));
  return true;
}

/** Moyen de versement par défaut d'un hôte (ou null). */
export async function getDefaultPayoutAccount(hostId: string) {
  const [account] = await db
    .select()
    .from(payoutAccounts)
    .where(and(eq(payoutAccounts.userId, hostId), eq(payoutAccounts.isDefault, true)))
    .limit(1);
  return account ?? null;
}

/** Compte de versement expurgé (jamais le secret, ni l'IBAN/account brut). */
export interface SanitizedPayoutAccount {
  id: string;
  provider: string;
  displayLabel: string | null;
  status: string;
  currency: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function sanitizePayoutAccount(row: typeof payoutAccounts.$inferSelect): SanitizedPayoutAccount {
  return {
    id: row.id,
    provider: row.provider,
    displayLabel: row.displayLabel,
    status: row.status,
    currency: row.currency,
    isDefault: row.isDefault,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export type PayoutAccountProvider = "stripe_connect" | "sepa";

export interface PayoutAccountInput {
  provider: PayoutAccountProvider;
  /** IBAN (saisi à la volée) ou Stripe Connect account_id — chiffré en DB. */
  reference: string;
  currency: string;
  displayLabel?: string;
}

/** Liste les comptes de versement d'un hôte (ou tous si admin), expurgés. */
export async function listPayoutAccounts(hostId: string, isAdmin: boolean): Promise<SanitizedPayoutAccount[]> {
  const rows = await db
    .select()
    .from(payoutAccounts)
    .where(isAdmin ? sql`1 = 1` : eq(payoutAccounts.userId, hostId))
    .orderBy(desc(payoutAccounts.createdAt));
  return rows.map(sanitizePayoutAccount);
}

/**
 * Crée / met à jour un compte de versement d'un hôte ou admin.
 * - `reference` est chiffré AES-GCM (vault provider-credentials) — jamais en clair en DB.
 * - Le premier compte d'un utilisateur devient `isDefault = true`.
 * - Idempotent sur (userId, provider) : on met à jour (ré-chiffrement) sauf si présent.
 * Renvoie la version expurgée.
 */
export async function upsertPayoutAccount(
  userId: string,
  input: PayoutAccountInput,
): Promise<{ created: boolean; account: SanitizedPayoutAccount }> {
  const sealed = sealSecretValue(input.reference); // throw ProviderCredentialsError si pas de clé maître
  const [existing] = await db
    .select()
    .from(payoutAccounts)
    .where(and(eq(payoutAccounts.userId, userId), eq(payoutAccounts.provider, input.provider)))
    .limit(1);
  const anyExisting = await db
    .select({ id: payoutAccounts.id })
    .from(payoutAccounts)
    .where(eq(payoutAccounts.userId, userId))
    .limit(1);
  const makeDefault = !anyExisting.length || existing?.isDefault === true;
  const displayLabel = input.displayLabel
    ? input.displayLabel
    : input.provider === "sepa"
      ? `SEPA · •••• ${input.reference.slice(-4)}`
      : "Stripe Connect";

  if (existing) {
    const [updated] = await db
      .update(payoutAccounts)
      .set({
        ...sealed,
        displayLabel,
        currency: input.currency,
        status: "verified",
        isDefault: makeDefault,
        updatedAt: new Date(),
      })
      .where(eq(payoutAccounts.id, existing.id))
      .returning();
    return { created: false, account: sanitizePayoutAccount(updated) };
  }

  const needUnsetDefault = makeDefault && anyExisting.length > 0;
  if (needUnsetDefault) {
    await db.update(payoutAccounts).set({ isDefault: false, updatedAt: new Date() }).where(eq(payoutAccounts.userId, userId));
  }
  const [inserted] = await db
    .insert(payoutAccounts)
    .values({
      userId,
      provider: input.provider,
      ...sealed,
      displayLabel,
      currency: input.currency,
      status: "verified",
      isDefault: makeDefault,
    })
    .returning();
  return { created: true, account: sanitizePayoutAccount(inserted) };
}

/** Déscelle le compte et renvoie la référence (IBAN / account_id) pour exécution. */
export async function openPayoutAccountReference(accountId: string): Promise<string> {
  const [row] = await db.select().from(payoutAccounts).where(eq(payoutAccounts.id, accountId)).limit(1);
  if (!row) throw new ProviderCredentialsError("Compte de versement introuvable");
  return openSecretValue(row);
}

/**
 * Tâche cron (G3) — génère un payout `pending` idempotent par (hôte, devise)
 * pour une période, pour TOUS les hôtes ayant des bookings payés. Ne déclenche
 * PAS le transfert (le provider est exécuté à la demande / webhook).
 */
export async function generatePendingPayoutsForPeriod(
  start: string,
  end: string,
): Promise<{ hosts: number; created: number; total: number; idempotentSkipped: number }> {
  const hostRows = await db
    .selectDistinct({ hostId: properties.hostId })
    .from(bookings)
    .innerJoin(properties, eq(bookings.propertyId, properties.id))
    .where(and(
      eq(bookings.paymentStatus, "paid"),
      sql`${bookings.status} <> 'cancelled'`,
      gte(bookings.createdAt, new Date(`${start}T00:00:00.000Z`)),
      lte(bookings.createdAt, new Date(`${end}T23:59:59.999Z`)),
    ));
  let created = 0;
  let total = 0;
  for (const { hostId } of hostRows) {
    const res = await createPayoutsForPeriod(hostId, false, start, end);
    total += res.payouts.length;
    created += res.createdCount;
  }
  return { hosts: hostRows.length, created, total, idempotentSkipped: Math.max(0, total - created) };
}

export { previousMonthRange };
