"use client";

import { useMemo, useState } from "react";
// T-154d (audit n°26, P2-8) : feedback global via ToastProvider.
import { useToast } from "@/components/ui/toast";

interface Day {
  date: string;
  availableCount: number;
  price: string | null;
  stopSell: boolean | null;
  minStay: number | null;
}

const DAYS_PER_PAGE = 90;

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
  const { addToast } = useToast();
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
  const [visiblePage, setVisiblePage] = useState(0);

  const dateList = useMemo(() => {
    const list: string[] = [];
    const start = new Date(from);
    const end = new Date(to);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      list.push(d.toISOString().slice(0, 10));
    }
    return list;
  }, [from, to]);

  const pageCount = Math.max(1, Math.ceil(dateList.length / DAYS_PER_PAGE));
  // Le range peut rétrécir après une saisie : borner la vue dérivée évite une
  // tranche vide sans synchroniser artificiellement un second state React.
  const currentPage = Math.min(visiblePage, pageCount - 1);
  const visibleDates = dateList.slice(currentPage * DAYS_PER_PAGE, (currentPage + 1) * DAYS_PER_PAGE);

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
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}/availability?from=${from}&to=${to}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Impossible de recharger le calendrier");
      const m: Record<string, Day> = {};
      for (const d of data.days ?? []) m[d.date] = d;
      setDays(m);
      setVisiblePage(0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erreur de rechargement");
    }
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
      for (let i = 0; i < changed.length; i += DAYS_PER_PAGE) {
        const chunk = changed.slice(i, i + DAYS_PER_PAGE).map((d) => ({
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
      addToast("success", "Calendrier enregistré");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      addToast("error", e instanceof Error ? e.message : "Impossible d'enregistrer le calendrier");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label htmlFor="cal-from" className="block text-xs text-gray-500 mb-1">Du</label>
          <input id="cal-from" type="date" value={from} onChange={(e) => { setFrom(e.target.value); setVisiblePage(0); }} className="px-3 py-2 border border-gray-200 rounded-lg" />
        </div>
        <div>
          <label htmlFor="cal-to" className="block text-xs text-gray-500 mb-1">Au</label>
          <input id="cal-to" type="date" value={to} onChange={(e) => { setTo(e.target.value); setVisiblePage(0); }} className="px-3 py-2 border border-gray-200 rounded-lg" />
        </div>
        <button type="button" onClick={reload} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
          Recharger
        </button>
        <div className="text-xs text-gray-500">
          {dateList.length} jour{dateList.length > 1 ? "s" : ""} — vue {currentPage + 1}/{pageCount}, 90 max par batch.
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
            {visibleDates.map((date) => {
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

      {pageCount > 1 && (
        <nav aria-label="Tranches du calendrier" className="flex flex-wrap items-center gap-2 text-sm">
          <button type="button" onClick={() => setVisiblePage(Math.max(0, currentPage - 1))} disabled={currentPage === 0 || loading} className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50">90 jours précédents</button>
          <span className="text-gray-600">Jours {currentPage * DAYS_PER_PAGE + 1}–{Math.min((currentPage + 1) * DAYS_PER_PAGE, dateList.length)}</span>
          <button type="button" onClick={() => setVisiblePage(Math.min(pageCount - 1, currentPage + 1))} disabled={currentPage >= pageCount - 1 || loading} className="px-3 py-2 border border-gray-300 rounded-lg disabled:opacity-50">90 jours suivants</button>
        </nav>
      )}

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
