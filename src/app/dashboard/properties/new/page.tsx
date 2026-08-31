"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { ArrowLeft, Upload, RefreshCw } from "lucide-react";
import Link from "next/link";
import { PhotoUploadButton } from "@/components/photo-upload-button";
// T-154e (audit n°26, P3-13) : liste d'équipements harmonisée avec la
// recherche (28 valeurs, source unique au lieu de 12 locales).
import { AMENITIES } from "@/lib/amenities";
import { useT } from "@/components/ui-locale-provider";

export default function NewPropertyPage() {
  const t = useT();
  const router = useRouter();
  const PROPERTY_TYPES = [
    { value: "hotel", label: t("search.type.hotel") },
    { value: "apartment", label: t("search.type.apartment") },
    { value: "house", label: t("prop.type.house") },
    { value: "villa", label: t("search.type.villa") },
    { value: "hostel", label: t("search.type.hostel") },
    { value: "resort", label: t("search.type.resort") },
    { value: "bnb", label: t("prop.type.bnb") },
    { value: "guesthouse", label: t("search.type.guesthouse") },
    { value: "riad", label: t("search.type.riad") },
    { value: "camping", label: t("prop.type.camping") },
  ];
  const CANCELLATION_POLICIES = [
    { value: "free", label: t("prop.policyFree") },
    { value: "flexible", label: t("prop.policyFlexible") },
    { value: "moderate", label: t("prop.policyModerate") },
    { value: "strict", label: t("prop.policyStrict") },
    { value: "non_refundable", label: t("prop.policyNonRefundable") },
  ];
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
      if (!res.ok) throw new Error(data.error ?? t("account.uploadFail"));
      setFormData((prev) => ({ ...prev, mainImage: data.url }));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : t("account.uploadFail"));
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
        setError(data.error || t("auth.genericError"));
        setLoading(false);
        return;
      }

      router.push(`/dashboard/properties/${data.property.id}`);
    } catch {
      setError(t("auth.genericError"));
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
{t("prop.backToList")}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
{t("prop.addTitle")}
        </h1>
        <p className="text-gray-600 mt-1">
{t("prop.addSubtitle")}
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
<CardTitle>{t("prop.generalInfo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label={t("prop.name")}
              placeholder={t("prop.namePlaceholder")}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <Select
                label={t("prop.type")}
                options={PROPERTY_TYPES}
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
{t("prop.stars")}
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
              label={t("prop.description")}
              placeholder={t("prop.descPlaceholder")}
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </CardContent>
        </Card>

        {/* Location */}
        <Card>
          <CardHeader>
<CardTitle>{t("prop.location")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label={t("prop.address")}
              placeholder="ex: 15 Rue de Rivoli"
              value={formData.addressLine}
              onChange={(e) => setFormData({ ...formData, addressLine: e.target.value })}
            />

            <div className="grid grid-cols-3 gap-4">
              <Input
                label={t("prop.city")}
                placeholder="Paris"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                required
              />
              <Input
                label={t("prop.postal")}
                placeholder="75001"
                value={formData.postalCode}
                onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
              />
              <Select
                label={t("prop.country")}
                options={[
{ value: "FR", label: t("prop.country.FR") },
{ value: "MA", label: t("prop.country.MA") },
{ value: "TN", label: t("prop.country.TN") },
{ value: "ES", label: t("prop.country.ES") },
{ value: "IT", label: t("prop.country.IT") },
{ value: "PT", label: t("prop.country.PT") },
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
<CardTitle>{t("property.policies")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              label={t("prop.cancelPolicy")}
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
<span className="text-sm text-gray-700">{t("prop.pets")}</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.smokingAllowed}
                  onChange={(e) => setFormData({ ...formData, smokingAllowed: e.target.checked })}
                  className="rounded border-gray-300"
                />
<span className="text-sm text-gray-700">{t("prop.smoking")}</span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Amenities */}
        <Card>
          <CardHeader>
<CardTitle>{t("prop.amenities")}</CardTitle>
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
<CardTitle>{t("prop.mainPhotoTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
{t("prop.uploadPhoto")}
              </label>
              <PhotoUploadButton
                onFile={handlePhotoUpload}
                loading={uploading}
                ariaLabel={t("prop.importAria")}
              >
                <Upload className="w-4 h-4 mr-2" />
{uploading ? t("account.uploading") : t("account.importFromComputer")}
              </PhotoUploadButton>
              <p id="photo-help" className="text-xs text-gray-500 mt-1">
{uploading ? t("prop.uploadingHint") : t("prop.uploadHint")}
              </p>
              {uploadError && <p className="text-sm text-red-600 mt-1">{uploadError}</p>}
            </div>

            <div className="flex items-center gap-3">
<span className="text-xs text-gray-400">{t("prop.or")}</span>
            </div>

            <Input
              label={t("prop.imageUrl")}
              placeholder="https://..."
              value={formData.mainImage}
              onChange={(e) => setFormData({ ...formData, mainImage: e.target.value })}
            />
            {formData.mainImage && (
              <div className="mt-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={formData.mainImage}
                  alt={t("prop.photoPreview")}
                  className="w-full max-w-md h-48 object-cover rounded-lg"
                />
                <div className="mt-2">
                  <PhotoUploadButton
                    variant="outline"
                    size="sm"
                    loading={uploading}
                    onFile={handlePhotoUpload}
                    ariaLabel={t("prop.changeAria")}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
{t("prop.changeImage")}
                  </PhotoUploadButton>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex items-center gap-4">
          <Button type="submit" loading={loading} size="lg">
{t("prop.create")}
          </Button>
          <Link href="/dashboard/properties">
            <Button type="button" variant="ghost" size="lg">
{t("action.cancel")}
            </Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
