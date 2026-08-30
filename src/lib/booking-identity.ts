/**
 * T-157 (audit n°29) — identité d'un compte connecté lors d'une réservation.
 *
 * Fonction pure, testable, utilisée par POST /api/bookings : un compte
 * connecté réserve sous SON identité — les champs invité du payload sont
 * ignorés (le serveur est l'autorité ; une confirmation ne peut jamais
 * partir vers un email tiers saisi à la main). Le guest mode (anonyme +`
 * isGuestBooking) garde son contrat inchangé (helper retourne null).
 */

export type IdentityUser = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  country: string | null;
};

export type BookingGuestIdentity = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  country: string;
};

export function bookingGuestIdentity(user: IdentityUser | null): BookingGuestIdentity | null {
  if (!user) return null;
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email.toLowerCase(),
    phone: user.phone ?? null,
    country: user.country ?? "FR",
  };
}
