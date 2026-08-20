"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, ArrowRight, Check, Shield, Lock, MapPin,
  Calendar, Users, CreditCard, Clock, CheckCircle, Star
} from "lucide-react";
import Link from "next/link";

interface PropertyData {
  id: string;
  name: string;
  slug: string;
  city: string;
  country: string;
  mainImage: string | null;
  starRating: number | null;
  averageRating: string | null;
  totalReviews: number | null;
  checkInFrom: string | null;
  checkOutUntil: string | null;
}

interface RoomData {
  id: string;
  name: string;
  roomType: string;
  maxOccupancy: number;
  basePrice: string;
  sizeSqm: string | null;
  amenities: string[];
}

export default function ReservationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const propertyId = searchParams.get("property");
  const roomId = searchParams.get("room");

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [property, setProperty] = useState<PropertyData | null>(null);
  const [room, setRoom] = useState<RoomData | null>(null);
  const [confirmation, setConfirmation] = useState<{ bookingReference: string; total: string } | null>(null);

  const [formData, setFormData] = useState({
    checkIn: searchParams.get("checkIn") || "",
    checkOut: searchParams.get("checkOut") || "",
    numAdults: 2,
    numChildren: 0,
    guestFirstName: "",
    guestLastName: "",
    guestEmail: "",
    guestPhone: "",
    guestCountry: "FR",
    tripPurpose: "",
    specialRequests: "",
    estimatedArrival: "",
    paymentMethod: "card",
  });

  // Calculate pricing
  const pricePerNight = room ? parseFloat(room.basePrice) : 0;
  const checkInDate = formData.checkIn ? new Date(formData.checkIn) : null;
  const checkOutDate = formData.checkOut ? new Date(formData.checkOut) : null;
  const numNights = checkInDate && checkOutDate
    ? Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const subtotal = pricePerNight * numNights;
  const taxes = subtotal * 0.1;
  const total = subtotal + taxes;

  useEffect(() => {
    if (!propertyId || !roomId) return;

    fetch(`/api/properties/${propertyId}`)
      .then(res => res.json())
      .then(data => {
        if (data.property) {
          setProperty(data.property);
          const foundRoom = data.rooms?.find((r: RoomData) => r.id === roomId);
          if (foundRoom) setRoom(foundRoom);
        }
        setLoading(false);
      });

    // Pre-fill user data
    fetch("/api/auth/me")
      .then(res => {
        if (!res.ok) {
          router.push("/connexion");
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data?.user) {
          setFormData(prev => ({
            ...prev,
            guestFirstName: data.user.firstName || "",
            guestLastName: data.user.lastName || "",
            guestEmail: data.user.email || "",
            guestPhone: data.user.phone || "",
            guestCountry: data.user.country || "FR",
          }));
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
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Erreur lors de la réservation");
        setSubmitting(false);
        return;
      }

      setConfirmation({
        bookingReference: data.booking.bookingReference,
        total: data.booking.total,
      });
      setStep(4);
    } catch {
      setError("Une erreur est survenue");
    }
    setSubmitting(false);
  };

  if (!propertyId || !roomId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="text-center py-12">
            <p className="text-gray-500 mb-4">Informations de réservation manquantes</p>
            <Link href="/recherche">
              <Button>Rechercher un hébergement</Button>
            </Link>
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
    { num: 1, label: "Votre sélection" },
    { num: 2, label: "Vos informations" },
    { num: 3, label: "Paiement" },
    { num: 4, label: "Confirmé !" },
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
                  <CardTitle>✦ Votre sélection</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      type="date"
                      label="Date d'arrivée"
                      value={formData.checkIn}
                      onChange={(e) => setFormData({ ...formData, checkIn: e.target.value })}
                      required
                    />
                    <Input
                      type="date"
                      label="Date de départ"
                      value={formData.checkOut}
                      onChange={(e) => setFormData({ ...formData, checkOut: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Adultes</label>
                      <select
                        value={formData.numAdults}
                        onChange={(e) => setFormData({ ...formData, numAdults: parseInt(e.target.value) })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                      >
                        {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} adulte{n > 1 ? "s" : ""}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Enfants</label>
                      <select
                        value={formData.numChildren}
                        onChange={(e) => setFormData({ ...formData, numChildren: parseInt(e.target.value) })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                      >
                        {[0,1,2,3,4].map(n => <option key={n} value={n}>{n} enfant{n > 1 ? "s" : ""}</option>)}
                      </select>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end">
                  <Button onClick={() => setStep(2)} disabled={!formData.checkIn || !formData.checkOut || numNights <= 0}>
                    Continuer <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardFooter>
              </Card>
            )}

            {/* Step 2: Guest Info */}
            {step === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Vos informations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      label="Prénom"
                      value={formData.guestFirstName}
                      onChange={(e) => setFormData({ ...formData, guestFirstName: e.target.value })}
                      required
                    />
                    <Input
                      label="Nom"
                      value={formData.guestLastName}
                      onChange={(e) => setFormData({ ...formData, guestLastName: e.target.value })}
                      required
                    />
                  </div>
                  <Input
                    type="email"
                    label="Email"
                    value={formData.guestEmail}
                    onChange={(e) => setFormData({ ...formData, guestEmail: e.target.value })}
                    required
                  />
                  <Input
                    label="Téléphone"
                    value={formData.guestPhone}
                    onChange={(e) => setFormData({ ...formData, guestPhone: e.target.value })}
                    placeholder="+33 6 00 00 00 00"
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <Select
                      label="Pays de résidence"
                      options={[
                        { value: "FR", label: "France" },
                        { value: "MA", label: "Maroc" },
                        { value: "TN", label: "Tunisie" },
                        { value: "ES", label: "Espagne" },
                        { value: "IT", label: "Italie" },
                        { value: "DE", label: "Allemagne" },
                        { value: "GB", label: "Royaume-Uni" },
                        { value: "US", label: "États-Unis" },
                      ]}
                      value={formData.guestCountry}
                      onChange={(e) => setFormData({ ...formData, guestCountry: e.target.value })}
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Heure d&apos;arrivée estimée</label>
                      <select
                        value={formData.estimatedArrival}
                        onChange={(e) => setFormData({ ...formData, estimatedArrival: e.target.value })}
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
                      >
                        <option value="">Non spécifiée</option>
                        {Array.from({length: 24}, (_, i) => (
                          <option key={i} value={`${String(i).padStart(2,'0')}:00`}>
                            {String(i).padStart(2,'0')}:00
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Textarea
                    label="Demandes spéciales (optionnel)"
                    placeholder="Ex: chambre calme, lit bébé, arrivée tardive..."
                    value={formData.specialRequests}
                    onChange={(e) => setFormData({ ...formData, specialRequests: e.target.value })}
                    rows={3}
                  />
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="ghost" onClick={() => setStep(1)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Retour
                  </Button>
                  <Button
                    onClick={() => setStep(3)}
                    disabled={!formData.guestFirstName || !formData.guestLastName || !formData.guestEmail}
                  >
                    Continuer <ArrowRight className="w-4 h-4 ml-2" />
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
                    Paiement sécurisé
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {[
                      { value: "card", label: "💳 Carte bancaire (Visa, Mastercard, Amex)", tag: "Recommandé" },
                      { value: "paypal", label: "🅿️ PayPal", tag: null },
                      { value: "apple_pay", label: "🍎 Apple Pay", tag: null },
                      { value: "pay_at_hotel", label: "🏨 Payer à l'hôtel", tag: null },
                    ].map((method) => (
                      <label
                        key={method.value}
                        className={`flex items-center justify-between p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                          formData.paymentMethod === method.value
                            ? "border-[#1B3A6B] bg-[#1B3A6B]/5"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="radio"
                            name="payment"
                            value={method.value}
                            checked={formData.paymentMethod === method.value}
                            onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            formData.paymentMethod === method.value
                              ? "border-[#1B3A6B]"
                              : "border-gray-300"
                          }`}>
                            {formData.paymentMethod === method.value && (
                              <div className="w-3 h-3 rounded-full bg-[#1B3A6B]" />
                            )}
                          </div>
                          <span>{method.label}</span>
                        </div>
                        {method.tag && (
                          <Badge variant="success">{method.tag}</Badge>
                        )}
                      </label>
                    ))}
                  </div>

                  {formData.paymentMethod === "card" && (
                    <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                      <Input label="Numéro de carte" placeholder="1234 5678 9012 3456" />
                      <div className="grid grid-cols-2 gap-4">
                        <Input label="Date d'expiration" placeholder="MM/AA" />
                        <Input label="CVV" placeholder="123" />
                      </div>
                      <Input label="Nom sur la carte" placeholder="JEAN DUPONT" />
                    </div>
                  )}

                  <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg text-sm text-green-800">
                    <Shield className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>Chiffrement SSL 256 bits • 3D Secure 2.0 • Certifié PCI DSS Level 1</span>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between">
                  <Button variant="ghost" onClick={() => setStep(2)}>
                    <ArrowLeft className="w-4 h-4 mr-2" /> Retour
                  </Button>
                  <Button onClick={handleSubmit} loading={submitting} size="lg" variant="secondary">
                    <Lock className="w-4 h-4 mr-2" />
                    Confirmer et payer {total > 0 ? `€${total.toFixed(2)}` : ""}
                  </Button>
                </CardFooter>
              </Card>
            )}

            {/* Step 4: Confirmation */}
            {step === 4 && confirmation && (
              <Card className="text-center">
                <CardContent className="py-12">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#00A699] flex items-center justify-center">
                    <CheckCircle className="w-10 h-10 text-white" />
                  </div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Poppins', sans-serif" }}>
                    🎉 C&apos;est confirmé !
                  </h2>
                  <p className="text-gray-600 mb-6">
                    Merci {formData.guestFirstName} ! Votre réservation est confirmée.
                  </p>

                  <div className="inline-block p-6 bg-gray-50 rounded-xl mb-6">
                    <p className="text-sm text-gray-500 mb-1">Référence</p>
                    <p className="text-2xl font-mono font-bold text-[#1B3A6B]">{confirmation.bookingReference}</p>
                    <div className="mt-4 space-y-1 text-sm text-gray-600">
                      <p>🏨 {property?.name}, {property?.city}</p>
                      <p>📅 {formData.checkIn} → {formData.checkOut}</p>
                      <p>💰 Total payé : €{parseFloat(confirmation.total).toFixed(2)} tout inclus</p>
                    </div>
                  </div>

                  <p className="text-sm text-gray-500 mb-6">
                    📧 Confirmation envoyée à {formData.guestEmail}
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link href="/mes-reservations">
                      <Button>Voir mes réservations</Button>
                    </Link>
                    <Link href="/">
                      <Button variant="outline">Retour à l&apos;accueil</Button>
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
                      <span className="text-xs text-gray-500">({property.totalReviews} avis)</span>
                    </div>
                  )}

                  <hr className="my-4" />

                  {/* Room */}
                  <p className="text-sm text-gray-500">Chambre</p>
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
                          {numNights} nuit{numNights > 1 ? "s" : ""} × €{pricePerNight.toFixed(2)}
                        </span>
                        <span>€{subtotal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-600">Taxes et frais</span>
                        <span>€{taxes.toFixed(2)}</span>
                      </div>
                      <hr className="my-3" />
                      <div className="flex justify-between font-bold text-lg">
                        <span>Total</span>
                        <span className="text-[#1B3A6B]">€{total.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        ✅ Aucun frais supplémentaire
                      </p>
                    </>
                  )}

                  <div className="mt-4 space-y-2 text-xs text-gray-500">
                    <p className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> Annulation gratuite</p>
                    <p className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> Prix garanti</p>
                    <p className="flex items-center gap-1"><Check className="w-3 h-3 text-green-500" /> Paiement sécurisé</p>
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
