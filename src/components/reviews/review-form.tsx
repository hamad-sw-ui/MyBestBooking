"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea, Select } from "@/components/ui/input";

/**
 * <ReviewForm /> (T-125, P4)
 * Formulaire de saisie d'avis. Le serveur a déjà vérifié que la réservation
 * existe, appartient bien à l'utilisateur et que le séjour est terminé
 * (garde RSC de la page). Ce composant se contente de soumettre l'avis.
 */
export function ReviewForm({ bookingId, requireModeration }: { bookingId: string; requireModeration: boolean }) {
  const router = useRouter();
  const [rating, setRating] = useState(8);
  const [travelerType, setTravelerType] = useState("leisure");
  const [positiveComment, setPositiveComment] = useState("");
  const [negativeComment, setNegativeComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // T-115 : sous-notes par critère (champs optionnels côté API). Elles
  // suivent la note globale tant que l'utilisateur ne les affine pas, ce
  // qui rend la saisie non bloquante et conserve le comportement actuel.
  const SUB_RATINGS = [
    { key: "cleanlinessRating", label: "Propreté" },
    { key: "comfortRating", label: "Confort" },
    { key: "locationRating", label: "Emplacement" },
    { key: "facilitiesRating", label: "Équipements" },
    { key: "staffRating", label: "Accueil / service" },
    { key: "valueRating", label: "Rapport qualité-prix" },
  ] as const;
  const [subRatings, setSubRatings] = useState<Record<string, number>>({});
  const subRating = (key: string) => subRatings[key] ?? Math.round(rating);
  const setSubRating = (key: string, value: number) =>
    setSubRatings((prev) => ({ ...prev, [key]: Math.max(1, Math.min(10, Math.round(value))) }));

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          overallRating: rating,
          cleanlinessRating: subRating("cleanlinessRating"),
          comfortRating: subRating("comfortRating"),
          locationRating: subRating("locationRating"),
          facilitiesRating: subRating("facilitiesRating"),
          staffRating: subRating("staffRating"),
          valueRating: subRating("valueRating"),
          positiveComment: positiveComment || undefined,
          negativeComment: negativeComment || undefined,
          travelerType: travelerType === "leisure" ? undefined : travelerType,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Impossible d'envoyer votre avis");
      router.push("/mes-reservations");
      router.refresh();
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Erreur lors de l'envoi");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <Link href="/mes-reservations" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-4 h-4" /> Retour à mes réservations
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-[#F5A623]" />
              Partager votre expérience
            </CardTitle>
            <p className="text-sm text-gray-600">
              {requireModeration
                ? "Votre séjour est vérifié. Votre avis sera publié après modération."
                : "Votre séjour est déjà vérifié : votre avis sera publié immédiatement après envoi."}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitReview} className="space-y-5">
              {error && <p role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</p>}
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-2">Note globale : <strong>{rating}/10</strong></span>
                <input type="range" min="1" max="10" step="0.5" value={rating} onChange={(event) => setRating(Number(event.target.value))} className="w-full accent-[#1B3A6B]" />
              </label>

              <fieldset className="border-t border-gray-100 pt-4">
                <legend className="block text-sm font-medium text-gray-700 mb-3">
                  Notes par critère <span className="text-gray-400 font-normal">(facultatif — égales à la note globale par défaut)</span>
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  {SUB_RATINGS.map((criterion) => (
                    <label key={criterion.key} className="flex items-center justify-between gap-3">
                      <span className="text-sm text-gray-600">{criterion.label}</span>
                      <span className="flex items-center gap-2">
                        <input
                          type="range"
                          min="1"
                          max="10"
                          step="1"
                          value={subRating(criterion.key)}
                          onChange={(event) => setSubRating(criterion.key, Number(event.target.value))}
                          className="w-28 accent-[#1B3A6B]"
                          aria-label={`Note pour ${criterion.label}`}
                        />
                        <span className="w-8 text-right text-sm font-medium text-gray-900">
                          {subRating(criterion.key)}/10
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <Select
                label="Type de voyage"
                value={travelerType}
                onChange={(event) => setTravelerType(event.target.value)}
                options={[
                  { value: "leisure", label: "Loisirs" },
                  { value: "solo", label: "Solo" },
                  { value: "couple", label: "Couple" },
                  { value: "family", label: "Famille" },
                  { value: "group", label: "Groupe" },
                  { value: "business", label: "Affaires" },
                ]}
              />
              <Textarea label="Ce que vous avez aimé" value={positiveComment} onChange={(event) => setPositiveComment(event.target.value)} placeholder="Parlez de votre séjour..." rows={4} />
              <Textarea label="Ce qui pourrait être amélioré" value={negativeComment} onChange={(event) => setNegativeComment(event.target.value)} placeholder="Facultatif" rows={3} />
              <Button type="submit" loading={loading} className="w-full">Publier mon avis</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
