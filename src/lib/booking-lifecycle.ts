import { civilToday, toCivilDate } from "@/lib/dates";

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
export type BookingActor = "customer" | "host" | "admin" | "system";

const transitions: Record<BookingStatus, BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["cancelled", "completed", "no_show"],
  cancelled: [],
  completed: [],
  no_show: [],
};

/**
 * T-232/T-240 (audit n°3) — lecture normalisée d'une date civile.
 *
 * Un `Date` issu d'une colonne `date` était converti par `toISOString()`, donc
 * lu en UTC : c'était fortuit. La normalisation vit désormais dans
 * `src/lib/dates.ts`, seule autorité, et les colonnes `date` sont lues en
 * chaîne (voir `src/db/index.ts`).
 */
function toDate(value: string | Date): string {
  return toCivilDate(value) ?? "";
}

/**
 * Décide qui peut faire une transition. Les voyageurs ne peuvent jamais
 * déclarer leur propre séjour terminé : cela protège les avis vérifiés.
 */
export function transitionError(input: {
  current: BookingStatus;
  next: BookingStatus | undefined;
  actor: BookingActor;
  checkOut: string | Date;
  today?: string;
}): string | null {
  if (!input.next || input.next === input.current) return null;
  if (!(transitions[input.current] ?? []).includes(input.next)) {
    return `Transition invalide : ${input.current} → ${input.next}`;
  }

  if (input.actor === "customer") {
    return input.next === "cancelled" ? null : "Un voyageur peut uniquement annuler sa réservation";
  }
  if (input.actor === "host") {
    // T-202 : l'hôte confirme la demande `pending` → `confirmed` à la main
    // (plus de paiement automatique). Il peut aussi annuler, ou clôturer en
    // no-show/terminé après le départ.
    if (input.next === "cancelled") return null;
    if (input.next === "confirmed") return input.current === "pending" ? null : "Seule une réservation en attente peut être confirmée";
    if (input.next === "completed" || input.next === "no_show") {
      const today = input.today ?? civilToday();
      return toDate(input.checkOut) <= today ? null : "Le séjour ne peut être clôturé qu'après la date de départ";
    }
    return "Transition réservée à un administrateur";
  }
  if (input.actor === "system") {
    if (input.next !== "completed") return "La tâche système ne peut que clôturer un séjour";
    const today = input.today ?? civilToday();
    return toDate(input.checkOut) <= today ? null : "Le séjour n'est pas encore terminé";
  }
  return null;
}

export function isReviewEligible(status: BookingStatus, checkOut: string | Date, today?: string): boolean {
  const reference = today ?? civilToday();
  return status === "completed" && toDate(checkOut) <= reference;
}

/** Liste exhaustive des statuts, dans l'ordre du cycle de vie. */
export const BOOKING_STATUSES: readonly BookingStatus[] = [
  "pending",
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
] as const;

/**
 * T-216 — transitions réellement proposables à un acteur donné.
 *
 * Dérivée **exclusivement** de `transitionError()` (source unique de vérité
 * partagée avec l'API) : l'UI ne fait que ne pas proposer ce que le serveur
 * refuserait de toute façon. S'y ajoute la garde paiement, qui vit dans la
 * route `PUT /api/bookings/[id]` : une clôture `completed` n'est proposée que
 * si le règlement est constaté (`paymentStatus === "paid"`), faute de quoi le
 * serveur répond 409.
 *
 * Fonction pure (aucune I/O) : testable et utilisable côté serveur comme
 * côté client.
 */
export function availableTransitions(input: {
  current: BookingStatus;
  actor: BookingActor;
  checkOut: string | Date;
  paymentStatus?: string | null;
  today?: string;
}): BookingStatus[] {
  const candidates = transitions[input.current] ?? [];
  return candidates.filter((next) => {
    if (next === "completed" && input.paymentStatus !== "paid") return false;
    return (
      transitionError({
        current: input.current,
        next,
        actor: input.actor,
        checkOut: input.checkOut,
        today: input.today,
      }) === null
    );
  });
}
