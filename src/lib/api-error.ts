import type { UiLocale } from "@/lib/ui-strings";

/**
 * T-169 — Traduction des messages d'erreur JSON renvoyés par l'API.
 *
 * Les routes conservent le français comme **source** (contrats smoke,
 * `frenchZodMessage`, défaut plateforme). Quand la locale UI est `en`
 * (cookie / header / préférence compte), le même libellé est mappé ici
 * avant d'être sérialisé. Les messages inconnus restent inchangés.
 */
export const API_ERROR_EN: Record<string, string> = {
  "2FA non active": "2FA is not active",
  "2FA non initialisée": "2FA is not set up",
  "Alerte introuvable": "Alert not found",
  "Erreur": "Error",
  "Accès activé. Vos réservations sont disponibles.": "Access enabled. Your bookings are available.",
  "Accès admin requis": "Admin access required",
  "Accès hébergeur ou admin requis": "Host or admin access required",
  "Accès refusé": "Access denied",
  "Adresse email invalide": "Invalid email address",
  "Aucun fichier fourni (champ 'file' attendu)": "No file provided ('file' field expected)",
  "Avis introuvable": "Review not found",
  "Ce champ est requis": "This field is required",
  "Ce code existe déjà": "This code already exists",
  "Ce compte est désactivé. Contactez le support pour le réactiver.":
    "This account is disabled. Contact support to reactivate it.",
  "Ce paiement ne peut plus être repris": "This payment can no longer be resumed",
  "Cet hébergement est déjà actif": "This property is already active",
  "Cette annonce ne peut pas être re-soumise dans son état actuel":
    "This listing cannot be resubmitted in its current state",
  "Cette pièce jointe est déjà liée à un message": "This attachment is already linked to a message",
  "Cette réservation ne peut plus être annulée": "This booking can no longer be cancelled",
  "Chambre non disponible": "Room unavailable",
  "Chambre non trouvée": "Room not found",
  "Chambre supprimée": "Room deleted",
  "Clé inconnue": "Unknown key",
  "Code 2FA invalide": "Invalid 2FA code",
  "Code 2FA requis": "2FA code required",
  "Code TOTP à 6 chiffres attendu": "6-digit TOTP code expected",
  "Code TOTP actif invalide": "Invalid active TOTP code",
  "Code TOTP actif requis pour remplacer la 2FA": "Active TOTP code required to replace 2FA",
  "Code alphanumérique majuscule": "Uppercase alphanumeric code",
  "Code inconnu": "Unknown code",
  "Code invalide": "Invalid code",
  "Code manquant": "Missing code",
  "Commission invalide": "Invalid commission",
  "Confirmation de rotation requise": "Rotation confirmation required",
  "Confirmation du provider requise": "Provider confirmation required",
  "Connexion réussie": "Signed in successfully",
  "Connexion validée": "Sign-in validated",
  "Corps de requête invalide ou manquant": "Invalid or missing request body",
  "Corps de requête invalide ou manquant (JSON attendu)":
    "Invalid or missing request body (JSON expected)",
  "Corps invalide (multipart attendu)": "Invalid body (multipart expected)",
  "Devise non supportée": "Unsupported currency",
  "Données de démonstration créées avec succès": "Demo data created successfully",
  "Données déjà présentes": "Data already present",
  "Email ou mot de passe incorrect": "Incorrect email or password",
  "Erreur lors de la création des données": "Error while creating data",
  "Fichier introuvable": "File not found",
  "Format invalide": "Invalid format",
  "Génération échouée": "Generation failed",
  "Hébergement archivé": "Property archived",
  "Hébergement déjà dans la liste": "Property already in the list",
  "Hébergement introuvable": "Property not found",
  "Hébergement non disponible": "Property unavailable",
  "Hébergement non trouvé": "Property not found",
  "Identifiant invalide": "Invalid identifier",
  "Impossible d'enregistrer le provider": "Unable to save the provider",
  "Impossible de lire l'état des providers": "Unable to read provider status",
  "Impossible de reprendre le paiement": "Unable to resume payment",
  "Impossible de réchiffrer les credentials providers": "Unable to re-encrypt provider credentials",
  "Impossible de réinitialiser le provider": "Unable to reset the provider",
  "Inscription réussie": "Sign-up successful",
  "Introuvable": "Not found",
  "JSON invalide": "Invalid JSON",
  "Key invalide": "Invalid key",
  "L'envoi de l'email a échoué, réessayez plus tard": "Email could not be sent, please try again later",
  "La date d'arrivée de l'alerte ne peut pas être dans le passé":
    "The alert check-in date cannot be in the past",
  "La date d'arrivée ne peut pas être dans le passé": "Check-in date cannot be in the past",
  "La date de départ doit être postérieure à l'arrivée": "Check-out must be after check-in",
  "La date de départ doit être postérieure à la date d'arrivée":
    "Check-out date must be after check-in date",
  "La date de fin doit être postérieure à la date de début": "End date must be after start date",
  "La fenêtre availability doit couvrir au maximum 365 jours":
    "The availability window must cover at most 365 days",
  "La réservation a expiré avant la préparation du paiement":
    "The booking expired before payment could be prepared",
  "La réservation est temporairement retenue, mais le paiement sécurisé n'a pas pu être préparé. Réessayez dans quelques instants.":
    "The booking is held temporarily, but secure payment could not be prepared. Please try again shortly.",
  "Langue non supportée": "Unsupported language",
  "Le code pays doit être de 2 caractères": "Country code must be 2 characters",
  "Le fichier n'est pas une image valide (JPEG, PNG, WebP ou GIF attendu).":
    "The file is not a valid image (JPEG, PNG, WebP or GIF expected).",
  "Le message ne peut pas être vide": "Message cannot be empty",
  "Le mot de passe doit contenir au moins 8 caractères": "Password must be at least 8 characters",
  "Le mot de passe est requis": "Password is required",
  "Le nom doit contenir au moins 2 caractères": "Name must be at least 2 characters",
  "Le nom doit contenir au moins 3 caractères": "Name must be at least 3 characters",
  "Le paramètre guests doit être un entier positif": "The guests parameter must be a positive integer",
  "Le paramètre minRating doit être un nombre entre 0 et 10":
    "The minRating parameter must be a number between 0 and 10",
  "Le paramètre offset doit être un entier positif ou nul":
    "The offset parameter must be a non-negative integer",
  "Le prestataire n'a pas retourné de formulaire de paiement":
    "The provider did not return a payment form",
  "Le prénom doit contenir au moins 2 caractères": "First name must be at least 2 characters",
  "Lien de réinitialisation invalide": "Invalid reset link",
  "Lien invalide ou expiré": "Invalid or expired link",
  "Liste non trouvée": "List not found",
  "Modification de commission réservée à l'admin": "Commission changes are reserved to admins",
  "Modification du statut réservée à l'administration": "Status changes are reserved to administrators",
  "Montant invalide": "Invalid amount",
  "Mot de passe incorrect": "Incorrect password",
  "Mot de passe modifié": "Password updated",
  "Mot de passe requis": "Password required",
  "Mot de passe réinitialisé. Vous pouvez vous connecter.":
    "Password reset. You can sign in.",
  "Non authentifié": "Not authenticated",
  "Non autorisé": "Unauthorized",
  "Non autorisé sur ce fichier": "Not authorized for this file",
  "Paramètres invalides": "Invalid parameters",
  "Plan tarifaire introuvable": "Rate plan not found",
  "Pièce jointe historique indisponible de manière sécurisée":
    "Historical attachment is no longer available securely",
  "Pièce jointe introuvable ou déjà utilisée": "Attachment not found or already used",
  "Pièce jointe non autorisée": "Attachment not allowed",
  "Pour suivre un séjour, indiquez arrivée, départ, adultes et enfants":
    "To follow a stay, provide check-in, check-out, adults and children",
  "Provider inconnu": "Unknown provider",
  "Période invalide (from/to au format YYYY-MM-DD, from ≤ to)":
    "Invalid period (from/to as YYYY-MM-DD, from ≤ to)",
  "Réservation introuvable": "Booking not found",
  "Réservation invalide": "Invalid booking",
  "Réservation non trouvée": "Booking not found",
  "Réservé aux hébergeurs": "Hosts only",
  "Si un compte existe pour cet email, un lien vous a été envoyé.":
    "If an account exists for this email, a link has been sent.",
  "Texte trop court": "Text too short",
  "Texte trop long": "Text too long",
  "Trop d'actions, réessayez plus tard": "Too many actions, try again later",
  "Trop d'ajouts, ralentissez": "Too many additions, slow down",
  "Trop d'avis publiés, réessayez plus tard": "Too many reviews published, try again later",
  "Trop d'uploads, réessayez plus tard": "Too many uploads, try again later",
  "Trop de créations de compte, réessayez plus tard": "Too many account creations, try again later",
  "Trop de demandes, réessayez plus tard": "Too many requests, try again later",
  "Trop de messages, réessayez plus tard": "Too many messages, try again later",
  "Trop de modifications, réessayez dans une minute": "Too many changes, try again in a minute",
  "Trop de modifications, réessayez plus tard": "Too many changes, try again later",
  "Trop de modérations, réessayez dans une minute": "Too many moderation actions, try again in a minute",
  "Trop de requêtes": "Too many requests",
  "Trop de tentatives": "Too many attempts",
  "Trop de tentatives de rotation, réessayez plus tard": "Too many rotation attempts, try again later",
  "Trop de tentatives, réessayez plus tard": "Too many attempts, try again later",
  "Trop de tests, réessayez plus tard": "Too many tests, try again later",
  "Un admin ne peut pas se supprimer lui-même": "An admin cannot delete themselves",
  "Un compte existe déjà avec cet email": "An account already exists with this email",
  "Un email de vérification vient de vous être envoyé.": "A verification email has just been sent.",
  "Un hôte doit sélectionner une réservation pour ouvrir une conversation":
    "A host must select a booking to open a conversation",
  "Un séjour doit compter entre 1 et 365 nuits": "A stay must be between 1 and 365 nights",
  "Une erreur est survenue": "Something went wrong",
  "Une remise en pourcentage doit être comprise entre 0 et 100":
    "A percentage discount must be between 0 and 100",
  "Valeur invalide": "Invalid value",
  "Valeur invalide ou manquante": "Invalid or missing value",
  "Valeur trop grande": "Value too large",
  "Valeur trop petite": "Value too small",
  "Veuillez vous connecter pour réserver": "Please sign in to book",
  "Votre email est déjà vérifié.": "Your email is already verified.",
  "Vous avez déjà laissé un avis pour cette réservation":
    "You have already left a review for this booking",
  "Vous avez déjà marqué cet avis comme utile": "You have already marked this review as helpful",
  "Vous ne pouvez laisser un avis qu'après un séjour terminé":
    "You can only leave a review after a completed stay",
  "Vous ne pouvez pas marquer votre propre avis comme utile":
    "You cannot mark your own review as helpful",
  "Vous ne pouvez pas vous suspendre vous-même": "You cannot suspend yourself",
  "checkIn doit être au format YYYY-MM-DD": "checkIn must be YYYY-MM-DD",
  "checkOut doit être au format YYYY-MM-DD": "checkOut must be YYYY-MM-DD",
  "conversationId requis": "conversationId is required",
  "propertyId est requis": "propertyId is required",
  "seuils doivent être strictement croissants": "thresholds must be strictly increasing",
  "wishlistId requis": "wishlistId is required",
  "Échec de l'upload": "Upload failed",
  "Échec du test provider": "Provider test failed",
  "Échec du traitement des alertes prix": "Price-alert processing failed",
  "Ancien mot de passe incorrect": "Incorrect current password",
  "Erreur bulk": "Bulk error",
  "Le tarif de la chambre est invalide": "The room rate is invalid",
  "Service momentanément en maintenance": "Service temporarily under maintenance",
  "Service en maintenance": "Service under maintenance",
  "Cette chambre n'est plus disponible pour ces dates": "This room is no longer available for these dates",
  "Le fichier n'est pas une image valide (JPEG, PNG, WebP ou GIF).":
    "The file is not a valid image (JPEG, PNG, WebP or GIF).",
  "Le nombre d'adultes est invalide": "The number of adults is invalid",
  "Le nombre d'enfants est invalide": "The number of children is invalid",
  "Code inactif": "Inactive code",
  "Code pas encore actif": "Code not yet active",
  "Code expiré": "Expired code",
  "Code épuisé": "Code exhausted",
  "Code promo inconnu": "Unknown promo code",
  "Compte introuvable": "Account not found",
  "Plan tarifaire indisponible pour cette chambre": "Rate plan unavailable for this room",
  "Connectez-vous pour réserver avec cet email": "Sign in to book with this email",
  "Activez d'abord votre accès depuis l'email de confirmation, puis connectez-vous":
    "Activate your access from the confirmation email first, then sign in",
  "La ville est requise": "City is required",
  "Ce type de promotion nécessite un calcul par nuit et n'est pas encore disponible":
    "This promotion type requires a per-night calculation and is not available yet",
};

const API_ERROR_PREFIXES: Array<[string, string]> = [
  ["Code promo : ", "Promo code: "],
  ["Wallet : ", "Wallet: "],
];

function enNoun(count: string, one: string, many: string): string {
  return count === "1" ? `1 ${one}` : `${count} ${many}`;
}

const API_ERROR_PATTERNS: Array<[RegExp, (m: RegExpMatchArray) => string]> = [
  [
    /^Le paramètre (.+) doit être un nombre positif$/,
    (m) => `The ${m[1]} parameter must be a positive number`,
  ],
  [
    /^Type non autorisé : (.+)\. Formats acceptés : JPEG, PNG, WebP, GIF\.$/,
    (m) => `Unauthorized type: ${m[1]}. Accepted formats: JPEG, PNG, WebP, GIF.`,
  ],
  [
    /^Fichier trop volumineux \((.+) MB > 5 MB\)$/,
    (m) => `File too large (${m[1]} MB > 5 MB)`,
  ],
  [
    /^Le stock journalier ne peut pas dépasser la capacité de (.+)$/,
    (m) => `Daily stock cannot exceed the capacity of ${m[1]}`,
  ],
  [/^Champ non autorisé : (.+)$/, (m) => `Unauthorized field: ${m[1]}`],
  [/^Test (.+) échoué : (.+)$/, (m) => `${m[1]} test failed: ${m[2]}`],
  [
    /^Cet hébergement exige un séjour minimum de (\d+) nuits?$/,
    (m) => `This property requires a minimum stay of ${enNoun(m[1], "night", "nights")}`,
  ],
  [
    /^Cette chambre accepte au maximum (\d+) adultes?$/,
    (m) => `This room accepts a maximum of ${enNoun(m[1], "adult", "adults")}`,
  ],
  [
    /^Cette chambre accepte au maximum (\d+) enfants?$/,
    (m) => `This room accepts a maximum of ${enNoun(m[1], "child", "children")}`,
  ],
  [
    /^Cette chambre accepte au maximum (\d+) personnes?$/,
    (m) => `This room accepts a maximum of ${enNoun(m[1], "guest", "guests")}`,
  ],
  [/^Réservation minimum (.+)$/, (m) => `Minimum booking ${m[1]}`],
  [
    /^Devise non supportée pour l'application du wallet : (.+)$/,
    (m) => `Unsupported currency for wallet application: ${m[1]}`,
  ],
  [/^Action invalide pour (\w+) : (.+)$/, (m) => `Invalid action for ${m[1]}: ${m[2]}`],
];

export function localizeApiMessage(
  fr: string,
  locale: UiLocale | string | null | undefined,
): string {
  if (locale !== "en") return fr;
  const exact = API_ERROR_EN[fr];
  if (exact) return exact;
  for (const [prefix, enPrefix] of API_ERROR_PREFIXES) {
    if (fr.startsWith(prefix)) {
      return enPrefix + localizeApiMessage(fr.slice(prefix.length), "en");
    }
  }
  for (const [re, toEn] of API_ERROR_PATTERNS) {
    const m = fr.match(re);
    if (m) return toEn(m);
  }
  return fr;
}

/** Locale UI de la requête → message d'erreur affiché. Défaut : français. */
export async function apiError(fr: string): Promise<string> {
  let locale: UiLocale = "fr";
  try {
    const { getServerLocale } = await import("@/lib/server-locale");
    locale = await getServerLocale();
  } catch {
    locale = "fr";
  }
  return localizeApiMessage(fr, locale);
}
