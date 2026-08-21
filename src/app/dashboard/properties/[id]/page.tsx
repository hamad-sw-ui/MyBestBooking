"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Eye, Plus, Trash2, Star } from "lucide-react";
import Link from "next/link";

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
}

interface Room {
  id: string;
  name: string;
  roomType: string;
  maxOccupancy: number;
  basePrice: string;
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
                "bg-gray-100 text-gray-800"
              }>
                {property.status === "active" ? "Actif" : 
                 property.status === "pending" ? "En attente" : property.status}
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
          </div>
        </div>
      </div>

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
                      <p className="font-bold">€{parseFloat(room.basePrice).toFixed(0)}/nuit</p>
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
          <CardContent>
            <div className="space-y-4">
              <Input
                label="Photo principale (URL)"
                value={property.mainImage || ""}
                onChange={(e) => setProperty({ ...property, mainImage: e.target.value })}
              />
              {property.mainImage && (
                <img
                  src={property.mainImage}
                  alt="Preview"
                  className="w-full max-w-md h-48 object-cover rounded-lg"
                />
              )}
              <p className="text-sm text-gray-500">
                Ajoutez des URLs d&apos;images supplémentaires pour la galerie
              </p>
            </div>
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
