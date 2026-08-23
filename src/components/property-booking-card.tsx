"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { buildReservationUrl } from "@/lib/reservation-url";
import { formatPrice } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  propertyId: string;
  room: { id: string; basePrice: string; currency: string | null } | null;
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
            {room ? formatPrice(room.basePrice, room.currency ?? "EUR") : "—"}
          </p>
          <p className="text-sm text-gray-500">par nuit</p>
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
                {[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count}</option>)}
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

        <Link href={href} className="block w-full text-center px-6 py-3 rounded-lg bg-[#FF5A5F] text-white font-medium hover:bg-[#e54a4f] transition">
          Voir les disponibilités
        </Link>
        <p className="text-xs text-center text-gray-500 mt-3">✓ Conditions d&apos;annulation affichées avant confirmation</p>
      </CardContent>
    </Card>
  );
}
