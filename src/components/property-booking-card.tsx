"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buildReservationUrl } from "@/lib/reservation-url";
import { formatPrice } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { convertAmount, formatMoney } from "@/lib/i18n";
import { useDisplayCurrency } from "@/lib/use-display-currency";

interface Props {
  propertyId: string;
  // T-119 (B1) : on propage la capacité de la chambre pour borner le
  // sélecteur d'adultes dès la fiche (au lieu de laisser l'utilisateur
  // choisir 6 adultes pour une chambre de 2 et n'être recadré qu'au
  // checkout). Les champs de capacité sont optionnels : à défaut, on
  // retombe sur le comportement historique (1–6), sans rien casser.
  room: {
    id: string;
    basePrice: string;
    currency: string | null;
    maxAdults?: number | null;
    maxOccupancy?: number | null;
  } | null;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialAdults?: number;
  initialChildren?: number;
}

/**
 * Carte client de fiche logement. Elle ne prétend pas valider le stock : elle
 * conserve le contexte et laisse le serveur de réservation être l'autorité.
 */
export function PropertyBookingCard({
  propertyId,
  room,
  initialCheckIn = "",
  initialCheckOut = "",
  initialAdults = 2,
  initialChildren = 0,
}: Props) {
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [adults, setAdults] = useState(initialAdults);
  const [children, setChildren] = useState(initialChildren);
  // T-131 : prix d'aperçu converti dans la devise d'affichage du client
  // (indicatif ; le paiement reste dans la devise de la chambre).
  const displayCurrency = useDisplayCurrency();
  const roomCurrency = room?.currency ?? "EUR";
  const displayPrice = room
    ? (!displayCurrency || displayCurrency === roomCurrency.toUpperCase()
        ? formatPrice(room.basePrice, roomCurrency)
        : formatMoney(convertAmount(Number(room.basePrice), roomCurrency, displayCurrency), displayCurrency))
    : "—";
  const isConverted = Boolean(room && displayCurrency && displayCurrency !== roomCurrency.toUpperCase());
  // T-119 (B1) : capacité d'accueil connue → on borne les adultes à la
  // chambre ; sinon on garde le sélecteur 1–6 d'origine.
  const adultsLimit =
    room?.maxAdults && Number.isFinite(Number(room.maxAdults)) && Number(room.maxAdults) > 0
      ? Math.min(6, Number(room.maxAdults))
      : 6;
  const adultOptions = Array.from({ length: adultsLimit }, (_, i) => i + 1);
  const href = useMemo(
    () => room ? buildReservationUrl({ propertyId, roomId: room.id, checkIn, checkOut, numAdults: adults, numChildren: children }) : "/recherche",
    [propertyId, room, checkIn, checkOut, adults, children],
  );

  return (
    <Card>
      <CardContent>
        <div className="text-center mb-4">
          <p className="text-sm text-gray-500">À partir de</p>
          <p className="text-3xl font-bold text-gray-900">
            {displayPrice}
          </p>
          <p className="text-sm text-gray-500">par nuit</p>
          {isConverted && (
            <p className="text-[10px] text-gray-400" title="Conversion indicative, taux figés. Le paiement reste en devise de l'hébergement.">
              Conversion indicative · paiement en {roomCurrency}
            </p>
          )}
        </div>

        <div className="space-y-3 mb-4">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="property-check-in" className="block text-xs font-medium text-gray-500 mb-1">Arrivée</label>
              <input id="property-check-in" type="date" value={checkIn} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setCheckIn(event.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label htmlFor="property-check-out" className="block text-xs font-medium text-gray-500 mb-1">Départ</label>
              <input id="property-check-out" type="date" value={checkOut} min={checkIn || new Date().toISOString().slice(0, 10)} onChange={(event) => setCheckOut(event.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium text-gray-500">
              Adultes
              <select value={adults} onChange={(event) => setAdults(Number(event.target.value))} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900">
                {adultOptions.map((count) => <option key={count} value={count}>{count}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-gray-500">
              Enfants
              <select value={children} onChange={(event) => setChildren(Number(event.target.value))} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900">
                {[0, 1, 2, 3, 4].map((count) => <option key={count} value={count}>{count}</option>)}
              </select>
            </label>
          </div>
        </div>

        {room ? (
          <Link href={href} className="block w-full text-center px-6 py-3 rounded-lg bg-[#FF5A5F] text-white font-medium hover:bg-[#e54a4f] transition">
            Voir les disponibilités
          </Link>
        ) : (
          // T-119 (B2) : aucune chambre dérivable → on n'envoie plus
          // silencieusement vers /recherche ; on explique l'état.
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="block w-full text-center px-6 py-3 rounded-lg bg-gray-200 text-gray-500 font-medium cursor-not-allowed"
          >
            Aucune chambre disponible
          </button>
        )}
        <p className="text-xs text-center text-gray-500 mt-3">✓ Conditions d&apos;annulation affichées avant confirmation</p>
      </CardContent>
    </Card>
  );
}
