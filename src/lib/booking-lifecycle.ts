export type BookingStatus = "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
export type BookingActor = "customer" | "host" | "admin" | "system";

const transitions: Record<BookingStatus, BookingStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["cancelled", "completed", "no_show"],
  cancelled: [],
  completed: [],
  no_show: [],
};

function toDate(value: string | Date): string {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
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
    if (input.next === "cancelled") return null;
    if (input.next === "completed" || input.next === "no_show") {
      const today = input.today ?? new Date().toISOString().slice(0, 10);
      return toDate(input.checkOut) <= today ? null : "Le séjour ne peut être clôturé qu'après la date de départ";
    }
    return "Transition réservée à un administrateur";
  }
  if (input.actor === "system") {
    if (input.next !== "completed") return "La tâche système ne peut que clôturer un séjour";
    const today = input.today ?? new Date().toISOString().slice(0, 10);
    return toDate(input.checkOut) <= today ? null : "Le séjour n'est pas encore terminé";
  }
  return null;
}

export function isReviewEligible(status: BookingStatus, checkOut: string | Date, today?: string): boolean {
  const reference = today ?? new Date().toISOString().slice(0, 10);
  return status === "completed" && toDate(checkOut) <= reference;
}
