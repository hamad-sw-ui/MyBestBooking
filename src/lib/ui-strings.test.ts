import { describe, it, expect } from "vitest";
import { uiStrings, isUiLocale } from "./ui-strings";

describe("uiStrings (T-132)", () => {
  it("fr par défaut (y compris null/undefined/arabe non supporté)", () => {
    expect(uiStrings(null)["price.from"]).toBe("Dès");
    expect(uiStrings(undefined)["price.perNight"]).toBe("/nuit");
    expect(uiStrings("ar")["book.checkIn"]).toBe("Arrivée"); // retombe en fr
  });

  it("en traduit les libellés", () => {
    expect(uiStrings("en")["price.from"]).toBe("From");
    expect(uiStrings("en")["price.perNight"]).toBe("/night");
    expect(uiStrings("en")["book.seeAvailability"]).toBe("See availability");
    expect(uiStrings("en")["fav.add"]).toBe("Add to favorites");
    expect(uiStrings("en")["home.whyReviewTitle"]).toBe("100% verified reviews");
    expect(uiStrings("en")["book.markPaidOffline"]).toBe("Mark paid on site");
    expect(uiStrings("en")["book.paymentAwaitingHost"]).toBe("Awaiting host confirmation");
    expect(uiStrings("en")["reservation.manualRequestSent"]).toBe("📩 Request sent");
    expect(uiStrings("en")["reservation.manualRequestBody"]).toMatch(/booking request was sent to the host/i);
    expect(uiStrings("en")["reservation.manualAmountOnSite"]).toBe("Estimated stay amount");
  });

  it("isUiLocale n'accepte que fr/en", () => {
    expect(isUiLocale("fr")).toBe(true);
    expect(isUiLocale("en")).toBe(true);
    expect(isUiLocale("ar")).toBe(false);
    expect(isUiLocale(null)).toBe(false);
  });

  it("fr et en couvrent exactement les mêmes clés", () => {
    const fr = uiStrings("fr");
    const en = uiStrings("en");
    expect(Object.keys(fr).sort()).toEqual(Object.keys(en).sort());
    // T-194 (2026-09-02) : +1 clé auth.demoHint (accès démo en un clic)
    // T-195 (2026-09-06) : +2 clés billing.convertedNote + wallet.convertedNote
    //   (totaux convertis / wallet en devise d'affichage dans le dashboard).
    // T-195 (2026-09-06) : +17 clés payouts.* (section Versements du billing).
    //   1424 + 17 (payouts.*) + 11 (payout-account) + 2 (skippedCurrency, accountMissing)
    //   + 8 (billingCsv.* ledger: periodStart/End, gross, net, bookingsCount, status, paidAt, idempotencyKey) = 1462.
    // T-202 (2026-09-07) : +15 clés (validation hôte + paiement manuel) :
    //   +1 book.confirmRequest, +11 dash.* (approbation hôte), +2 host.* (gate),
    //   +1 pay.manualConfirmed = 1477.
    // T-203 (2026-09-07) : +2 clés livre (constater paiement sur place) :
    //   +1 book.markPaidOffline, +1 book.paymentAwaitingHost = 1479.
    // T-203 (2026-09-07) : +3 clés reservation manuelle (écran de confirmation) :
    //   +1 reservation.manualRequestSent, +1 reservation.manualRequestBody,
    //   +1 reservation.manualAmountOnSite = 1482.
    // T-205 (2026-09-09) : +20 clés (mode de paiement, statut hôte compte,
    //   filtres pays/types partagés, raisons audit, calendrier, soft-delete room) = 1502.
    // T-206 (2026-09-10) : +1 clé inv.unpaidNote (facture bloquée tant que non payée) = 1503.
    // T-207 (2026-09-10) : +12 clés pour la réservation sans paiement plateforme
    //   (reservation.* demande-only, host.bookingConfirmed, settings.stripeDisabled, payouts.platformDisabled*) = 1516.
    // T-215 (2026-09-10) : +8 clés dash.hostCommission* (édition du taux hôte hors
    //   approbation : édition, enregistrement, héritage, impact, propagation)
    //   +3 clés bulk.action* (libellés d'audit commission hôte/hébergement) = 1527.
    // T-216 (2026-09-10) : +5 clés bookings.* (gestion manuelle du statut dans la
    //   colonne Statut : changer, confirmer, annuler, mis à jour, indisponible),
    //   dont +1 bulk.actionBookingStatus déjà comptée ci-dessus = 1532.
    // T-217 (2026-09-10) : +27 clés (correctifs d'audit runtime) :
    //   +6 settings.* (section Avis/modération), +1 messages.draftPreview,
    //   +1 bulk.editUnit (édition d'unité en ancre), +12 promo.* (écran
    //   d'édition d'une promotion), +2 billing.receipts* (versements vs
    //   reçus), +5 bulk.* (pagination du journal d'audit) = 1559.
    // T-219 (2026-09-10) : -1 billing.exportCsv (remplacée) +2 libellés
    //   distincts billing.exportCsvPayouts / billing.exportCsvBookings = 1560.
    // T-221/T-222 (2026-09-10) : +19 clés — 6 dash.pendingRequests*/dash.settlementsDue*
  //   (cartes « Demandes à traiter » / « Règlements à constater »), 11 bulk.*
  //   (colonne Règlement, constatation, filtre, échéance de demande) et
  //   2 bookings.request* (bandeau voyageur) = 1579.
  // T-223/T-224 (audit n°2) : +22 réglages (notifications + parrainage) = 1601.
  // T-226 (audit n°2) : +16 libellés d'édition de chambre = 1617.
  //   2 cal.remaining* (stock vendable, T-244) = 1619.
  //   book.writeGuest (libellé du fil côté hôte, T-229) = 1620.
  //   T-227/T-228 (A7/A8) : +11 (horaires, fuseau, labels) = 1631.
  //   T-230/T-231 (A10/A11) : +9 (codes de secours, reset 2FA, comptes
  //   supprimés distincts des suspendus) = 1640 ; T-237 (décision de
  //   validation d'annonce notifiée à l'hôte, dont le motif affiché) = 1643 ; T-238
  //   (mention de partage wishlist + rotation) = 1645 ; T-239 (page de
  //   désabonnement) = 1655 ; T-241 (période analytics + export CSV) = 1682 ;
  //   T-249 (bandeau « tri ignoré ») = 1683 ; T-247 (dialogue de motif) = 1688 ;
  //   T-245 (fenêtre de liste) = 1693 ; T-246 (favoris multi-listes, +13) = 1706 ; T-250 (supervision cron, +22) = 1728 ;
  //   T-248 (journal wallet, +11) = 1739 ;
  //   T-258 (audit n°6, B5 : compteur, lien « voir les N avis », retour, +3) = 1742.
  //   T-259 (audit n°6, B6 : description EN, région, coordonnées, +6) = 1748 ;
  //   T-262 (audit n°6, B8 : avertissement « crédit perdu » à la suppression
  //   de compte, +1) = 1749 ; T-260 (audit n°6, B7 : tri « Populaires », note
  //   minimale, « Autour de moi », recherche libre nom/ville/description et
  //   deux avertissements de filtre ignoré, +13) = 1762 ;
  //   T-263/T-264 (audit n°6, B10/B12) = 1762 (aucune clé ajoutée) ;
  //   T-261 (audit n°6, B9 : catégories de notification réglables par
  //   l'utilisateur, +6) = 1768.
  //   T-266 (audit n°7, C2 : remboursement hors plateforme « à traiter par
  //   l'hébergeur », +1) = 1769 ; T-267 (C3 : état vide « pas de photos »,
  //   +1) = 1770.
  //   T-273 (audit n°8, F3 : finaliser le remboursement hors plateforme,
  //   +1) = 1771 ; T-275 (F5 : renvoi du claim invité, +3) = 1774.
  expect(Object.keys(fr)).toHaveLength(1774);
  });

  it("traduit les restes T-167 (langue, pays, auth, hero)", () => {
    const fr = uiStrings("fr");
    const en = uiStrings("en");
    expect(fr["account.langEn"]).toBe("Anglais");
    expect(en["account.langEn"]).toBe("English");
    expect(fr["prop.country.MA"]).toBe("Maroc");
    expect(en["prop.country.MA"]).toBe("Morocco");
    expect(fr["auth.login"]).toBe("Connexion");
    expect(en["auth.login"]).toBe("Login");
    expect(fr["home.heroTitle1"]).toBe("Réservez mieux.");
    expect(en["home.heroTitle1"]).toBe("Book better.");
    expect(fr["a11y.skipToContent"]).toBe("Aller au contenu principal");
    expect(en["a11y.skipToContent"]).toBe("Skip to main content");
  });

  it("traduit facture et placeholders réglages (T-168)", () => {
    const fr = uiStrings("fr");
    const en = uiStrings("en");
    expect(fr["inv.kindInvoice"]).toBe("FACTURE");
    expect(en["inv.kindInvoice"]).toBe("INVOICE");
    expect(fr["inv.kindReceipt"]).toMatch(/REÇU/);
    expect(en["inv.kindReceipt"]).toMatch(/RECEIPT/);
    expect(fr["settings.phBillingEmail"]).toBe("facturation@exemple.com");
    expect(en["settings.phBillingEmail"]).toBe("billing@example.com");
  });

  it("traduit le sélecteur de devise et les en-têtes CSV billing", () => {
    const fr = uiStrings("fr");
    const en = uiStrings("en");
    expect(fr["currency.displayLabel"]).toBe("Devise d'affichage");
    expect(en["currency.displayLabel"]).toBe("Display currency");
    expect(fr["currency.storageError"]).toBe("Stockage indisponible");
    expect(en["currency.storageError"]).toBe("Local storage unavailable");
    expect(fr["billingCsv.reference"]).toBe("Référence");
    expect(en["billingCsv.reference"]).toBe("Reference");
    expect(fr["billingCsv.netToHost"]).toBe("Net hôte");
    expect(en["billingCsv.netToHost"]).toBe("Host net");
    expect(fr["billingCsv.paymentStatus"]).toBe("Statut règlement");
    expect(en["billingCsv.paymentStatus"]).toBe("Settlement status");
  });
});
