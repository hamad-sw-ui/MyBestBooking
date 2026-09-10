"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PromoCodeInput } from "@/components/promo-code-input";
import { useDisplayPreferences } from "@/lib/use-display-currency";
import { isUiLocale } from "@/lib/ui-strings";
import { useT, useUiLocale } from "@/components/ui-locale-provider";
// T-154c (audit n°26, P2-5) : libellé d'annulation dérivé de la politique
// réelle du bien (+ grille serveur), plus jamais « gratuit » en dur.
import { cancellationPolicyLabel } from "@/lib/cancellation-label";
import { formatPrice } from "@/lib/utils";
import { countryLabel } from "@/lib/country-label";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import {
  ArrowLeft, ArrowRight, Check, Shield, MapPin,
  Calendar, Users, CheckCircle, Star
} from "lucide-react";
import Link from "next/link";
import { readReservationParams, describeIncompleteLink } from "@/lib/reservation-url";
import { SmartImage } from "@/components/ui/smart-image";
import { countryOptions } from "@/lib/countries";

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

interface BookingQuoteData {
  currency: string;
  nights: string[];
  nightlyPrices: number[];
  baseSubtotal: number;
  ratePlanDiscount: number;
  subtotal: number;
  taxes: number;
  totalBeforePromo: number;
  bestrewardsDiscountPercent: number;
  bestrewardsDiscount: number;
  totalBeforeWallet: number;
}


function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function ReservationPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Lecture temporaire des paramètres legacy propertyId/roomId afin que les
  // liens déjà générés ne cassent pas pendant la migration de convention.
  const reservationParams = readReservationParams(searchParams);
  // T-207 : les reprises de paiement en ligne sont désactivées. Un ancien
  // lien /reservation?booking=… affiche un message clair au lieu de rouvrir
  // une UI de paiement.
  const bookingParam = searchParams.get("booking");
  // T-176 : deep-link incomplet (?room=… seul ou ?property=… seule) — on
  // tente un rattrapage doux avant d'afficher l'état « informations
  // manquantes » (voir effet plus bas).
  const incompleteLink = describeIncompleteLink(searchParams);
  const [resolvingLink, setResolvingLink] = useState(incompleteLink !== null);
  const [loaded, setLoaded] = useState<{ propertyId: string | null; roomId: string | null }>({
    propertyId: reservationParams?.propertyId ?? null,
    roomId: reservationParams?.roomId ?? null,
  });
  const propertyId = loaded.propertyId;
  const roomId = loaded.roomId;

  const [step, setStep] = useState(1);
  const { language } = useDisplayPreferences();
  const uiLocale = useUiLocale();
  const t = useT();
  // Refs pour garder des valeurs récentes dans les effets sans les
  // re-déclencher (pas de dépendance instable dans les deps). Mises à jour
  // dans un effet (jamais pendant le rendu — règle react-hooks/refs).
  const tRef = useRef(t);
  const resumeLoadedRef = useRef(false);

  useEffect(() => {
    tRef.current = t;
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [ratePlans, setRatePlans] = useState<RatePlanData[]>([]);
  const [confirmation, setConfirmation] = useState<{ bookingReference: string; total: string; manualBooking?: boolean } | null>(null);
  const [promo, setPromo] = useState<{ code: string; discount: number; finalTotal: number; quoteKey: string } | null>(null);
  // T-030 : guest booking ; T-207 retire les déductions wallet du tunnel.
  const [isAuthed, setIsAuthed] = useState<boolean>(true);
  const [guestMode, setGuestMode] = useState<boolean>(false);
  const [pricingQuote, setPricingQuote] = useState<BookingQuoteData | null>(null);
  const [pricingQuoteKey, setPricingQuoteKey] = useState("");
  const [pricingQuoteError, setPricingQuoteError] = useState("");

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
  const fallbackPricePerNight = room ? parseFloat(room.basePrice) : 0;
  const checkInDate = formData.checkIn ? new Date(formData.checkIn) : null;
  const checkOutDate = formData.checkOut ? new Date(formData.checkOut) : null;
  const numNights = checkInDate && checkOutDate
    ? Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const selectedRatePlan = ratePlans.find((plan) => plan.id === formData.ratePlanId) ?? null;
  const fallbackBaseSubtotal = fallbackPricePerNight * numNights;
  const fallbackRatePlanDiscount = selectedRatePlan ? fallbackBaseSubtotal * (parseFloat(selectedRatePlan.discountPercentage || "0") / 100) : 0;
  const currentDay = todayIso();
  const selectedDatesArePast = Boolean(formData.checkIn && formData.checkIn < currentDay);
  const quoteRequestKey = property && room && formData.checkIn && formData.checkOut && numNights > 0 && !selectedDatesArePast
    ? [property.id, room.id, formData.checkIn, formData.checkOut, formData.numAdults, formData.numChildren, formData.ratePlanId || "standard"].join("|")
    : "";
  const quoteIsFresh = Boolean(quoteRequestKey && pricingQuoteKey === quoteRequestKey && pricingQuote);
  const quoteErrorForSelection = quoteRequestKey && pricingQuoteKey === quoteRequestKey ? pricingQuoteError : "";
  const quotePendingForSelection = Boolean(quoteRequestKey) && pricingQuoteKey !== quoteRequestKey;
  const authoritativeQuote = quoteIsFresh ? pricingQuote : null;
  // T-205 : dès qu'une plage est sélectionnée, le récap utilise le devis API
  // basé sur `evaluateBookingRules` (prix calendrier par nuit, stop-sell,
  // min-stay, chevauchements). Les valeurs fallback ne servent qu'avant la
  // première réponse réseau, sans autoriser la soumission.
  const pricePerNight = authoritativeQuote && numNights > 0
    ? authoritativeQuote.baseSubtotal / numNights
    : fallbackPricePerNight;
  const baseSubtotal = authoritativeQuote?.baseSubtotal ?? fallbackBaseSubtotal;
  const ratePlanDiscount = authoritativeQuote?.ratePlanDiscount ?? fallbackRatePlanDiscount;
  const subtotal = authoritativeQuote?.subtotal ?? Math.max(0, fallbackBaseSubtotal - fallbackRatePlanDiscount);
  // T-154d (audit n°26, P2-4) : TVA réelle (settings billing.taxRate, défaut
  // historique 0.1) — avant : 0.1 en dur, divergence dès qu'un admin ajuste.
  const taxes = authoritativeQuote?.taxes ?? subtotal * (property?.taxRate ?? 0.1);
  const totalBeforePromo = authoritativeQuote?.totalBeforePromo ?? subtotal + taxes;
  const activePromo = promo?.quoteKey === quoteRequestKey ? promo : null;
  const totalAfterPromo = activePromo ? activePromo.finalTotal : totalBeforePromo;
  // Même règle que POST /api/bookings : la remise BestRewards s'applique
  // APRÈS la promo, sur le total (arrondi au centime).
  const bestrewardsPercent = authoritativeQuote?.bestrewardsDiscountPercent ?? property?.bestrewardsDiscountPercent ?? 0;
  const bestrewardsAmount = bestrewardsPercent > 0
    ? Math.round(totalAfterPromo * (bestrewardsPercent / 100) * 100) / 100
    : 0;
  const total = Math.max(0, totalAfterPromo - bestrewardsAmount);
  // T-152 (B) : devise réelle de la chambre pour TOUS les montants affichés
  // (le débit PSP utilise room.currency — voir POST /api/bookings).
  const roomCurrency = authoritativeQuote?.currency ?? room?.currency ?? "EUR";
  // T-207 : le montant reste un devis informatif ; aucune déduction wallet
  // ni aucun paiement en ligne ne sont déclenchés depuis le tunnel.
  const selectionCanContinue = Boolean(
    formData.checkIn
    && formData.checkOut
    && numNights > 0
    && !selectedDatesArePast
    && !quotePendingForSelection
    && !quoteErrorForSelection,
  );
  const residenceCountryOptions = countryOptions(t);

  // T-207 : un ancien lien de reprise de paiement ne doit plus ouvrir le
  // tunnel de paiement. On vérifie simplement que la réservation existe puis on
  // invite à consulter Mes réservations / contacter l'hôte.
  useEffect(() => {
    if (!bookingParam || resumeLoadedRef.current) return;
    resumeLoadedRef.current = true;
    (async () => {
      try {
        const response = await fetch(`/api/bookings/${bookingParam}`, { cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          setError(data?.error ?? tRef.current("reservation.resumeError"));
          return;
        }
        setError(tRef.current("reservation.onlinePaymentDisabled"));
      } catch {
        setError(tRef.current("reservation.resumeError"));
      } finally {
        setLoading(false);
      }
    })();
  }, [bookingParam]);

  // T-176 : rattrapage d'un deep-link incomplet vers le tunnel.
  //  - `?room=…` seul : la chambre détermine son hébergement
  //    (GET /api/rooms/[id]) — on pré-remplit propertyId/roomId et le
  //    tunnel continue normalement dans l'effet principal.
  //  - `?property=…` seule : plusieurs chambres possibles — on redirige
  //    vers la fiche publique où le choix de la chambre est fait.
  //  En cas d'échec : l'état « informations manquantes » reste inchangé.
  const incompleteLinkKind = incompleteLink?.kind ?? null;
  const incompleteLinkRoom = incompleteLink?.kind === "roomOnly" ? incompleteLink.roomId : null;
  const incompleteLinkProperty = incompleteLink?.kind === "propertyOnly" ? incompleteLink.propertyId : null;
  useEffect(() => {
    if (!incompleteLinkKind) return;
    let cancelled = false;
    const done = () => { if (!cancelled) setResolvingLink(false); };
    if (incompleteLinkRoom) {
      fetch(`/api/rooms/${incompleteLinkRoom}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const room = data?.room;
          if (cancelled) return;
          if (room?.propertyId) {
            setLoaded({ propertyId: room.propertyId, roomId: room.id });
          }
        })
        .catch(() => undefined)
        .finally(done);
    } else if (incompleteLinkProperty) {
      fetch(`/api/properties/${incompleteLinkProperty}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const slug = data?.property?.slug;
          if (cancelled) return;
          if (slug) router.replace(`/hebergement/${slug}`);
        })
        .catch(() => undefined)
        .finally(done);
    }
    return () => { cancelled = true; };
    // Dépendances primitives extraites au-dessus : l'effet ne dépend pas
    // de l'objet `incompleteLink` (recréé à chaque rendu).
  }, [incompleteLinkKind, incompleteLinkRoom, incompleteLinkProperty]); // eslint-disable-line react-hooks/exhaustive-deps -- router est stable (next/navigation)

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
        } else {
          // Non connecté : passe en guest mode par défaut plutôt que de bloquer.
          setIsAuthed(false);
          setGuestMode(true);
        }
      });
  }, [propertyId, roomId, router]);

  useEffect(() => {
    if (!quoteRequestKey || !property || !room) return;

    const controller = new AbortController();
    const params = new URLSearchParams({
      propertyId: property.id,
      roomId: room.id,
      checkIn: formData.checkIn,
      checkOut: formData.checkOut,
      numAdults: String(formData.numAdults),
      numChildren: String(formData.numChildren),
    });
    if (formData.ratePlanId) params.set("ratePlanId", formData.ratePlanId);

    fetch(`/api/bookings/quote?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.ok) throw new Error(data.error ?? tRef.current("reservation.bookingError"));
        setPricingQuote(data as BookingQuoteData);
        setPricingQuoteError("");
        setPricingQuoteKey(quoteRequestKey);
      })
      .catch((reason) => {
        if (controller.signal.aborted) return;
        setPricingQuote(null);
        setPricingQuoteError(reason instanceof Error ? reason.message : tRef.current("reservation.bookingError"));
        setPricingQuoteKey(quoteRequestKey);
      });

    return () => controller.abort();
  }, [quoteRequestKey, property, room, formData.checkIn, formData.checkOut, formData.numAdults, formData.numChildren, formData.ratePlanId]);

  const handleSubmit = async () => {
    if (!property || !room || quotePendingForSelection) return;
    if (quoteErrorForSelection || !selectionCanContinue) {
      setError(quoteErrorForSelection || t("reservation.bookingError"));
      return;
    }
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
          promoCode: activePromo?.code || undefined,
          ratePlanId: formData.ratePlanId || undefined,
          isGuestBooking: guestMode || undefined,
          // T-151 : langue de l'invité → l'e-mail de réclamation de compte
          // est localisé pour lui (le profil invité la persiste).
          language: language && isUiLocale(language) ? language : uiLocale,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || t("reservation.bookingError"));
        setSubmitting(false);
        return;
      }

      setConfirmation({
        bookingReference: data.booking.bookingReference,
        total: data.booking.total,
        // T-207 : toutes les créations du tunnel sont des demandes manuelles.
        manualBooking: data.manualConfirmation !== false,
      });
      setStep(4);
    } catch {
      setError(t("error.title"));
    }
    setSubmitting(false);
  };

  if (!propertyId || !roomId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-12">
            {resolvingLink ? (
              // T-176 : lien incomplet — résolution en cours (pas de faux
              // « informations manquantes » pendant le fetch).
              <>
                <p className="text-gray-500 mb-4">{t("reservation.loading")}</p>
              </>
            ) : error ? (
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
    { num: 3, label: t("reservation.stepRequest") },
    { num: 4, label: t("reservation.stepSent") },
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
                      min={currentDay}
                      onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })}
                      required
                    />
                    <Input
                      type="date"
                      label={t("reservation.checkOutDate")}
                      value={formData.checkOut}
                      min={formData.checkIn && formData.checkIn >= currentDay ? formData.checkIn : currentDay}
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
                      {selectedRatePlan && <p className="mt-1 text-xs text-gray-500">{t("reservation.policyPrefix").replace("{policy}", cancellationPolicyLabel(selectedRatePlan.cancellationPolicy, t))}{selectedRatePlan.includesBreakfast ? t("reservation.breakfastIncludedCaps") : ""}</p>}
                    </div>
                  )}
                </CardContent>
                {selectedDatesArePast && (
                  <p className="px-6 pb-2 text-sm text-red-600" role="alert">
                    {t("reservation.invalidPastDates")}
                  </p>
                )}
                {quotePendingForSelection && (
                  <p className="px-6 pb-2 text-sm text-gray-500">{t("reservation.loading")}</p>
                )}
                {quoteErrorForSelection && (
                  <p className="px-6 pb-2 text-sm text-red-600" role="alert">{quoteErrorForSelection}</p>
                )}
                <CardFooter className="flex justify-end">
                  <Button onClick={() => setStep(2)} disabled={!selectionCanContinue}>
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
                  {!isAuthed && guestMode && (
                    <p className="text-sm bg-blue-50 text-[#1B3A6B] border border-blue-100 rounded-lg p-3">
                      <strong>{t("reservation.guestTitle")}</strong> — {t("reservation.guestCreateAccountHint")} {" "}
                      <Link href="/inscription" className="underline font-medium">{t("reservation.createAccount")}</Link>
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
                    placeholder={t("account.phonePlaceholder")}
                    readOnly={isAuthed}
                    disabled={isAuthed}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      label={t("reservation.residenceCountry")}
                      options={residenceCountryOptions}
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
                    disabled={!formData.guestFirstName || !formData.guestLastName || !formData.guestEmail || !selectionCanContinue}
                  >
                    {t("reservation.continue")} <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardFooter>
              </Card>
            )}

            {/* Step 3: demande de réservation, sans paiement plateforme */}
            {step === 3 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-[#00A699]" />
                    {t("reservation.requestReviewTitle")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg text-sm bg-amber-50 text-amber-900 border border-amber-200">
                    <p className="font-medium text-gray-900">{t("reservation.requestOnlyTitle")}</p>
                    <p className="mt-1">{t("reservation.requestOnlyBody")}</p>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-lg text-sm bg-blue-50 text-[#1B3A6B]">
                    <CheckCircle className="w-5 h-5 text-[#00A699] flex-shrink-0" />
                    <span>{t("reservation.requestNoOnlinePayment")}</span>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="ghost" onClick={() => setStep(2)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> {t("action.back")}
                  </Button>
                  <Button onClick={handleSubmit} loading={submitting} disabled={!selectionCanContinue} size="lg" variant="secondary">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {t("reservation.submitManualRequest")} {total > 0 ? formatPrice(total, roomCurrency, uiLocale) : ""}
                  </Button>
                </CardFooter>
              </Card>
            )}

            {/* Step 4: Confirmation */}
            {step === 4 && confirmation && (
              <Card className="text-center">
                <CardContent className="py-12">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-[#00A699]">
                    <CheckCircle className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    {t("reservation.manualRequestSent")}
                  </h2>
                  <p className="text-gray-600 mb-6">
                    {t("reservation.manualRequestBody")}
                  </p>

                  <div className="inline-block p-6 bg-gray-50 rounded-xl mb-6">
                    <p className="text-sm text-gray-500 mb-1">{t("reservation.refLabel")}</p>
                    <p className="text-2xl font-mono font-bold text-[#1B3A6B]">{confirmation.bookingReference}</p>
                    <div className="mt-4 space-y-1 text-sm text-gray-600">
                      <p>🏨 {property?.name}, {property?.city}</p>
                      <p>📅 {formData.checkIn} → {formData.checkOut}</p>
                      <p>💰 {t("reservation.stayAmountEstimate")} : {formatPrice(confirmation.total, roomCurrency, uiLocale)} {t("reservation.allInclusive")}</p>
                    </div>
                  </div>

                  <p className="text-sm text-gray-500 mb-6">
                    {t("reservation.confirmationEmailSent")}
                  </p>
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
                    <div className="relative w-full h-32 rounded-lg mb-4 overflow-hidden">
                      <SmartImage
                        src={property.mainImage}
                        alt={property.name}
                        className="w-full h-32 object-cover"
                        sizes="(max-width: 1024px) 100vw, 320px"
                      />
                    </div>
                  )}
                  <h3 className="font-semibold text-gray-900">
                    {property?.name}
                    {property?.starRating && (
                      <span className="ml-1 text-[#F5A623]">{"★".repeat(property.starRating)}</span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                    <MapPin className="w-3.5 h-3.5" />
                    {property?.city}, {countryLabel(property?.country, t)}
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
                    {t("prop.persMax").replace("{n}", String(room?.maxOccupancy ?? ""))}
                    {room?.sizeSqm && ` • ${room.sizeSqm} m²`}
                  </p>

                  <hr className="my-4" />

                  {/* Dates */}
                  {numNights > 0 && (
                    <>
                      {quotePendingForSelection && (
                        <p className="text-xs text-gray-500 mb-2">{t("reservation.loading")}</p>
                      )}
                      {quoteErrorForSelection && (
                        <p className="text-xs text-red-600 mb-2" role="alert">{quoteErrorForSelection}</p>
                      )}
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">
                          {t("reservation.nightsLine")
                            .replace("{n}", String(numNights))
                            .replace("{unit}", t(numNights > 1 ? "reservation.nightsPlural" : "reservation.nights"))
                            .replace("{price}", formatPrice(pricePerNight, roomCurrency, uiLocale))}
                        </span>
                        {/* T-146 : on affiche ici le sous-total de BASE (nuits × tarif),
                            puis la remise du tarif choisi sur la ligne verte. Auparavant
                            on affichait `subtotal` (déjà remisé) : la remise était alors
                            comptée deux fois dans le détail, même si le Total final et le
                            calcul serveur restaient justes. */}
                        <span>{formatPrice(baseSubtotal, roomCurrency, uiLocale)}</span>
                      </div>
                      {selectedRatePlan && (
                        <div className="flex justify-between text-sm mb-2 text-green-700">
                          <span>{selectedRatePlan.name}</span>
                          <span>−{formatPrice(ratePlanDiscount, roomCurrency, uiLocale)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">{t("reservation.taxesFees")}</span>
                        <span>{formatPrice(taxes, roomCurrency, uiLocale)}</span>
                      </div>
                      {activePromo && (
                        <div className="flex justify-between text-sm mb-2 text-green-700">
                          <span>{t("reservation.promoCode").replace("{code}", activePromo.code)}</span>
                          <span>−{formatPrice(activePromo.discount, roomCurrency, uiLocale)}</span>
                        </div>
                      )}
                      {!quotePendingForSelection && !quoteErrorForSelection && (
                        <div className="my-3">
                          <PromoCodeInput
                            key={`${quoteRequestKey}:${totalBeforePromo.toFixed(2)}:${roomCurrency}`}
                            amount={totalBeforePromo}
                            currency={roomCurrency}
                            onApplied={(applied) => setPromo(applied ? { ...applied, quoteKey: quoteRequestKey } : null)}
                          />
                        </div>
                      )}
                      {/* T-154d (audit n°26, P2-4) : réduction BestRewards réelle
                          du user (GET /api/properties/[id] — read-only). Avant :
                          le récap n'en parlait pas, le serveur l'appliquait
                          quand même (261,07 affiché pour 221,91 facturés). */}
                      {bestrewardsAmount > 0 && (
                        <div className="flex justify-between text-sm mb-2 text-emerald-700">
                          <span>💎 BestRewards ({bestrewardsPercent} %)</span>
                          <span>−{formatPrice(bestrewardsAmount, roomCurrency, uiLocale)}</span>
                        </div>
                      )}
                      <div className="my-3 p-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900">
                        {t("reservation.noPlatformPaymentNotice")}
                      </div>
                      <hr className="my-3" />
                      <div className="flex justify-between font-bold text-lg">
                        <span>{t("reservation.totalLabel")}</span>
                        <span className="text-[#1B3A6B]">
                          {formatPrice(total, roomCurrency, uiLocale)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {t("reservation.noExtraFees")}
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
                    <p className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> {t("reservation.requestOnlyTitle")}</p>
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
  const t = useT();
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-500">{t("reservation.loading")}</div>}>
      <ReservationPageInner />
    </Suspense>
  );
}
