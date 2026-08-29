"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { ArrowLeft, Upload, RefreshCw } from "lucide-react";
import Link from "next/link";
import { PhotoUploadButton } from "@/components/photo-upload-button";

const PROPERTY_TYPES = [
  { value: "hotel", label: "Hôtel" },
  { value: "apartment", label: "Appartement" },
  { value: "house", label: "Maison" },
  { value: "villa", label: "Villa" },
  { value: "hostel", label: "Auberge" },
  { value: "resort", label: "Resort" },
  { value: "bnb", label: "B&B" },
  { value: "guesthouse", label: "Maison d'hôtes" },
  { value: "riad", label: "Riad" },
  { value: "camping", label: "Camping" },
];

const CANCELLATION_POLICIES = [
  { value: "free", label: "Annulation gratuite" },
  { value: "flexible", label: "Flexible (24h avant)" },
  { value: "moderate", label: "Modérée (5 jours avant)" },
  { value: "strict", label: "Stricte (14 jours avant)" },
  { value: "non_refundable", label: "Non remboursable" },
];

const AMENITIES = [
  { id: "wifi", label: "WiFi gratuit" },
  { id: "parking", label: "Parking" },
  { id: "pool", label: "Piscine" },
  { id: "spa", label: "Spa" },
  { id: "restaurant", label: "Restaurant" },
  { id: "bar", label: "Bar" },
  { id: "gym", label: "Salle de sport" },
  { id: "air_conditioning", label: "Climatisation" },
  { id: "room_service", label: "Room service" },
  { id: "concierge", label: "Conciergerie" },
  { id: "beach_access", label: "Accès plage" },
  { id: "garden", label: "Jardin" },
];

export default function NewPropertyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    type: "hotel",
    description: "",
    starRating: 3,
    addressLine: "",
    city: "",
    postalCode: "",
    country: "FR",
    cancellationPolicy: "flexible",
    petsAllowed: false,
    smokingAllowed: false,
    amenities: [] as string[],
    mainImage: "",
  });

  // T-113 : upload d'une photo via /api/properties/upload (image publique).
  // T-141 : déclenché par un bouton « Importer » (gestionnaire de fichiers de
  // la machine). Le champ URL reste disponible comme alternative.
  const handlePhotoUpload = async (file: File) => {
    if (!file) return;
    setUploadError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/properties/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Échec de l'upload");
      setFormData((prev) => ({ ...prev, mainImage: data.url }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Échec de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const handleAmenityToggle = (amenityId: string) => {
    setFormData((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(amenityId)
        ? prev.amenities.filter((a) => a !== amenityId)
        : [...prev.amenities, amenityId],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Une erreur est survenue");
        setLoading(false);
        return;
      }

      router.push(`/dashboard/properties/${data.property.id}`);
    } catch {
      setError("Une erreur est survenue");
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard/properties"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux hébergements
        </Link>
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Ajouter un hébergement
        </h1>
        <p className="text-gray-600 mt-1">
          Remplissez les informations de votre hébergement
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        )}

        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Informations générales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Nom de l'hébergement"
              placeholder="ex: Hôtel Le Magnifique"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Type d'hébergement"
                options={PROPERTY_TYPES}
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Classement (étoiles)
                </label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setFormData({ ...formData, starRating: star })}
                      className={`text-2xl transition-colors ${
                        star <= formData.starRating ? "text-[#F5A623]" : "text-gray-300"
                      }`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Textarea
              label="Description"
              placeholder="Décrivez votre hébergement..."
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader>
            <CardTitle>Localisation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Adresse"
              placeholder="ex: 15 Rue de Rivoli"
              value={formData.addressLine}
              onChange={(e) => setFormData({ ...formData, addressLine: e.target.value })}
            />

            <div className="grid grid-cols-3 gap-4">
              <Input
                label="Ville"
                placeholder="Paris"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                required
              />
              <Input
                label="Code postal"
                placeholder="75001"
                value={formData.postalCode}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              />
              <Select
                label="Pays"
                options={[
                  { value: "FR", label: "France" },
                  { value: "MA", label: "Maroc" },
                  { value: "TN", label: "Tunisie" },
                  { value: "ES", label: "Espagne" },
                  { value: "IT", label: "Italie" },
                  { value: "PT", label: "Portugal" },
                ]}
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        {/* Policies */}
        <Card>
          <CardHeader>
            <CardTitle>Politiques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              label="Politique d'annulation"
              options={CANCELLATION_POLICIES}
              value={formData.cancellationPolicy}
              onChange={(e) => setFormData({ ...formData, cancellationPolicy: e.target.value })}
            />

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.petsAllowed}
                  onChange={(e) => setFormData({ ...formData, petsAllowed: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Animaux acceptés</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.smokingAllowed}
                  onChange={(e) => setFormData({ ...formData, smokingAllowed: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Fumeurs acceptés</span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Amenities */}
        <Card>
          <CardHeader>
            <CardTitle>Équipements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {AMENITIES.map((amenity) => (
                <label
                  key={amenity.id}
                  className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.amenities.includes(amenity.id)
                      ? "border-[#1B3A6B] bg-[#1B3A6B]/5"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.amenities.includes(amenity.id)}
                    onChange={() => handleAmenityToggle(amenity.id)}
                    className="sr-only"
                  />
                  <span className="text-sm">{amenity.label}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Image */}
        <Card>
          <CardHeader>
            <CardTitle>Photo principale</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Téléverser une photo
              </label>
              <PhotoUploadButton
                onFile={handlePhotoUpload}
                loading={uploading}
                ariaLabel="Importer une photo depuis l'ordinateur"
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? "Téléversement…" : "Importer depuis l'ordinateur"}
              </PhotoUploadButton>
              <p id="photo-help" className="text-xs text-gray-500 mt-1">
                {uploading ? "Téléversement en cours…" : "JPEG, PNG, WebP ou GIF — 5 Mo max."}
              </p>
              {uploadError && <p className="text-sm text-red-600 mt-1">{uploadError}</p>}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400">ou</span>
            </div>

            <Input
              label="URL de l'image"
              placeholder="https://..."
              value={formData.mainImage}
              onChange={(e) => setFormData({ ...formData, mainImage: e.target.value })}
            />
            {formData.mainImage && (
              <div className="mt-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={formData.mainImage}
                  alt="Aperçu de la photo principale"
                  className="w-full max-w-md h-48 object-cover rounded-lg"
                />
                <div className="mt-2">
                  <PhotoUploadButton
                    variant="outline"
                    size="sm"
                    loading={uploading}
                    onFile={handlePhotoUpload}
                    ariaLabel="Changer la photo principale"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Changer l&apos;image
                  </PhotoUploadButton>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <Button type="submit" loading={loading} size="lg">
            Créer l&apos;hébergement
          </Button>
          <Link href="/dashboard/properties">
            <Button type="button" variant="ghost" size="lg">
              Annuler
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
