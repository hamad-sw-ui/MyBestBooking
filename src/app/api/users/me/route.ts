import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { bookings, properties, users, sessions } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { zodErrorResponse } from "@/lib/http";
import { cookies } from "next/headers";
import { and, eq, inArray, ne } from "drizzle-orm";
import { DISPLAY_CURRENCIES } from "@/lib/i18n";
import { isUiLocale } from "@/lib/ui-strings";
import { isValidTimezone } from "@/lib/timezone";
import { apiError } from "@/lib/api-error";
import { assertNotMaintenance, MaintenanceError, maintenanceResponse } from "@/lib/maintenance";
import { anonymizeUserAccount, anonymizedEmailFor } from "@/lib/account-anonymization";
import { recordAccountClosureEntry } from "@/lib/wallet-ledger";
import { parseUserNotificationPrefs } from "@/lib/notification-prefs";

// T-135 — langues de l'UI réellement traduites (fr/en). L'arabe n'a pas
// de dictionnaire V1 : on le rejette ici plutôt que de stocker une
// préférence sans effet (le serveur retombe déjà sur « fr » à la lecture).
const schema = z.object({
  firstName: z.string().min(2).max(100).optional(),
  lastName: z.string().min(2).max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  country: z.string().length(2).optional().nullable(),
  language: z
    .string()
    .max(5)
    .refine((v) => isUiLocale(v), "Langue non supportée")
    .optional(),
  // Devise d'affichage : normalisée en majuscules et bornée aux devises
  // connues (RATES_FROM_EUR). Une devise inconnue (« ZZZ ») est rejetée 400.
  currency: z
    .string()
    .length(3)
    .toUpperCase()
    .refine((v) => DISPLAY_CURRENCIES.includes(v), "Devise non supportée")
    .optional(),
  // T-227 (A7) : un fuseau inventé était accepté puis stocké sans effet. On
  // n'accepte plus que la base IANA reconnue par le runtime.
  timezone: z
    .string()
    .max(50)
    .refine((v) => isValidTimezone(v), "Fuseau horaire inconnu")
    .optional(),
  avatarUrl: z.string().url().max(500).optional().nullable(),
  // T-030 : préférence user
  priceAlertEnabled: z.boolean().optional(),
  // T-261 (audit n°6, B9) : préférences par catégorie. `null` efface le
  // réglage (retour à l'héritage du global) ; objet partiel strict — une clé
  // inconnue est refusée en 400 plutôt que stockée sans effet.
  notificationPrefs: z
    .object({
      stayReminders: z.boolean().optional(),
      reviewRequests: z.boolean().optional(),
      moderationDecisions: z.boolean().optional(),
    })
    .strict()
    .nullable()
    .optional(),
}).strict()

/**
 * PATCH /api/users/me (T-016)
 * Édite le profil courant. Interdit : email, role, passwordHash,
 * bestrewardsLevel, walletBalance, emailVerified (gérés par flows dédiés).
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
    await assertNotMaintenance(user);

    const data = schema.parse(await request.json());
    const [updated] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, user.id))
      .returning();

    return NextResponse.json({
      user: {
        id: updated.id,
        email: updated.email,
        firstName: updated.firstName,
        lastName: updated.lastName,
        phone: updated.phone,
        country: updated.country,
        language: updated.language,
        currency: updated.currency,
        timezone: updated.timezone,
        avatarUrl: updated.avatarUrl,
        // BUG-017 (T-032, Session 11) : exposer les préférences que la
        // route PATCH accepte, sinon l'UI ne peut pas confirmer le
        // toggle sans recharger. Détecté par scripts/deep_sim.py.
        priceAlertEnabled: updated.priceAlertEnabled,
        twoFactorEnabled: updated.twoFactorEnabled,
        // T-261 : renvoyé normalisé (clés connues seulement) pour que l'UI
        // confirme l'enregistrement sans recharger, comme `priceAlertEnabled`.
        notificationPrefs: parseUserNotificationPrefs(updated.notificationPrefs),
      },
    });
  } catch (error) {
    if (error instanceof MaintenanceError) return maintenanceResponse(error.retryAfterSeconds);
    // T-120 (D1) : corps JSON vide/mal formé → SyntaxError à request.json() → 400 (pas 500).
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: await apiError("Corps de requête invalide ou manquant (JSON attendu)") }, { status: 400 });
    }
    if (error instanceof z.ZodError) return zodErrorResponse(error);
    console.error("users/me PATCH error:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}

/**
 * DELETE /api/users/me (T-027)
 * Soft-delete du compte : deletedAt=now + révoque sessions + supprime
 * le cookie. Pas de hard-delete pour préserver la traçabilité
 * (bookings historiques, avis, etc.).
 * Un admin ne peut pas se supprimer via cet endpoint (il doit passer
 * par un autre admin).
 */
export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: await apiError("Non autorisé") }, { status: 401 });
    await assertNotMaintenance(user);
    if (user.role === "admin") {
      return NextResponse.json(
        { error: await apiError("Un admin ne peut pas se supprimer lui-même") },
        { status: 400 },
      );
    }

    // T-206/F10 : empêcher une suppression qui laisserait des obligations
    // opérationnelles orphelines (séjours client actifs ou annonces hôte non
    // archivées). Le soft-delete RGPD reste disponible dès que l'utilisateur a
    // annulé/terminé ses réservations et archivé/transféré ses hébergements.
    const [activeCustomerBooking] = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(and(eq(bookings.userId, user.id), inArray(bookings.status, ["pending", "confirmed"])))
      .limit(1);
    if (activeCustomerBooking) {
      return NextResponse.json(
        { error: await apiError("Impossible de supprimer le compte tant qu'une réservation est en attente ou confirmée") },
        { status: 409 },
      );
    }

    if (user.role === "host") {
      const [activeProperty] = await db
        .select({ id: properties.id })
        .from(properties)
        .where(and(eq(properties.hostId, user.id), ne(properties.status, "archived")))
        .limit(1);
      if (activeProperty) {
        return NextResponse.json(
          { error: await apiError("Archivez ou transférez vos hébergements avant de supprimer votre compte") },
          { status: 409 },
        );
      }
      const [activeHostBooking] = await db
        .select({ id: bookings.id })
        .from(bookings)
        .innerJoin(properties, eq(bookings.propertyId, properties.id))
        .where(and(eq(properties.hostId, user.id), inArray(bookings.status, ["pending", "confirmed"])))
        .limit(1);
      if (activeHostBooking) {
        return NextResponse.json(
          { error: await apiError("Impossible de supprimer le compte tant que vos hébergements ont des réservations actives") },
          { status: 409 },
        );
      }
    }

    // BUG-025 (Session 11 quinquies) : RGPD — anonymiser les données
    // personnelles au soft-delete. On garde l'ID (FK bookings/reviews)
    // mais on hash l'email et on efface firstName/lastName/phone.
    // Format hashé : "deleted-<sha256(email)[:16]>@anonymized.local"
    // → adresse non déchiffrable mais unique et déterministe.
    //
    // T-242 (audit n°4) : l'effacement couvre désormais **toutes** les copies
    // de l'identité (réservations, historique d'e-mails, journal d'audit) et
    // non plus la seule table `users` — sans toucher aux agrégats comptables.
    const anonymizedEmail = anonymizedEmailFor(user.email);
    // T-262 (audit n°6, B8) : un solde de crédit gelé (T-248 §3) restait
    // attaché à une ligne anonymisée sans laisser aucune trace. On journalise
    // la clôture **dans la même transaction** — montant 0, solde inchangé
    // (aucune consommation, conformément au gel).
    const walletBalance = Number(user.walletBalance ?? 0);
    await db.transaction(async (tx) => {
      await anonymizeUserAccount(tx, {
        userId: user.id,
        originalEmail: user.email,
        anonymizedEmail,
      });
      if (Number.isFinite(walletBalance) && walletBalance > 0) {
        await recordAccountClosureEntry(tx, { userId: user.id, balance: walletBalance });
      }
    });
    const jar = await cookies();
    jar.delete("session");
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof MaintenanceError) return maintenanceResponse(error.retryAfterSeconds);
    console.error("users/me DELETE error:", error);
    return NextResponse.json({ error: await apiError("Une erreur est survenue") }, { status: 500 });
  }
}
