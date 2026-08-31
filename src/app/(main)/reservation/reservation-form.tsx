"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PromoCodeInput } from "@/components/promo-code-input";
import { useDisplayPreferences } from "@/lib/use-display-currency";
import { makeT, isUiLocale } from "@/lib/ui-strings";
// T-154c (audit n°26, P2-5) : libellé d'annulation dérivé de la politique
// réelle du bien (+ grille serveur), plus jamais « gratuit » en dur.
import { cancellationPolicyLabel } from "@/lib/cancellation-label";
import { formatPrice } from "@/lib/utils";
import { applyWalletToTotal } from "@/lib/wallet-currency";
import { StripePaymentForm } from "@/components/stripe-payment-form";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, ArrowRight, Check, Shield, Lock, MapPin,
  Calendar, Users, Clock, CheckCircle, Star
} from "lucide-react";
import Link from "next/link";
import { readReservationParams } from "@/lib/reservation-url";

interface PropertyData {
  id: string;
  name: string;
  slug: string;
  city: string;
  country: string;
  mainImage: string | null;
  starRating: number | null;
  averageRating: string | null;
  // T-154c (audit n°26, P2-5) : politique d'annulation réelle du bien
  // (retournée par GET /api/properties/[id]) pour le libellé exact.
  cancellationPolicy: string | null;
  // T-154d (audit n°26, P2-4) : taux de TVA configuré + réduction
  // BestRewards réelle pour le user courant (read-only, additif API).
  taxRate?: number | null;
  bestrewardsDiscountPercent?: number | null;
  totalReviews: number | null;
  checkInFrom: string | null;
  checkOutUntil: string | null;
}

interface RatePlanData {
  id: string;
  roomId: string;
  name: string;
  type: string;
  discountPercentage: string;
  includesBreakfast: boolean | null;
  cancellationPolicy: string;
}

interface RoomData {
  id: string;
  name: string;
  roomType: string;
  maxOccupancy: number;
  maxAdults: number;
  maxChildren: number | null;
  basePrice: string;
  sizeSqm: string | null;
  amenities: string[];
  // T-152 (B) : devise réelle de la chambre — l'API la renvoie depuis
  // `rooms.currency` ; sans elle on afficherait « € » sur une chambre USD.
  currency?: string;
}

function ReservationPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Lecture temporaire des paramètres legacy propertyId/roomId afin que les
  // liens déjà générés ne cassent pas pendant la migration de convention.
  const reservationParams = readReservationParams(searchParams);
  // T-152 (A) : reprise d'un paiement depuis /mes-reservations via
  // ?booking=<id> (aucune nouvelle réservation : reprise propriétaire).
  const bookingParam = searchParams.get("booking");
  const [loaded, setLoaded] = useState<{ propertyId: string | null; roomId: string | null }>({
    propertyId: reservationParams?.propertyId ?? null,
    roomId: reservationParams?.roomId ?? null,
  });
  const propertyId = loaded.propertyId;
  const roomId = loaded.roomId;

  const [step, setStep] = useState(1);
  const { language } = useDisplayPreferences();
  const t = makeT(language);
  // Refs pour garder des valeurs récentes dans les effets sans les
  // re-déclencher (pas de dépendance instable dans les deps). Mises à jour
  // dans un effet (jamais pendant le rendu — règle react-hooks/refs).
  const tRef = useRef(t);
  const resumeLoadedRef = useRef(false);
  const resumeStartedRef = useRef(false);
  const resumedBookingRef = useRef<string | null>(null);
  const resumePaymentRef = useRef<(bookingId: string) => Promise<void>>(async () => {});

  useEffect(() => {
    tRef.current = t;
    // `resumePaymentFor` est déclarée plus bas mais hissée (function
    // declaration) : la ref est prête avant l'exécution de tout effet.
    resumePaymentRef.current = resumePaymentFor;
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [ratePlans, setRatePlans] = useState<RatePlanData[]>([]);
  const [confirmation, setConfirmation] = useState<{ bookingReference: string; total: string; paymentPending?: boolean; mockPayment?: boolean } | null>(null);
  const [pendingStripePayment, setPendingStripePayment] = useState<{ bookingId: string; bookingReference: string; total: string; clientSecret: string } | null>(null);
  const [resumeBookingId, setResumeBookingId] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ code: string; discount: number; finalTotal: number } | null>(null);
  // T-030 : wallet + guest booking
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [useWalletCredits, setUseWalletCredits] = useState<boolean>(false);
  const [isAuthed, setIsAuthed] = useState<boolean>(true);
  const [guestMode, setGuestMode] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    checkIn: reservationParams?.checkIn || "",
    checkOut: reservationParams?.checkOut || "",
    numAdults: reservationParams?.numAdults || 2,
    numChildren: reservationParams?.numChildren || 0,
    guestFirstName: "",
    guestLastName: "",
    guestEmail: "",
    guestPhone: "",
    guestCountry: "FR",
    tripPurpose: "",
    specialRequests: "",
    estimatedArrival: "",
    ratePlanId: searchParams.get("ratePlan") || "",
  });

  // Calculate pricing
  const pricePerNight = room ? parseFloat(room.basePrice) : 0;
  const checkInDate = formData.checkIn ? new Date(formData.checkIn) : null;
  const checkOutDate = formData.checkOut ? new Date(formData.checkOut) : null;
  const numNights = checkInDate && checkOutDate
    ? Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const baseSubtotal = pricePerNight * numNights;
  const selectedRatePlan = ratePlans.find((plan) => plan.id === formData.ratePlanId) ?? null;
  const ratePlanDiscount = selectedRatePlan ? baseSubtotal * (parseFloat(selectedRatePlan.discountPercentage || "0") / 100) : 0;
  const subtotal = Math.max(0, baseSubtotal - ratePlanDiscount);
  // T-154d (audit n°26, P2-4) : TVA réelle (settings billing.taxRate, défaut
  // historique 0.1) — avant : 0.1 en dur, divergence dès qu'un admin ajuste.
  const taxes = subtotal * (property?.taxRate ?? 0.1);
  const totalBeforePromo = subtotal + taxes;
  const totalAfterPromo = promo ? promo.finalTotal : totalBeforePromo;
  // Même règle que POST /api/bookings : la remise BestRewards s'applique
  // APRÈS la promo, sur le total (arrondi au centime).
  const bestrewardsPercent = property?.bestrewardsDiscountPercent ?? 0;
  const bestrewardsAmount = bestrewardsPercent > 0
    ? Math.round(totalAfterPromo * (bestrewardsPercent / 100) * 100) / 100
    : 0;
  const total = Math.max(0, totalAfterPromo - bestrewardsAmount);
  // T-152 (B) : devise réelle de la chambre pour TOUS les montants affichés
  // (le débit PSP utilise room.currency — voir POST /api/bookings).
  const roomCurrency = room?.currency ?? "EUR";
  // T-153 (A) : aperçu exact du débit wallet (libellé EUR) appliqué à un
  // total en devise chambre — mêmes règles que POST /api/bookings.
  const walletApplied =
    useWalletCredits && walletBalance > 0
      ? applyWalletToTotal(walletBalance, total, roomCurrency)
      : { walletUsed: 0, walletUsedEur: 0, totalAfter: total };
  const walletDisplay =
    "error" in walletApplied ? { walletUsed: 0, walletUsedEur: 0, totalAfter: total } : walletApplied;

  // T-152 (A) : reprise de paiement — charge la réservation, pré-remplit la
  // sélection, puis relance `POST /api/bookings/:id/payment` (déjà existant).
  useEffect(() => {
    if (!bookingParam || resumeLoadedRef.current) return;
    resumeLoadedRef.current = true;
    (async () => {
      try {
        const response = await fetch(`/api/bookings/${bookingParam}`, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(data?.error ?? tRef.current("reservation.resumeError"));
          setLoading(false);
          return;
        }
        const booking = data?.booking;
        if (!booking) {
          setError(tRef.current("reservation.resumeError"));
          setLoading(false);
          return;
        }
        // Garde : une résa déjà confirmée/annulée n'a pas à être reprise.
        if (booking.status === "confirmed") {
          setError(tRef.current("reservation.alreadyConfirmed"));
          setLoading(false);
          return;
        }
        if (booking.status !== "pending" || booking.paymentStatus !== "pending") {
          setError(tRef.current("reservation.cannotResume"));
          setLoading(false);
          return;
        }
        setResumeBookingId(booking.id);
        resumedBookingRef.current = booking.id;
        setLoaded({ propertyId: booking.propertyId, roomId: booking.roomId });
        setFormData((previous) => ({
          ...previous,
          checkIn: booking.checkIn,
          checkOut: booking.checkOut,
          numAdults: booking.numAdults,
          numChildren: booking.numChildren ?? 0,
          ratePlanId: booking.ratePlanId ?? previous.ratePlanId,
        }));
      } catch {
        setError(tRef.current("reservation.resumeError"));
        setLoading(false);
      }
    })();
    // Dépendances volontairement limitées à `bookingParam` : toutes les
    // valeurs récentes passent par des refs (tRef, resumedBookingRef).
  }, [bookingParam]);

  useEffect(() => {
    if (!propertyId || !roomId) return;

    fetch(`/api/properties/${propertyId}`)
      .then(res => res.json())
      .then(data => {
        if (data.property) {
          setProperty(data.property);
          const foundRoom = data.rooms?.find((r: RoomData) => r.id === roomId);
          if (foundRoom) {
            setRoom(foundRoom);
            const roomPlans = (data.ratePlans ?? []).filter((plan: RatePlanData) => plan.roomId === foundRoom.id);
            setRatePlans(roomPlans);
            setFormData((previous) => ({
              ...previous,
              ratePlanId: roomPlans.some((plan: RatePlanData) => plan.id === previous.ratePlanId) ? previous.ratePlanId : "",
            }));
            // Le formulaire ne propose plus un nombre de voyageurs au-delà
            // de la chambre ; l'API reste la validation définitive.
            setFormData((previous) => ({
              ...previous,
              numAdults: Math.min(Math.max(1, previous.numAdults), foundRoom.maxAdults),
              numChildren: Math.min(
                previous.numChildren,
                foundRoom.maxChildren ?? 0,
                Math.max(0, foundRoom.maxOccupancy - Math.min(Math.max(1, previous.numAdults), foundRoom.maxAdults)),
              ),
            }));
          }
        }
        setLoading(false);
        // T-152 (A) : une fois la fiche chargée, relance le paiement de la
        // réservation reprise (une seule fois — resumeStartedRef).
        if (resumedBookingRef.current && !resumeStartedRef.current) {
          resumeStartedRef.current = true;
          resumePaymentRef.current(resumedBookingRef.current);
        }
      });

    // T-030 : pré-remplir si connecté, sinon proposer mode invité.
    fetch("/api/auth/me")
      .then(res => (res.ok ? res.json() : { user: null }))
      .then(data => {
        if (data?.user) {
          setIsAuthed(true);
          setFormData(prev => ({
            ...prev,
            guestFirstName: data.user.firstName || "",
            guestLastName: data.user.lastName || "",
            guestEmail: data.user.email || "",
            guestPhone: data.user.phone || "",
            guestCountry: data.user.country || "FR",
          }));
          const wb = parseFloat(data.user.walletBalance ?? "0");
          if (Number.isFinite(wb) && wb > 0) setWalletBalance(wb);
        } else {
          // Non connecté : passe en guest mode par défaut plutôt que de bloquer.
          setIsAuthed(false);
          setGuestMode(true);
        }
      });
  }, [propertyId, roomId, router]);

  const handleSubmit = async () => {
    if (!property || !room) return;
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: property.id,
          roomId: room.id,
          checkIn: formData.checkIn,
          checkOut: formData.checkOut,
          numAdults: formData.numAdults,
          numChildren: formData.numChildren,
          guestFirstName: formData.guestFirstName,
          guestLastName: formData.guestLastName,
          guestEmail: formData.guestEmail,
          guestPhone: formData.guestPhone,
          guestCountry: formData.guestCountry,
          tripPurpose: formData.tripPurpose || undefined,
          specialRequests: formData.specialRequests || undefined,
          estimatedArrival: formData.estimatedArrival || undefined,
          promoCode: promo?.code || undefined,
          ratePlanId: formData.ratePlanId || undefined,
          useWalletCredits: useWalletCredits || undefined,
          isGuestBooking: guestMode || undefined,
          // T-151 : langue de l'invité → l'e-mail de réclamation de compte
          // est localisé pour lui (le profil invité la persiste).
          ...(language && isUiLocale(language) ? { language } : {}),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        // Le hold est durable : ne pas demander au voyageur de recréer une
        // réservation qui occupe déjà le stock. Un compte connecté peut ouvrir
        // le même intent; un invité reçoit le lien de claim dans son email.
        if (response.status === 503 && data.booking?.id) {
          setConfirmation({ bookingReference: data.booking.bookingReference, total: data.booking.total, paymentPending: true });
          setResumeBookingId(data.booking.id);
          setStep(4);
        } else {
          setError(data.error || t("reservation.bookingError"));
        }
        setSubmitting(false);
        return;
      }

      if (data.payment?.requiresConfirmation && data.payment.clientSecret) {
        setPendingStripePayment({
          bookingId: data.booking.id,
          bookingReference: data.booking.bookingReference,
          total: data.booking.total,
          clientSecret: data.payment.clientSecret,
        });
        setSubmitting(false);
        return;
      }

      setConfirmation({
        bookingReference: data.booking.bookingReference,
        total: data.booking.total,
        mockPayment: data.payment?.provider === "mock",
      });
      setStep(4);
    } catch {
      setError("Une erreur est survenue");
    }
    setSubmitting(false);
  };

  // T-152 (A) : reprise de paiement paramétrée (bouton manuel « Reprendre »
  // et reprise automatique depuis /reservation?booking=<id>).
  async function resumePaymentFor(bookingId: string) {
    setSubmitting(true); setError("");
    try {
      const response = await fetch(`/api/bookings/${bookingId}/payment`, { method: "POST", headers: { "content-type": "application/json" } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Impossible de reprendre le paiement");
      if (data.payment?.requiresConfirmation && data.payment.clientSecret) {
        setPendingStripePayment({ bookingId: data.booking.id, bookingReference: data.booking.bookingReference, total: data.booking.total, clientSecret: data.payment.clientSecret });
        setResumeBookingId(null); setStep(3); return;
      }
      if (data.booking?.status === "confirmed") {
        setConfirmation({ bookingReference: data.booking.bookingReference, total: data.booking.total });
        setResumeBookingId(null); return;
      }
      throw new Error(t("reservation.paymentPendingRetry"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Erreur"); }
    finally { setSubmitting(false); }
  }

  async function resumePayment() {
    if (!resumeBookingId) return;
    return resumePaymentFor(resumeBookingId);
  }

  async function waitForStripeConfirmation() {
    if (!pendingStripePayment) return;
    setSubmitting(true);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await fetch(`/api/bookings/${pendingStripePayment.bookingId}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.booking?.status === "confirmed" && data.booking?.paymentStatus === "paid") {
        setConfirmation({ bookingReference: pendingStripePayment.bookingReference, total: pendingStripePayment.total });
        setPendingStripePayment(null);
        setStep(4);
        setSubmitting(false);
        return;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 800));
    }
    setConfirmation({
      bookingReference: pendingStripePayment.bookingReference,
      total: pendingStripePayment.total,
      paymentPending: true,
    });
    setPendingStripePayment(null);
    setStep(4);
    setSubmitting(false);
  }

  if (!propertyId || !roomId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-12">
            {error ? (
              <>
                <p className="text-gray-700 mb-4">{error}</p>
                <Link href="/mes-reservations">
                  <Button variant="outline">{t("reservation.seeBookings")}</Button>
                </Link>
              </>
            ) : (
              <>
                <p className="text-gray-500 mb-4">{t("reservation.missingInfo")}</p>
                <Link href="/recherche">
                  <Button>{t("footer.searchAccommodation")}</Button>
                </Link>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B3A6B]"></div>
      </div>
    );
  }

  const steps = [
    { num: 1, label: t("reservation.stepSelection") },
    { num: 2, label: t("reservation.stepInfo") },
    { num: 3, label: t("reservation.stepPayment") },
    { num: 4, label: t("reservation.stepDone") },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {steps.map((s, i) => (
              <div key={s.num} className="flex items-center">
                <div className={`flex items-center gap-2 ${i > 0 ? "ml-2" : ""}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    step > s.num ? "bg-[#00A699] text-white" :
                    step === s.num ? "bg-[#1B3A6B] text-white" :
                    "bg-gray-200 text-gray-500"
                  }`}>
                    {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                  </div>
                  <span className={`text-sm font-medium hidden sm:inline ${
                    step >= s.num ? "text-gray-900" : "text-gray-400"
                  }`}>
                    {s.label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`w-8 sm:w-16 h-0.5 mx-2 ${
                    step > s.num ? "bg-[#00A699]" : "bg-gray-200"
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Step 1: Selection */}
            {step === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("reservation.yourSelection")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      type="date"
                      label={t("reservation.checkInDate")}
                      value={formData.checkIn}
                      onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })}
                      required
                    />
                    <Input
                      type="date"
                      label={t("reservation.checkOutDate")}
                      value={formData.checkOut}
                      onChange={(e) => setFormData({ ...formData, checkOut: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("reservation.adults")}</label>
                      <select
                        value={formData.numAdults}
                        onChange={(e) => setFormData({ ...formData, numAdults: parseInt(e.target.value) })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                      >
                        {Array.from({ length: room?.maxAdults ?? 1 }, (_, index) => index + 1).map(n => <option key={n} value={n}>{t(n > 1 ? "reservation.adultsOptionPlural" : "reservation.adultsOption").replace("{n}", String(n))}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("reservation.children")}</label>
                      <select
                        value={formData.numChildren}
                        onChange={(e) => setFormData({ ...formData, numChildren: parseInt(e.target.value) })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                      >
                        {Array.from({ length: Math.min(room?.maxChildren ?? 0, Math.max(0, (room?.maxOccupancy ?? 1) - formData.numAdults)) + 1 }, (_, index) => index).map(n => <option key={n} value={n}>{t(n > 1 ? "reservation.childrenOptionPlural" : "reservation.childrenOption").replace("{n}", String(n))}</option>)}
                      </select>
                    </div>
                  </div>
                  {ratePlans.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("reservation.ratePlan")}</label>
                      <select value={formData.ratePlanId} onChange={(event) => setFormData({ ...formData, ratePlanId: event.target.value })} className="w-full px-4 py-2.5 border border-gray-300 rounded-lg">
                        <option value="">{t("reservation.standardRate")}</option>
                        {ratePlans.map((plan) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name}{Number(plan.discountPercentage) > 0 ? ` — -${plan.discountPercentage}%` : ""}{plan.includesBreakfast ? t("reservation.breakfastIncluded") : ""}
                          </option>
                        ))}
                      </select>
                      {selectedRatePlan && <p className="mt-1 text-xs text-gray-500">{t("reservation.policyPrefix").replace("{policy}", selectedRatePlan.cancellationPolicy)}{selectedRatePlan.includesBreakfast ? t("reservation.breakfastIncludedCaps") : ""}</p>}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex justify-end">
                  <Button onClick={() => setStep(2)} disabled={!formData.checkIn || !formData.checkOut || numNights <= 0}>
                    {t("reservation.continue")} <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardFooter>
              </Card>
            )}

            {/* Step 2: Guest Info */}
            {step === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("reservation.yourInfo")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {isAuthed && (
                    // T-157 (audit n°29) : compte connecté → identité du
                    // compte en lecture seule (le serveur est l'autorité ;
                    // aucune confirmation ne peut partir vers un tiers).
                    <p className="text-sm bg-blue-50 text-[#1B3A6B] border border-blue-100 rounded-lg p-3">
                      ✓ {t("reservation.bookedAs")} <strong>{formData.guestFirstName} {formData.guestLastName}</strong> · {formData.guestEmail}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label={t("reservation.firstName")}
                      value={formData.guestFirstName}
                      onChange={(e) => setFormData({ ...formData, guestFirstName: e.target.value })}
                      required
                      readOnly={isAuthed}
                      disabled={isAuthed}
                    />
                    <Input
                      label={t("reservation.lastName")}
                      value={formData.guestLastName}
                      onChange={(e) => setFormData({ ...formData, guestLastName: e.target.value })}
                      required
                      readOnly={isAuthed}
                      disabled={isAuthed}
                    />
                  </div>
                  <Input
                    type="email"
                    label={t("reservation.email")}
                    value={formData.guestEmail}
                    onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
                    required
                    readOnly={isAuthed}
                    disabled={isAuthed}
                  />
                  <Input
                    label={t("reservation.phone")}
                    value={formData.guestPhone}
                    onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
                    placeholder="+33 6 00 00 00 00"
                    readOnly={isAuthed}
                    disabled={isAuthed}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      label={t("reservation.residenceCountry")}
                      options={[
                        { value: "FR", label: "France" },
                        { value: "MA", label: "Maroc" },
                        { value: "TN", label: "Tunisie" },
                        { value: "ES", label: "Espagne" },
                        { value: "IT", label: "Italie" },
                        { value: "DE", label: "Allemagne" },
                        { value: "GB", label: "Royaume-Uni" },
                        { value: "US", label: t("reservation.unitedStates") },
                      ]}
                      value={formData.guestCountry}
                      onChange={(e) => setFormData({ ...formData, guestCountry: e.target.value })}
                      disabled={isAuthed}
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t("reservation.arrivalTime")}</label>
                      <select
                        value={formData.estimatedArrival}
                        onChange={(e) => setFormData({ ...formData, estimatedArrival: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                      >
                        <option value="">{t("reservation.unspecified")}</option>
                        {Array.from({length: 24}, (_, i) => (
                          <option key={i} value={`${String(i).padStart(2,'0')}:00`}>
                            {String(i).padStart(2,'0')}:00
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Textarea
                    label={t("reservation.specialRequests")}
                    placeholder={t("reservation.specialRequestsPlaceholder")}
                    value={formData.specialRequests}
                    onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
                    rows={3}
                  />
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="ghost" onClick={() => setStep(1)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> {t("action.back")}
                  </Button>
                  <Button
                    onClick={() => setStep(3)}
                    disabled={!formData.guestFirstName || !formData.guestLastName || !formData.guestEmail}
                  >
                    {t("reservation.continue")} <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardFooter>
              </Card>
            )}

            {/* Step 3: Payment */}
            {step === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="w-5 h-5 text-[#00A699]" />
                    {t("reservation.securePayment")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {pendingStripePayment ? (
                    <>
                      <p className="text-sm text-gray-600">
                        Finalisez le paiement auprès de Stripe. Les moyens proposés sont ceux réellement activés pour cet établissement.
                      </p>
                      <StripePaymentForm clientSecret={pendingStripePayment.clientSecret} onSubmitted={waitForStripeConfirmation} />
                    </>
                  ) : (
                    <>
                      <div className="p-4 rounded-lg bg-gray-50 text-sm text-gray-700">
                        <p className="font-medium text-gray-900">{t("reservation.securePaymentTitle")}</p>
                        <p className="mt-1">{t("reservation.securePaymentBody")}</p>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg text-sm text-green-800">
                        <Shield className="w-5 h-5 text-green-600 flex-shrink-0" />
                        <span>{t("reservation.confirmAfterPayment")}</span>
                      </div>
                    </>
                  )}
                </CardContent>
                {!pendingStripePayment && (
                  <CardFooter className="flex justify-between">
                    <Button variant="ghost" onClick={() => setStep(2)}>
                      <ArrowLeft className="w-4 h-4 mr-2" /> {t("action.back")}
                    </Button>
                    <Button onClick={handleSubmit} loading={submitting} size="lg" variant="secondary">
                      <Lock className="w-4 h-4 mr-2" />
                      {t("reservation.continuePayment")} {total > 0 ? formatPrice(total, roomCurrency) : ""}
                    </Button>
                  </CardFooter>
                )}
              </Card>
            )}

            {/* Step 4: Confirmation */}
            {step === 4 && confirmation && (
              <Card className="text-center">
                <CardContent className="py-12">
                  <div className={`w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center ${confirmation.paymentPending ? "bg-amber-500" : "bg-[#00A699]"}`}>
                    {confirmation.paymentPending ? <Clock className="w-10 h-10 text-white" /> : <CheckCircle className="w-10 h-10 text-white" />}
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    {confirmation.paymentPending ? t("reservation.paymentConfirming") : t("reservation.confirmed")}
                  </h2>
                  <p className="text-gray-600 mb-6">
                    {confirmation.paymentPending
                      ? t("reservation.paymentTransmitted")
                      : `Merci ${formData.guestFirstName} ! Votre réservation est confirmée.`}
                  </p>

                  <div className="inline-block p-6 bg-gray-50 rounded-xl mb-6">
                    <p className="text-sm text-gray-500 mb-1">{t("reservation.refLabel")}</p>
                    <p className="text-2xl font-mono font-bold text-[#1B3A6B]">{confirmation.bookingReference}</p>
                    <div className="mt-4 space-y-1 text-sm text-gray-600">
                      <p>🏨 {property?.name}, {property?.city}</p>
                      <p>📅 {formData.checkIn} → {formData.checkOut}</p>
                      <p>💰 {confirmation.paymentPending ? t("reservation.amountToConfirm") : t("reservation.totalPaid")} : {formatPrice(confirmation.total, roomCurrency)} {t("reservation.allInclusive")}</p>
                    </div>
                  </div>

                  <p className="text-sm text-gray-500 mb-3">
                    {confirmation.paymentPending
                      ? t("reservation.confirmationEmail")
                      : `📧 Confirmation envoyée à ${formData.guestEmail}`}
                  </p>
                  {confirmation.mockPayment && (
                    <p className="text-xs text-amber-800 mb-6 p-3 rounded-lg bg-amber-50">{t("reservation.demoMode")}</p>
                  )}

                  {resumeBookingId && (
                    <div className="mb-5">
                      {isAuthed ? <Button onClick={resumePayment} loading={submitting}>{t("reservation.resumePayment")}</Button> : <p className="text-sm text-amber-800 bg-amber-50 p-3 rounded-lg">{t("reservation.activateAccess")}</p>}
                      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
                    </div>
                  )}
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link href="/mes-reservations">
                      <Button>{t("reservation.viewBookings")}</Button>
                    </Link>
                    <Link href="/">
                      <Button variant="outline">{t("reservation.backHome")}</Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar - Recap */}
          {step < 4 && (
            <div>
              <Card className="sticky top-24">
                <CardContent>
                  {/* Property info */}
                  {property?.mainImage && (
                    <img
                      src={property.mainImage}
                      alt={property.name}
                      className="w-full h-32 object-cover rounded-lg mb-4"
                    />
                  )}
                  <h3 className="font-semibold text-gray-900">
                    {property?.name}
                    {property?.starRating && (
                      <span className="ml-1 text-[#F5A623]">{"★".repeat(property.starRating)}</span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {property?.city}, {property?.country}
                  </p>
                  {property?.averageRating && (
                    <div className="flex items-center gap-1 mt-2">
                      <Star className="w-4 h-4 text-[#F5A623] fill-current" />
                      <span className="text-sm font-medium">{parseFloat(property.averageRating).toFixed(1)}</span>
                      <span className="text-xs text-gray-500">{t("card.reviewsCount").replace("{n}", String(property.totalReviews ?? 0))}</span>
                    </div>
                  )}

                  <hr className="my-4" />

                  {/* Room */}
                  <p className="text-sm text-gray-500">{t("reservation.roomLabel")}</p>
                  <p className="font-medium">{room?.name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    <Users className="w-3.5 h-3.5 inline mr-1" />
                    {room?.maxOccupancy} pers. max
                    {room?.sizeSqm && ` • ${room.sizeSqm} m²`}
                  </p>

                  <hr className="my-4" />

                  {/* Dates */}
                  {numNights > 0 && (
                    <>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">
                          {numNights} nuit{numNights > 1 ? "s" : ""} × {formatPrice(pricePerNight, roomCurrency)}
                        </span>
                        {/* T-146 : on affiche ici le sous-total de BASE (nuits × tarif),
                            puis la remise du tarif choisi sur la ligne verte. Auparavant
                            on affichait `subtotal` (déjà remisé) : la remise était alors
                            comptée deux fois dans le détail, même si le Total final et le
                            calcul serveur restaient justes. */}
                        <span>{formatPrice(baseSubtotal, roomCurrency)}</span>
                      </div>
                      {selectedRatePlan && (
                        <div className="flex justify-between text-sm mb-2 text-green-700">
                          <span>{selectedRatePlan.name}</span>
                          <span>−{formatPrice(ratePlanDiscount, roomCurrency)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">{t("reservation.taxesFees")}</span>
                        <span>{formatPrice(taxes, roomCurrency)}</span>
                      </div>
                      {promo && (
                        <div className="flex justify-between text-sm mb-2 text-green-700">
                          <span>{t("reservation.promoCode").replace("{code}", promo.code)}</span>
                          <span>−{formatPrice(promo.discount, roomCurrency)}</span>
                        </div>
                      )}
                      <div className="my-3">
                        <PromoCodeInput amount={totalBeforePromo} currency={roomCurrency} onApplied={setPromo} />
                      </div>
                      {/* T-154d (audit n°26, P2-4) : réduction BestRewards réelle
                          du user (GET /api/properties/[id] — read-only). Avant :
                          le récap n'en parlait pas, le serveur l'appliquait
                          quand même (261,07 affiché pour 221,91 facturés). */}
                      {bestrewardsAmount > 0 && (
                        <div className="flex justify-between text-sm mb-2 text-emerald-700">
                          <span>💎 BestRewards ({bestrewardsPercent} %)</span>
                          <span>−{formatPrice(bestrewardsAmount, roomCurrency)}</span>
                        </div>
                      )}
                      {/* T-030 : wallet BestRewards utilisable au checkout */}
                      {isAuthed && walletBalance > 0 && (
                        <label className="flex items-start gap-2 my-3 p-2 rounded-lg bg-amber-50 border border-amber-200 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={useWalletCredits}
                            onChange={(e) => setUseWalletCredits(e.target.checked)}
                            className="mt-1"
                          />
                          <div className="text-xs">
                            <p className="font-medium text-amber-900">
                              💰 {t("reservation.walletAvailable")} ({formatPrice(walletBalance, "EUR")} {t("reservation.walletAvail")})
                            </p>
                            <p className="text-amber-700">
                              {t("reservation.walletReductionNote")}
                            </p>
                          </div>
                        </label>
                      )}
                      {promo && useWalletCredits && walletBalance > 0 && (
                        <div className="flex justify-between text-sm mb-2 text-amber-800">
                          <span>{t("reservation.walletLabel")}</span>
                          <span>−{formatPrice(walletDisplay.walletUsed, roomCurrency)}</span>
                        </div>
                      )}
                      <hr className="my-3" />
                      <div className="flex justify-between font-bold text-lg">
                        <span>{t("reservation.totalLabel")}</span>
                        <span className="text-[#1B3A6B]">
                          {formatPrice(walletDisplay.totalAfter, roomCurrency)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        ✅ Aucun frais supplémentaire
                      </p>
                      {/* T-030 : bannière mode invité */}
                      {!isAuthed && guestMode && (
                        <div className="mt-3 p-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900">
                          👤 <strong>{t("reservation.guestMode")}</strong> — {t("reservation.guestModeDesc")}
                          {t("reservation.confirmationEmailSent")}{" "}
                          <a href="/inscription" className="underline">{t("reservation.createAccount")}</a>
                        </div>
                      )}
                    </>
                  )}

                  <div className="mt-4 space-y-2 text-xs text-gray-500">
                    <p className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> {cancellationPolicyLabel(property?.cancellationPolicy, t)}</p>
                    <p className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> {t("reservation.priceConfirmed")}</p>
                    <p className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> {t("reservation.securePayment")}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// T-005 (BUG-007) : useSearchParams doit être enveloppé dans <Suspense>
// depuis Next.js 15/16 pour permettre le rendu statique / streaming.
export function ReservationView({ initialLanguage = null }: { initialLanguage?: string | null }) {
  // T-162 : langue SSR pour le fallback (serveur → pas de flash FR en EN).
  const t = makeT(initialLanguage === "en" ? "en" : "fr");
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">{t("reservation.loading")}</div>}>
      <ReservationPageInner />
    </Suspense>
  );
}
