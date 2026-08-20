"use client";

import { useEffect, useMemo, useState } from "react";

interface Day {
  date: string;
  availableCount: number;
  price: string | null;
  stopSell: boolean | null;
  minStay: number | null;
}

interface Props {
  roomId: string;
  quantity: number;
  basePrice: string;
  initialFrom: string;
  initialTo: string;
  initialDays: Day[];
}

/**
 * Calendrier d'inventaire journalier d'une room (T-018).
 * Édition par ligne, batch PUT au submit.
 */
export function AvailabilityCalendar({
  roomId,
  quantity,
  basePrice,
  initialFrom,
  initialTo,
  initialDays,
}: Props) {
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [days, setDays] = useState<Record<string, Day>>(() => {
    const m: Record<string, Day> = {};
    for (const d of initialDays) m[d.date] = d;
    return m;
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateList = useMemo(() => {
    const list: string[] = [];
    const start = new Date(from);
    const end = new Date(to);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      list.push(d.toISOString().slice(0, 10));
    }
    return list;
  }, [from, to]);

  function getDay(date: string): Day {
    return (
      days[date] ?? {
        date,
        availableCount: quantity,
        price: null,
        stopSell: false,
        minStay: 1,
      }
    );
  }

  function setDay(date: string, patch: Partial<Day>) {
    setDays((d) => ({ ...d, [date]: { ...getDay(date), ...patch } }));
    setSaved(false);
  }

  async function reload() {
    const res = await fetch(`/api/rooms/${roomId}/availability?from=${from}&to=${to}`);
    const data = await res.json();
    const m: Record<string, Day> = {};
    for (const d of data.days) m[d.date] = d;
    setDays(m);
  }

  async function save() {
    setError(null);
    setLoading(true);
    try {
      const changed = dateList
        .map((date) => days[date])
        .filter(Boolean);
      if (changed.length === 0) {
        setSaved(true);
        return;
      }
      // Chunker à 90 max côté API
      for (let i = 0; i < changed.length; i += 90) {
        const chunk = changed.slice(i, i + 90).map((d) => ({
          date: d.date,
          availableCount: Number(d.availableCount),
          price: d.price != null && d.price !== "" ? Number(d.price) : null,
          stopSell: !!d.stopSell,
          minStay: d.minStay ?? 1,
        }));
        const res = await fetch(`/api/rooms/${roomId}/availability`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ days: chunk }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Erreur");
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label htmlFor="cal-from" className="block text-xs text-gray-500 mb-1">Du</label>
          <input id="cal-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg" />
        </div>
        <div>
          <label htmlFor="cal-to" className="block text-xs text-gray-500 mb-1">Au</label>
          <input id="cal-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg" />
        </div>
        <button type="button" onClick={reload} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          Recharger
        </button>
        <div className="text-xs text-gray-500">
          {dateList.length} jour{dateList.length > 1 ? "s" : ""} — max 90 par batch.
        </div>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left px-3 py-2">Date</th>
              <th className="text-left px-3 py-2">Stock (max {quantity})</th>
              <th className="text-left px-3 py-2">Prix override (défaut {basePrice})</th>
              <th className="text-left px-3 py-2">Séjour min</th>
              <th className="text-left px-3 py-2">Stop-sell</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {dateList.slice(0, 90).map((date) => {
              const d = getDay(date);
              const dt = new Date(date);
              const weekend = dt.getDay() === 0 || dt.getDay() === 6;
              return (
                <tr key={date} className={weekend ? "bg-amber-50/30" : ""}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {dt.toLocaleDateString("fr-FR", { weekday: "short", day: "2-digit", month: "short" })}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number" min={0} max={quantity}
                      value={d.availableCount}
                      onChange={(e) => setDay(date, { availableCount: parseInt(e.target.value, 10) || 0 })}
                      className="w-16 px-2 py-1 border border-gray-200 rounded"
                      aria-label={`Stock du ${date}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number" step="0.01" min={0}
                      value={d.price ?? ""}
                      onChange={(e) => setDay(date, { price: e.target.value || null })}
                      placeholder="—"
                      className="w-24 px-2 py-1 border border-gray-200 rounded"
                      aria-label={`Prix override du ${date}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number" min={1} max={30}
                      value={d.minStay ?? 1}
                      onChange={(e) => setDay(date, { minStay: parseInt(e.target.value, 10) || 1 })}
                      className="w-14 px-2 py-1 border border-gray-200 rounded"
                      aria-label={`Séjour minimum du ${date}`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!d.stopSell}
                      onChange={(e) => setDay(date, { stopSell: e.target.checked })}
                      aria-label={`Stop-sell du ${date}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button" onClick={save} disabled={loading}
          className="px-5 py-2 bg-[#1B3A6B] text-white font-medium rounded-lg hover:bg-[#0f2444] disabled:opacity-50"
        >
          {loading ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
        {saved && <span className="text-sm text-green-600">Enregistré ✓</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  );
}
