"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { useDisplayPreferences } from "@/lib/use-display-currency";
import { makeT } from "@/lib/ui-strings";
import { PhotoUploadButton } from "@/components/photo-upload-button";

interface Props {
  initial: {
    firstName: string;
    lastName: string;
    phone: string | null;
    country: string | null;
    language: string | null;
    currency: string | null;
    timezone?: string | null;
    // T-133 (A4) : photo de profil (URL), optionnelle.
    avatarUrl?: string | null;
  };
}

/**
 * Formulaire d'édition du profil courant (T-016).
 * PATCH /api/users/me
 */
export function ProfileForm({ initial }: Props) {
  const router = useRouter();
  const { language } = useDisplayPreferences();
  const t = makeT(language);
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
    // T-133 (A4) : URL de la photo de profil (vide = aucune / initiales).
    avatarUrl: initial.avatarUrl ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // T-145 : import d'une photo de profil depuis le gestionnaire de fichiers.
  const [avatarUploading, setAvatarUploading] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  }

  // T-145 : import direct d'un avatar (image publique). L'API persiste
  // `users.avatarUrl` immédiatement ; on synchronise aussi le champ URL pour
  // que la valeur reste cohérente si l'utilisateur enregistre ensuite.
  async function handleAvatarFile(file: File) {
    setError(null);
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/users/me/avatar", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Échec de l'upload");
      setForm((f) => ({ ...f, avatarUrl: data.url ?? "" }));
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec de l'upload");
    } finally {
      setAvatarUploading(false);
    }
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
      // T-133 (A4) : photo de profil. Une URL non valide est rejetée par
      // l'API (z.string().url()) ; on envoie null quand le champ est vide
      // pour permettre de retirer la photo.
      body.avatarUrl = form.avatarUrl.trim() ? form.avatarUrl.trim() : null;
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
          <label htmlFor="pf-first" className="block text-sm font-medium text-gray-700 mb-1">{t("auth.firstName")}</label>
          <input id="pf-first" required minLength={2} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]" />
        </div>
        <div>
          <label htmlFor="pf-last" className="block text-sm font-medium text-gray-700 mb-1">{t("auth.lastName")}</label>
          <input id="pf-last" required minLength={2} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]" />
        </div>
        <div>
          <label htmlFor="pf-phone" className="block text-sm font-medium text-gray-700 mb-1">{t("account.phone")}</label>
          <input id="pf-phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+33 6 00 00 00 00" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]" />
        </div>
        <div>
          <label htmlFor="pf-country" className="block text-sm font-medium text-gray-700 mb-1">{t("account.country")}</label>
          <input id="pf-country" maxLength={2} value={form.country} onChange={(e) => set("country", e.target.value.toUpperCase())} placeholder="FR" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]" />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="pf-avatar" className="block text-sm font-medium text-gray-700 mb-1">{t("account.avatar")}</label>
          <div className="flex items-center gap-3 flex-wrap">
            <PhotoUploadButton
              variant="outline"
              size="sm"
              loading={avatarUploading}
              onFile={handleAvatarFile}
              ariaLabel="Importer une photo de profil depuis l'ordinateur"
            >
              <Upload className="w-4 h-4 mr-2" />
              {avatarUploading ? "Téléversement…" : "Importer depuis l'ordinateur"}
            </PhotoUploadButton>
            {form.avatarUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.avatarUrl} alt="Aperçu de la photo de profil" className="w-12 h-12 rounded-full object-cover border border-gray-200" />
            )}
          </div>
          <input id="pf-avatar" type="url" value={form.avatarUrl} onChange={(e) => set("avatarUrl", e.target.value)} placeholder="https://…/photo.jpg" className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]" />
          <p className="mt-1 text-xs text-gray-400">Importez une image (JPEG, PNG, WebP ou GIF, 5 Mo max) ou collez une URL. {t("account.avatarHint")}</p>
        </div>
        <div>
          <label htmlFor="pf-lang" className="block text-sm font-medium text-gray-700 mb-1">{t("account.language")}</label>
          <select id="pf-lang" value={form.language} onChange={(e) => set("language", e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]">
            <option value="fr">Français</option>
            <option value="en">English</option>
          </select>
          {/* T-132/T-145 : seuls le français et l'anglais sont des langues
              d'interface traduites (UiLocale = fr|en). */}
          <p className="mt-1 text-xs text-gray-400">Applique les libellés traduits et les descriptions en anglais.</p>
        </div>
        <div>
          <label htmlFor="pf-currency" className="block text-sm font-medium text-gray-700 mb-1">{t("account.currency")}</label>
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
          <label htmlFor="pf-tz" className="block text-sm font-medium text-gray-700 mb-1">{t("account.timezone")}</label>
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
          {loading ? t("action.loading") : t("action.save")}
        </button>
        {saved && <span className="text-sm text-green-600">Modifications enregistrées ✓</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </form>
  );
}
