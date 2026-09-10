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
  onlinePaymentDisabled?: boolean;
}

/**
 * T-207 — Aucun formulaire Stripe/carte ne doit être affiché dans le produit.
 *
 * Le helper reste en place comme garde défensive pour les anciennes réponses
 * `payment` : même si une intégration legacy renvoie `clientSecret`, le tunnel
 * de réservation ne doit plus mener vers un paiement dans la plateforme.
 */
export function shouldShowStripeForm(_result: BookingSubmitResult): boolean {
  return false;
}
