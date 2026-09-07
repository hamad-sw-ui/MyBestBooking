/**
 * Décisions de flux UI du tunnel de réservation, extraites en fonctions pures
 * pour être testables (cadre .ai/ : preuves chez les tests).
 */

export interface BookingSubmitResult {
  booking?: { id?: string } | null;
  payment?: {
    requiresConfirmation?: boolean;
    clientSecret?: string | null;
    provider?: string | null;
  } | null;
  manualConfirmation?: boolean;
}

/**
 * P3 — Décide si l'UI de carte (Stripe) doit être affichée après une
 * création/reprise de réservation.
 *
 * Une réservation **manuelle** (paiement sur place, `manualConfirmation:true`)
 * ne doit **jamais** afficher l'UI Stripe, même si le serveur renvoyait un
 * `payment` malgré tout — le flux manuel affiche l'écran « Demande envoyée /
 * Montant à régler sur place ». Ce garde protège en profondeur contre une
 * régression serveur qui recréerait un intent en ligne pour un booking manuel.
 */
export function shouldShowStripeForm(result: BookingSubmitResult): boolean {
  // Priorité manuel : jamais d'UI carte pour un paiement sur place.
  if (result.manualConfirmation) return false;
  return Boolean(result.payment?.requiresConfirmation && result.payment.clientSecret);
}
