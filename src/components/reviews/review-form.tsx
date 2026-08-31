"use client";

import { useT } from "@/components/ui-locale-provider";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea, Select } from "@/components/ui/input";
// T-154d (audit n°26, P2-8) : feedback global via ToastProvider.
import { useToast } from "@/components/ui/toast";
// T-158 (audit n°29) : formulaire d'avis de la fiche propriété localisé
// (un compte EN ne doit plus voir de libellés FR).

/**
 * <ReviewForm /> (T-125, P4)
 * Formulaire de saisie d'avis. Le serveur a déjà vérifié que la réservation
 * existe, appartient bien à l'utilisateur et que le séjour est terminé
 * (garde RSC de la page). Ce composant se contente de soumettre l'avis.
 */
export function ReviewForm({ bookingId, requireModeration }: { bookingId: string; requireModeration: boolean }) {
  const router = useRouter();
  const { addToast } = useToast();
  const t = useT();
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
    { key: "cleanlinessRating", label: t("review.cleanliness") },
    { key: "comfortRating", label: t("review.comfort") },
    { key: "locationRating", label: t("review.location") },
    { key: "facilitiesRating", label: t("review.facilities") },
    { key: "staffRating", label: t("review.staff") },
    { key: "valueRating", label: t("review.value") },
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
      if (!response.ok) throw new Error(data.error ?? t("review.sendError"));
      addToast("success", requireModeration ? t("review.sentModerated") : t("review.sentPublished"));
      router.push("/mes-reservations");
      router.refresh();
    } catch (submissionError) {
      const message = submissionError instanceof Error ? submissionError.message : t("review.genericError");
      setError(message);
      addToast("error", message);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <Link href="/mes-reservations" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-4 h-4" /> {t("review.back")}
        </Link>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="w-5 h-5 text-[#F5A623]" />
              {t("review.title")}
            </CardTitle>
            <p className="text-sm text-gray-600">
              {requireModeration ? t("review.verifiedModerated") : t("review.verifiedImmediate")}
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={submitReview} className="space-y-5">
              {error && <p role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</p>}
              <label className="block">
                <span className="block text-sm font-medium text-gray-700 mb-2">{t("review.overall")} <strong>{rating}/10</strong></span>
                <input type="range" min="1" max="10" step="0.5" value={rating} onChange={(event) => setRating(Number(event.target.value))} className="w-full accent-[#1B3A6B]" />
              </label>

              <fieldset className="border-t border-gray-100 pt-4">
                <legend className="block text-sm font-medium text-gray-700 mb-3">
                  {t("review.subtitle")} <span className="text-gray-400 font-normal">{t("review.subtitleHint")}</span>
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
                          aria-label={`${t("review.ratingFor")} ${criterion.label}`}
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
                label={t("review.travelerType")}
                value={travelerType}
                onChange={(event) => setTravelerType(event.target.value)}
                options={[
                  { value: "leisure", label: t("review.traveler.leisure") },
                  { value: "solo", label: t("review.traveler.solo") },
                  { value: "couple", label: t("review.traveler.couple") },
                  { value: "family", label: t("review.traveler.family") },
                  { value: "group", label: t("review.traveler.group") },
                  { value: "business", label: t("review.traveler.business") },
                ]}
              />
              <Textarea label={t("review.positiveLabel")} value={positiveComment} onChange={(event) => setPositiveComment(event.target.value)} placeholder={t("review.positivePlaceholder")} rows={4} />
              <Textarea label={t("review.negativeLabel")} value={negativeComment} onChange={(event) => setNegativeComment(event.target.value)} placeholder={t("review.negativePlaceholder")} rows={3} />
              <Button type="submit" loading={loading} className="w-full">{t("review.publish")}</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
