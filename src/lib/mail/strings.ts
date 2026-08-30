/**
 * T-149 — Chaînes d'habillage des e-mails localisées.
 *
 * La langue d'un e-mail est celle **du destinataire** (voyageur ou hôte),
 * pas celle de l'expéditeur ni de la plateforme : un voyageur ayant réglé
 * son interface en anglais reçoit l'habillage de l'e-mail en anglais.
 *
 * Périmètre : ces chaînes couvrent les éléments que la plateforme maîtrise
 * (logo/slogan, boutons d'action, en-têtes des tableaux récapitulatifs,
 * mentions légales et gabarits entièrement gérés par la plateforme comme
 * l'alerte de prix ou l'activation de compte invité). Les *corps de message*
 * éditables par l'admin (`app_settings.emailTemplates`) restent dans la
 * langue de rédaction choisie par l'admin (français par défaut) : c'est un
 * contenu éditorial qui n'est pas traduit automatiquement.
 *
 * Comme l'interface (voir `UiLocale` dans `ui-strings.ts`), seuls le
 * français et l'anglais sont traduits ; toute autre langue (`ar`…) retombe
 * sur le français.
 */

export type MailLocale = "fr" | "en";

export function toMailLocale(language: string | null | undefined): MailLocale {
  return language === "en" ? "en" : "fr";
}

interface MailStrings {
  slogan: string;
  verifyEmail: string;
  copyLink: string;
  choosePassword: string;
  accessAccount: string;
  activateAccess: string;
  personalLink24h: string;
  viewBooking: string;
  leaveReview: string;
  bookingRef: string;
  lblReference: string;
  lblAccommodation: string;
  lblArrival: string;
  lblDeparture: string;
  lblTotal: string;
  lblGuest: string;
  hostDashboardHint: string;
  dashboard: string;
  guestClaimSaved: string;
  guestClaimAction: string;
  priceAlertFollowing: string;
  priceAlertOfferTrip: string;
  priceAlertOfferBase: string;
  reviewRequestRef: string;
}

const FR: MailStrings = {
  slogan: "Réservez mieux. Voyagez plus.",
  verifyEmail: "Vérifier mon email",
  copyLink: "Ou copiez-collez ce lien dans votre navigateur :",
  choosePassword: "Choisir un nouveau mot de passe",
  accessAccount: "Accéder à mon compte",
  activateAccess: "Activer mon accès",
  personalLink24h: "Ce lien est personnel et expire dans 24 heures.",
  viewBooking: "Voir ma réservation",
  leaveReview: "Laisser mon avis",
  bookingRef: "Réservation",
  lblReference: "Référence",
  lblAccommodation: "Hébergement",
  lblArrival: "Arrivée",
  lblDeparture: "Départ",
  lblTotal: "Total",
  lblGuest: "Voyageur",
  hostDashboardHint: "Consultez le détail dans votre",
  dashboard: "tableau de bord",
  guestClaimSaved: "est enregistrée. Créez votre mot de passe pour accéder à vos réservations et suivre votre séjour.",
  guestClaimAction: "Votre réservation",
  priceAlertFollowing: "Vous recevez cet email car vous suivez cet hébergement sur MyBestBooking.",
  priceAlertOfferTrip: "pour votre séjour (hors taxes et réductions personnelles)",
  priceAlertOfferBase: "à partir de (prix de base)",
  reviewRequestRef: "Réservation",
};

const EN: MailStrings = {
  slogan: "Book better. Travel further.",
  verifyEmail: "Verify my email",
  copyLink: "Or paste this link into your browser:",
  choosePassword: "Choose a new password",
  accessAccount: "Go to my account",
  activateAccess: "Activate my access",
  personalLink24h: "This link is personal and expires within 24 hours.",
  viewBooking: "View my booking",
  leaveReview: "Leave a review",
  bookingRef: "Booking",
  lblReference: "Reference",
  lblAccommodation: "Accommodation",
  lblArrival: "Check-in",
  lblDeparture: "Check-out",
  lblTotal: "Total",
  lblGuest: "Guest",
  hostDashboardHint: "See the details in your",
  dashboard: "dashboard",
  guestClaimSaved: "is confirmed. Create your password to access your bookings and track your stay.",
  guestClaimAction: "Your booking",
  priceAlertFollowing: "You are receiving this email because you follow this property on MyBestBooking.",
  priceAlertOfferTrip: "for your stay (excluding taxes and personal discounts)",
  priceAlertOfferBase: "from (base price)",
  reviewRequestRef: "Booking",
};

export function mailStrings(locale: MailLocale): MailStrings {
  return locale === "en" ? EN : FR;
}
