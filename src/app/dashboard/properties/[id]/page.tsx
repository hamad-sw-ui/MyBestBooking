"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Eye, Plus, Trash2, Star, Upload, RefreshCw } from "lucide-react";
import Link from "next/link";
import { PropertySubmitButton } from "@/components/property-submit-button";
import { PhotoUploadButton } from "@/components/photo-upload-button";
import { formatPrice } from "@/lib/utils";
// T-154e (audit n°26, P3-13) : liste d'équipements harmonisée.
import { AMENITIES } from "@/lib/amenities";

interface Property {
  id: string;
  name: string;
  slug: string;
  type: string;
  description: string | null;
  starRating: number | null;
  addressLine: string | null;
  city: string;
  postalCode: string | null;
  country: string;
  cancellationPolicy: string | null;
  petsAllowed: boolean | null;
  smokingAllowed: boolean | null;
  amenities: string[];
  mainImage: string | null;
  images: string[];
  status: string | null;
  averageRating: string | null;
  totalReviews: number | null;
  // T-145 : commission spécifique à l'hébergement (admin uniquement).
  commissionRate?: string | null;
}

interface Room {
  id: string;
  name: string;
  roomType: string;
  maxOccupancy: number;
  basePrice: string;
  // T-153 (audit n°25, E) : devise réelle de la chambre (affichage).
  currency?: string;
  quantity: number;
  isActive: boolean;
}

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

export default function EditPropertyPage() {
  const router = useRouter();
  const params = useParams();
  const propertyId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [property, setProperty] = useState<Property | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeTab, setActiveTab] = useState("general");
  // T-130 : upload de photos dans l'édition (réutilise POST /api/properties/upload).
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  // T-145 : seul un admin peut modifier la commission de l'hébergement.
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setIsAdmin(data?.user?.role === "admin"))
      .catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    fetch(`/api/properties/${propertyId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.property) {
          setProperty({
            ...data.property,
            amenities: data.property.amenities || [],
            images: data.property.images || [],
          });
          setRooms(data.rooms || []);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Erreur lors du chargement");
        setLoading(false);
      });
  }, [propertyId]);

  const handleSave = async () => {
    if (!property) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/properties/${propertyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: property.name,
          type: property.type,
          description: property.description,
          starRating: property.starRating,
          addressLine: property.addressLine,
          city: property.city,
          postalCode: property.postalCode,
          country: property.country,
          cancellationPolicy: property.cancellationPolicy,
          petsAllowed: property.petsAllowed,
          smokingAllowed: property.smokingAllowed,
          amenities: property.amenities,
          mainImage: property.mainImage,
          images: property.images,
          // T-145 : la commission n'est envoyée que par un admin (l'API
          // ignore/refuse ce champ pour un hôte) ; on ne l'envoie que si admin.
          ...(isAdmin ? { commissionRate: property.commissionRate ?? "15" } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Erreur lors de la sauvegarde");
      } else {
        setSuccess("Modifications enregistrées");
        setProperty(data.property);
      }
    } catch {
      setError("Erreur lors de la sauvegarde");
    }

    setSaving(false);
  };

  const handleAmenityToggle = (amenityId: string) => {
    if (!property) return;
    setProperty({
      ...property,
      amenities: property.amenities.includes(amenityId)
        ? property.amenities.filter((a) => a !== amenityId)
        : [...property.amenities, amenityId],
    });
  };

  // T-130 : upload d'une photo dans l'édition (même endpoint qu'à la création).
  // T-141 : refactorisé pour servir aussi bien l'ajout que le remplacement
  // (« Changer » une photo existante) depuis le gestionnaire de fichiers.
  const uploadPhoto = async (file: File, replaceUrl?: string) => {
    if (!property) return;
    setUploadError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/properties/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Échec de l'upload");
      setProperty((prev) => {
        if (!prev) return prev;
        if (replaceUrl) {
          // Remplacement : on échange l'ancienne URL par la nouvelle, sans
          // toucher à l'ordre ni au statut « principale ».
          const images = prev.images.map((img) => (img === replaceUrl ? data.url : img));
          return {
            ...prev,
            images,
            mainImage: prev.mainImage === replaceUrl ? data.url : prev.mainImage,
          };
        }
        const images = prev.images.includes(data.url) ? prev.images : [...prev.images, data.url];
        return { ...prev, mainImage: prev.mainImage ?? data.url, images };
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Échec de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const addGalleryImage = (url: string) => {
    if (!property || !url.trim()) return;
    const value = url.trim();
    setProperty((prev) => prev
      ? { ...prev, images: prev.images.includes(value) ? prev.images : [...prev.images, value] }
      : prev);
  };

  const removeGalleryImage = (url: string) => {
    if (!property) return;
    setProperty((prev) => {
      if (!prev) return prev;
      const images = prev.images.filter((img) => img !== url);
      return { ...prev, images, mainImage: prev.mainImage === url ? (images[0] ?? null) : prev.mainImage };
    });
  };

  const setMainImage = (url: string) => {
    if (!property) return;
    setProperty((prev) => prev ? { ...prev, mainImage: url } : prev);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B3A6B]"></div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Hébergement non trouvé</p>
        <Link href="/dashboard/properties">
          <Button variant="outline" className="mt-4">Retour</Button>
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: "general", label: "Informations" },
    { id: "rooms", label: `Chambres (${rooms.length})` },
    { id: "photos", label: "Photos" },
    { id: "policies", label: "Politiques" },
  ];

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Link
          href="/dashboard/properties"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux hébergements
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
                {property.name}
              </h1>
              <Badge className={
                property.status === "active" ? "bg-green-100 text-green-800" :
                property.status === "pending" ? "bg-yellow-100 text-yellow-800" :
                property.status === "suspended" ? "bg-red-100 text-red-800" :
                "bg-gray-100 text-gray-800"
              }>
                {property.status === "active" ? "Actif" :
                 property.status === "pending" ? "En attente de validation" :
                 property.status === "suspended" ? "Suspendu" :
                 property.status === "draft" ? "Brouillon / rejeté" :
                 property.status === "archived" ? "Archivé" : property.status}
              </Badge>
            </div>
            {property.averageRating && (
              <div className="flex items-center gap-2 mt-2">
                <Star className="w-4 h-4 text-[#F5A623] fill-current" />
                <span className="font-medium">{parseFloat(property.averageRating).toFixed(1)}</span>
                <span className="text-gray-500">({property.totalReviews} avis)</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Link href={`/hebergement/${property.slug}`} target="_blank">
              <Button variant="outline">
                <Eye className="w-4 h-4 mr-2" />
                Voir la fiche
              </Button>
            </Link>
            <Button onClick={handleSave} loading={saving}>
              <Save className="w-4 h-4 mr-2" />
              Enregistrer
            </Button>
            {/* T-137 (A2) : re-soumission après rejet (draft) ou suspension. */}
            <PropertySubmitButton propertyId={property.id} currentStatus={property.status} />
          </div>
        </div>
      </div>

      {/* T-137 (A2) : explique à l'hôte pourquoi son annonce n'est pas publique
          et comment la re-soumettre (auparavant, une annonce rejetée restait
          bloquée en brouillon sans action possible). */}
      {(property.status === "draft" || property.status === "suspended") && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-sm">
          {property.status === "draft"
            ? "Votre annonce a été rejetée ou est en brouillon : elle n'est pas visible du public. Corrigez les informations puis « Soumettre pour validation »."
            : "Votre annonce est suspendue et n'est plus visible du public. Corrigez les points demandés puis « Soumettre pour validation »."}
        </div>
      )}

      {/* Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-600">
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab.id
                ? "border-[#1B3A6B] text-[#1B3A6B]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "general" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations générales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Nom de l'hébergement"
                value={property.name}
                onChange={(e) => setProperty({ ...property, name: e.target.value })}
              />

              <div className="grid grid-cols-2 gap-4">
                <Select
                  label="Type d'hébergement"
                  options={PROPERTY_TYPES}
                  value={property.type}
                  onChange={(e) => setProperty({ ...property, type: e.target.value })}
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
                        onClick={() => setProperty({ ...property, starRating: star })}
                        className={`text-2xl transition-colors ${
                          star <= (property.starRating || 0) ? "text-[#F5A623]" : "text-gray-300"
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
                rows={4}
                value={property.description || ""}
                onChange={(e) => setProperty({ ...property, description: e.target.value })}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Localisation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Adresse"
                value={property.addressLine || ""}
                onChange={(e) => setProperty({ ...property, addressLine: e.target.value })}
              />

              <div className="grid grid-cols-3 gap-4">
                <Input
                  label="Ville"
                  value={property.city}
                  onChange={(e) => setProperty({ ...property, city: e.target.value })}
                />
                <Input
                  label="Code postal"
                  value={property.postalCode || ""}
                  onChange={(e) => setProperty({ ...property, postalCode: e.target.value })}
                />
                <Select
                  label="Pays"
                  options={[
                    { value: "FR", label: "France" },
                    { value: "MA", label: "Maroc" },
                    { value: "TN", label: "Tunisie" },
                    { value: "ES", label: "Espagne" },
                    { value: "IT", label: "Italie" },
                  ]}
                  value={property.country}
                  onChange={(e) => setProperty({ ...property, country: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

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
                      property.amenities.includes(amenity.id)
                        ? "border-[#1B3A6B] bg-[#1B3A6B]/5"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={property.amenities.includes(amenity.id)}
                      onChange={() => handleAmenityToggle(amenity.id)}
                      className="sr-only"
                    />
                    <span className="text-sm">{amenity.label}</span>
                  </label>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* T-145 : commission spécifique à l'hébergement (admin uniquement).
              Un hôte ne voit pas ce champ et ne peut pas modifier son taux. */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Commission plateforme</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="max-w-xs">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Taux de commission (%)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={property.commissionRate ?? "15"}
                      onChange={(e) => setProperty({ ...property, commissionRate: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
                    />
                    <span className="text-gray-500">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Prélevé sur chaque réservation. Par défaut : le taux global
                    défini dans les réglages admin. Le net versé à l&apos;hôte =
                    total − commission.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "rooms" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Chambres</CardTitle>
              <Link href="/dashboard/rooms/new">
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter une chambre
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {rooms.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>Aucune chambre configurée</p>
                <Link href="/dashboard/rooms/new">
                  <Button variant="outline" className="mt-4">
                    <Plus className="w-4 h-4 mr-2" />
                    Ajouter une chambre
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {rooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{room.name}</p>
                      <p className="text-sm text-gray-500">
                        {room.maxOccupancy} pers. max • {room.quantity} unité{room.quantity > 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="font-bold">{formatPrice(parseFloat(room.basePrice), room.currency ?? "EUR")}/nuit</p>
                      <Link href={`/dashboard/rooms/${room.id}/calendrier`}>
                        <Button variant="ghost" size="sm">
                          Calendrier
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "photos" && (
        <Card>
          <CardHeader>
            <CardTitle>Photos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Import d'une photo depuis le gestionnaire de fichiers de la
                machine (même mécanisme d'upload qu'à la création, T-113). */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ajouter une photo
              </label>
              <PhotoUploadButton
                onFile={(file) => uploadPhoto(file)}
                loading={uploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? "Téléversement…" : "Importer depuis l'ordinateur"}
              </PhotoUploadButton>
              <p className="text-xs text-gray-500 mt-1">
                {uploading
                  ? "Téléversement en cours…"
                  : "JPEG, PNG, WebP ou GIF — 5 Mo max. La nouvelle photo est enregistrée quand vous cliquez sur « Enregistrer »."}
              </p>
              {uploadError && <p className="text-sm text-red-600 mt-1">{uploadError}</p>}
            </div>

            {/* Galerie */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">
                Galerie ({property.images.length} photo{property.images.length > 1 ? "s" : ""})
              </p>
              {property.images.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Aucune photo. Uploadez une image ci-dessus ou ajoutez une URL plus bas.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {property.images.map((url) => {
                    const isMain = property.mainImage === url;
                    return (
                      <div key={url} className="relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt="" className="w-full h-32 object-cover rounded-lg border" />
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 px-2 py-1 bg-black/50 rounded-b-lg">
                          <button
                            type="button"
                            onClick={() => setMainImage(url)}
                            disabled={isMain}
                            className={`text-xs font-medium ${isMain ? "text-[#F5A623]" : "text-white hover:underline"}`}
                          >
                            {isMain ? "★ Principale" : "Définir principale"}
                          </button>
                          <div className="flex items-center gap-1">
                            {/* T-141 : remplacer directement cette photo depuis
                                le gestionnaire de fichiers (sans supprimer/ré-ajouter). */}
                            <PhotoUploadButton
                              variant="ghost"
                              size="sm"
                              loading={uploading}
                              onFile={(file) => uploadPhoto(file, url)}
                              className="text-white hover:bg-white/10 hover:text-white p-1.5"
                              title="Changer cette image"
                              ariaLabel={`Changer l'image de la position ${property.images.indexOf(url) + 1}`}
                            >
                              <RefreshCw className="w-4 h-4" />
                            </PhotoUploadButton>
                            <button
                              type="button"
                              onClick={() => removeGalleryImage(url)}
                              className="text-white hover:text-red-300 p-1.5"
                              aria-label="Supprimer cette photo"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* URL alternative */}
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-600 hover:text-[#1B3A6B]">
                Ou ajouter une photo par URL
              </summary>
              <div className="flex gap-2 mt-3">
                <input
                  type="url"
                  placeholder="https://…/photo.jpg"
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addGalleryImage((e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = "";
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={(e) => {
                    const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                    addGalleryImage(input.value);
                    input.value = "";
                  }}
                >
                  Ajouter
                </Button>
              </div>
            </details>
          </CardContent>
        </Card>
      )}

      {activeTab === "policies" && (
        <Card>
          <CardHeader>
            <CardTitle>Politiques</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select
              label="Politique d'annulation"
              options={[
                { value: "free", label: "Annulation gratuite" },
                { value: "flexible", label: "Flexible (24h avant)" },
                { value: "moderate", label: "Modérée (5 jours avant)" },
                { value: "strict", label: "Stricte (14 jours avant)" },
                { value: "non_refundable", label: "Non remboursable" },
              ]}
              value={property.cancellationPolicy || "flexible"}
              onChange={(e) => setProperty({ ...property, cancellationPolicy: e.target.value })}
            />

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={property.petsAllowed || false}
                  onChange={(e) => setProperty({ ...property, petsAllowed: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Animaux acceptés</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={property.smokingAllowed || false}
                  onChange={(e) => setProperty({ ...property, smokingAllowed: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700">Fumeurs acceptés</span>
              </label>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
