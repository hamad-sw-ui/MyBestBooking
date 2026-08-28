"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  initial: {
    firstName: string;
    lastName: string;
    phone: string | null;
    country: string | null;
    language: string | null;
    currency: string | null;
    timezone?: string | null;
  };
}

/**
 * Formulaire d'édition du profil courant (T-016).
 * PATCH /api/users/me
 */
export function ProfileForm({ initial }: Props) {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: initial.firstName,
    lastName: initial.lastName,
    phone: initial.phone ?? "",
    country: initial.country ?? "",
    language: initial.language ?? "fr",
    // T-132 : devise d'affichage par défaut = XAF (cohérent avec le réglage
    // plateforme). N'affecte que l'aperçu des prix, jamais la devise de
    // paiement des chambres.
    currency: initial.currency ?? "XAF",
    timezone: initial.timezone ?? "UTC",
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone || null,
        language: form.language,
        currency: form.currency,
        timezone: form.timezone,
      };
      if (form.country) body.country = form.country;
      const res = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Erreur");
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="pf-first" className="block text-sm font-medium text-gray-700 mb-1">Prénom</label>
          <input id="pf-first" required minLength={2} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]" />
        </div>
        <div>
          <label htmlFor="pf-last" className="block text-sm font-medium text-gray-700 mb-1">Nom</label>
          <input id="pf-last" required minLength={2} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]" />
        </div>
        <div>
          <label htmlFor="pf-phone" className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
          <input id="pf-phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+33 6 00 00 00 00" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]" />
        </div>
        <div>
          <label htmlFor="pf-country" className="block text-sm font-medium text-gray-700 mb-1">Pays (ISO-2)</label>
          <input id="pf-country" maxLength={2} value={form.country} onChange={(e) => set("country", e.target.value.toUpperCase())} placeholder="FR" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]" />
        </div>
        <div>
          <label htmlFor="pf-lang" className="block text-sm font-medium text-gray-700 mb-1">Langue</label>
          <select id="pf-lang" value={form.language} onChange={(e) => set("language", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]">
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
          {/* T-132 : la langue pilote les libellés traduits et les contenus
              anglais des hébergements (description). L'arabe n'est pas encore
              disponible (retombe en français). */}
          <p className="mt-1 text-xs text-gray-400">Applique les libellés traduits et les descriptions en anglais. L&apos;arabe reste en français en V1.</p>
        </div>
        <div>
          <label htmlFor="pf-currency" className="block text-sm font-medium text-gray-700 mb-1">Devise</label>
          <select id="pf-currency" value={form.currency} onChange={(e) => set("currency", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]">
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
            <option value="CHF">CHF</option>
            <option value="MAD">MAD</option>
            <option value="XAF">XAF (FCFA)</option>
          </select>
          {/* T-131 : les prix d'aperçu sont convertis (taux figés indicatifs) ;
              le paiement reste en devise de l'hébergement. */}
          <p className="mt-1 text-xs text-gray-400">Aperçu des prix converti (taux indicatifs) ; paiement en devise de l&apos;hébergement.</p>
        </div>
        <div>
          <label htmlFor="pf-tz" className="block text-sm font-medium text-gray-700 mb-1">Fuseau horaire</label>
          <select id="pf-tz" value={form.timezone} onChange={(e) => set("timezone", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]">
            <option value="UTC">UTC</option>
            <option value="Europe/Paris">Europe/Paris</option>
            <option value="Europe/London">Europe/London</option>
            <option value="Africa/Douala">Africa/Douala (Yaoundé)</option>
            <option value="Africa/Casablanca">Africa/Casablanca</option>
            <option value="Africa/Tunis">Africa/Tunis</option>
            <option value="Africa/Dakar">Africa/Dakar</option>
            <option value="America/New_York">America/New_York</option>
            <option value="America/Los_Angeles">America/Los_Angeles</option>
            <option value="Asia/Dubai">Asia/Dubai</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={loading} className="px-6 py-2 bg-[#FF5A5F] text-white font-medium rounded-lg hover:bg-[#e54a4f] disabled:opacity-50">
          {loading ? "Enregistrement…" : "Enregistrer"}
        </button>
        {saved && <span className="text-sm text-green-600">Modifications enregistrées ✓</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
