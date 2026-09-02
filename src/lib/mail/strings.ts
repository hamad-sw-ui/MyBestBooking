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
 * l'alerte de prix ou l'activation de compte invité). Les *corps* des
 * gabarits admin (`app_settings.emailTemplates`) : si l'admin n'a pas
 * personnalisé le bloc (égal aux DEFAULTS FR), on envoie la version
 * localisée ; une rédaction custom reste telle quelle.
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
  newMessageSubject: string;
  newMessageBody: string;
  replyToMessage: string;
  hostCancelSubject: string;
  hostCancelBody: string;
  hostCancelCta: string;
  lblReason: string;
  // T-156 (audit n°29) : annulation par l'hébergeur / l'administrateur —
  // e-mail plateforme (jamais édité par l'admin), remboursement intégral.
  operatorCancelHostSubject: string;
  operatorCancelHostBody: string;
  operatorCancelAdminSubject: string;
  operatorCancelAdminBody: string;
  lblFullRefund: string;
  verifySubject: string;
  verifyBody: string;
  resetSubject: string;
  resetBody: string;
  welcomeSubject: string;
  welcomeBody: string;
  bookingConfirmSubject: string;
  bookingConfirmBody: string;
  hostNotifSubject: string;
  hostNotifBody: string;
  cancelSubject: string;
  cancelBody: string;
  reminderSubject: string;
  reminderBody: string;
  reviewSubject: string;
  reviewBody: string;
  // E-mail de test « vérifier la connexion provider » (panneau admin).
  providerTestSubject: string;
  providerTestBody: string;
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
  newMessageSubject: "Nouveau message de {senderName}",
  newMessageBody:
    "Bonjour {firstName},\n\n" +
    "Vous avez reçu un nouveau message de {senderName} sur MyBestBooking. " +
    "Répondez directement depuis votre messagerie.",
  replyToMessage: "Répondre au message",
  hostCancelSubject: "Annulation de votre réservation {bookingReference}",
  hostCancelBody:
    "Bonjour {hostFirstName},\n\n" +
    "La réservation {bookingReference} pour {propertyName} a été annulée. " +
    "Le voyageur {guestName} ne séjournera pas du {checkIn} au {checkOut}.",
  hostCancelCta: "Voir mes réservations",
  lblReason: "Motif",
  operatorCancelHostSubject: "Votre réservation {bookingReference} a été annulée par l'hébergeur",
  operatorCancelHostBody:
    "Bonjour {firstName},\n\n" +
    "L'hébergeur de {propertyName} a annulé votre réservation {bookingReference}. " +
    "Le montant de {refundAmount} {currency} vous sera remboursé intégralement.",
  operatorCancelAdminSubject: "Votre réservation {bookingReference} a été annulée",
  operatorCancelAdminBody:
    "Bonjour {firstName},\n\n" +
    "Votre réservation {bookingReference} chez {propertyName} a été annulée par l'équipe MyBestBooking. " +
    "Le montant de {refundAmount} {currency} vous sera remboursé intégralement.",
  lblFullRefund: "Remboursement intégral",
  verifySubject: "Vérifiez votre email — MyBestBooking",
  verifyBody:
    "Bienvenue {firstName} 👋\n\n" +
    "Merci d'avoir créé votre compte MyBestBooking. Il ne reste qu'à confirmer votre adresse email pour commencer à réserver.\n\n" +
    "Ce lien expire dans 24 heures.",
  resetSubject: "Réinitialiser votre mot de passe — MyBestBooking",
  resetBody:
    "Bonjour {firstName},\n\n" +
    "Vous avez demandé à réinitialiser votre mot de passe.\n\n" +
    "Ce lien expire dans 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.",
  welcomeSubject: "Bienvenue sur MyBestBooking 🎉",
  welcomeBody:
    "Bonjour {firstName} 👋\n\n" +
    "Votre adresse email est vérifiée : votre compte MyBestBooking est prêt.\n\n" +
    "Recherchez un hébergement, suivez vos coups de cœur et retrouvez vos réservations depuis votre tableau de bord. Bonnes réservations !",
  bookingConfirmSubject: "Réservation confirmée {bookingReference}",
  bookingConfirmBody:
    "Bonjour {firstName},\n\n" +
    "Votre réservation est confirmée. Retrouvez le récapitulatif ci-dessous.\n\n" +
    "Bon voyage !",
  hostNotifSubject: "Nouvelle réservation {bookingReference}",
  hostNotifBody:
    "Bonjour {hostFirstName},\n\n" +
    "Une nouvelle réservation vient d'être confirmée sur votre hébergement.",
  cancelSubject: "Réservation annulée {bookingReference}",
  cancelBody:
    "Bonjour {firstName},\n\n" +
    "Votre réservation {bookingReference} pour {propertyName} a été annulée.\n\n" +
    "Frais d'annulation appliqués : {cancellationFee} {currency}.",
  reminderSubject: "Votre séjour à {propertyName} approche ({checkIn})",
  reminderBody:
    "Bonjour {firstName},\n\n" +
    "Votre séjour pour {propertyName}, {city} commence le {checkIn} (départ le {checkOut}).\n\n" +
    "{daysLabel}. Retrouvez votre réservation {bookingReference} et toutes les infos pratiques dans votre tableau de bord.",
  reviewSubject: "Comment s'est passé votre séjour à {propertyName} ?",
  reviewBody:
    "Bonjour {firstName},\n\n" +
    "Nous espérons que votre séjour à {propertyName} s'est bien passé.\n\n" +
    "Votre avis aide les autres voyageurs à mieux réserver. Cela ne prend qu'une minute — merci pour votre retour !",
  providerTestSubject: "Test de configuration Resend — MyBestBooking",
  providerTestBody: "La configuration Resend a répondu avec succès.",
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
  newMessageSubject: "New message from {senderName}",
  newMessageBody:
    "Hi {firstName},\n\n" +
    "You have received a new message from {senderName} on MyBestBooking. " +
    "Reply directly from your inbox.",
  replyToMessage: "Reply to the message",
  hostCancelSubject: "Cancellation of your booking {bookingReference}",
  hostCancelBody:
    "Hello {hostFirstName},\n\n" +
    "Booking {bookingReference} for {propertyName} has been cancelled. " +
    "Guest {guestName} will not stay from {checkIn} to {checkOut}.",
  hostCancelCta: "View my bookings",
  lblReason: "Reason",
  operatorCancelHostSubject: "Your booking {bookingReference} was cancelled by the host",
  operatorCancelHostBody:
    "Hi {firstName},\n\n" +
    "The host of {propertyName} has cancelled your booking {bookingReference}. " +
    "The amount of {refundAmount} {currency} will be refunded to you in full.",
  operatorCancelAdminSubject: "Your booking {bookingReference} has been cancelled",
  operatorCancelAdminBody:
    "Hi {firstName},\n\n" +
    "Your booking {bookingReference} at {propertyName} has been cancelled by the MyBestBooking team. " +
    "The amount of {refundAmount} {currency} will be refunded to you in full.",
  lblFullRefund: "Full refund",
  verifySubject: "Verify your email — MyBestBooking",
  verifyBody:
    "Welcome {firstName} 👋\n\n" +
    "Thanks for creating your MyBestBooking account. Confirm your email address to start booking.\n\n" +
    "This link expires in 24 hours.",
  resetSubject: "Reset your password — MyBestBooking",
  resetBody:
    "Hi {firstName},\n\n" +
    "You asked to reset your password.\n\n" +
    "This link expires in 1 hour. If you did not request this, ignore this email.",
  welcomeSubject: "Welcome to MyBestBooking 🎉",
  welcomeBody:
    "Hi {firstName} 👋\n\n" +
    "Your email is verified: your MyBestBooking account is ready.\n\n" +
    "Search for a stay, follow your favourites and find your bookings in your dashboard. Happy travels!",
  bookingConfirmSubject: "Booking confirmed {bookingReference}",
  bookingConfirmBody:
    "Hi {firstName},\n\n" +
    "Your booking is confirmed. See the summary below.\n\n" +
    "Have a great trip!",
  hostNotifSubject: "New booking {bookingReference}",
  hostNotifBody:
    "Hi {hostFirstName},\n\n" +
    "A new booking has just been confirmed on your property.",
  cancelSubject: "Booking cancelled {bookingReference}",
  cancelBody:
    "Hi {firstName},\n\n" +
    "Your booking {bookingReference} for {propertyName} has been cancelled.\n\n" +
    "Cancellation fee applied: {cancellationFee} {currency}.",
  reminderSubject: "Your stay at {propertyName} is coming up ({checkIn})",
  reminderBody:
    "Hi {firstName},\n\n" +
    "Your stay at {propertyName}, {city} starts on {checkIn} (check-out {checkOut}).\n\n" +
    "{daysLabel}. Find booking {bookingReference} and practical details in your dashboard.",
  reviewSubject: "How was your stay at {propertyName}?",
  reviewBody:
    "Hi {firstName},\n\n" +
    "We hope your stay at {propertyName} went well.\n\n" +
    "Your review helps other travellers book better. It only takes a minute — thank you!",
  providerTestSubject: "Resend configuration test — MyBestBooking",
  providerTestBody: "The Resend configuration responded successfully.",
};

export function mailStrings(locale: MailLocale): MailStrings {
  return locale === "en" ? EN : FR;
}
