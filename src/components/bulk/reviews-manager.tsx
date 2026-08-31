"use client";

import { useT } from "@/components/ui-locale-provider";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Star, MessageSquare } from "lucide-react";
import { BulkToolbar, BulkIcons } from "./bulk-toolbar";
import { RowDeleteButton } from "./row-delete-button";
import { HostReplyForm } from "@/components/host-reply-form";
import { ReviewModerateActions } from "@/components/admin/review-moderate-actions";

export interface ReviewRow {
  review: {
    id: string;
    overallRating: string;
    cleanlinessRating: number | null;
    comfortRating: number | null;
    locationRating: number | null;
    staffRating: number | null;
    valueRating: number | null;
    positiveComment: string | null;
    negativeComment: string | null;
    travelerType: string | null;
    status: string | null;
    hostReply: string | null;
    createdAt: string;
  };
  property: {
    id: string;
    name: string | null;
    city: string | null;
  } | null;
  user: {
    firstName: string | null;
    lastName: string | null;
    country: string | null;
  } | null;
}

function ratingInfo(v: number, great: string, poor: string): { emoji: string; label: string } {
  if (v >= 9) return { emoji: "🌟", label: "Excellent" };
  if (v >= 8) return { emoji: "😊", label: great };
  if (v >= 7) return { emoji: "🙂", label: "Bien" };
  if (v >= 5) return { emoji: "😐", label: "Correct" };
  return { emoji: "😞", label: poor };
}

interface Props {
  reviews: ReviewRow[];
  isAdmin: boolean;
}

export function ReviewsManager({ reviews, isAdmin }: Props) {
  const t = useT();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return reviews.filter((r) => {
      const st = r.review.status ?? "pending";
      if (statusFilter !== "all" && st !== statusFilter) return false;
      if (!ql) return true;
      return (
        (r.property?.name ?? "").toLowerCase().includes(ql) ||
        (r.property?.city ?? "").toLowerCase().includes(ql) ||
        (r.user?.firstName ?? "").toLowerCase().includes(ql) ||
        (r.user?.lastName ?? "").toLowerCase().includes(ql) ||
        (r.review.positiveComment ?? "").toLowerCase().includes(ql) ||
        (r.review.negativeComment ?? "").toLowerCase().includes(ql)
      );
    });
  }, [reviews, q, statusFilter]);

  const allSelected =
    filtered.length > 0 && filtered.every((r) => selected.has(r.review.id));

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }
  function toggleAll() {
    if (allSelected) {
      const next = new Set(selected);
      for (const r of filtered) next.delete(r.review.id);
      setSelected(next);
    } else {
      const next = new Set(selected);
      for (const r of filtered) next.add(r.review.id);
      setSelected(next);
    }
  }

  const stats = useMemo(() => {
    const avg =
      reviews.length > 0
        ? reviews.reduce((s, r) => s + parseFloat(r.review.overallRating), 0) /
          reviews.length
        : 0;
    return {
      total: reviews.length,
      avg,
      pending: reviews.filter((r) => (r.review.status ?? "pending") === "pending").length,
      approved: reviews.filter((r) => r.review.status === "approved").length,
    };
  }, [reviews]);

  const bulkActions = isAdmin
    ? [
        { key: "approve", label: "Approuver", icon: BulkIcons.approve, variant: "primary" as const },
        { key: "hide", label: "Masquer", icon: BulkIcons.hide, variant: "secondary" as const },
        {
          key: "reject",
          label: "Rejeter",
          icon: BulkIcons.reject,
          variant: "danger" as const,
          confirmMessage: `Rejeter ${selected.size} avis ?`,
        },
      ]
    : [];

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card padding="sm">
          <div className="p-4">
            <p className="text-sm text-gray-500">Total avis</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
        </Card>
        <Card padding="sm">
          <div className="p-4">
            <p className="text-sm text-gray-500">Moyenne</p>
            <p className="text-2xl font-bold text-[#F5A623]">
              {stats.avg.toFixed(1)}/10
            </p>
          </div>
        </Card>
        <Card padding="sm">
          <div className="p-4">
            <p className="text-sm text-gray-500">En attente</p>
            <p className="text-2xl font-bold text-orange-600">{stats.pending}</p>
          </div>
        </Card>
        <Card padding="sm">
          <div className="p-4">
            <p className="text-sm text-gray-500">{t("bulk.approved")}</p>
            <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
          </div>
        </Card>
      </div>

      <BulkToolbar
        entity="reviews"
        selectedIds={Array.from(selected)}
        onClear={() => setSelected(new Set())}
        onSelectAll={() => setSelected(new Set(filtered.map((r) => r.review.id)))}
        onDeselectAll={() => setSelected(new Set())}
        searchValue={q}
        onSearchChange={setQ}
        searchPlaceholder={t("bulk.searchReviews")}
        statusOptions={[
          { value: "all", label: "Tous statuts" },
          { value: "pending", label: "En attente" },
          { value: "approved", label: t("bulk.approved") },
          { value: "hidden", label: t("bulk.hidden") },
          { value: "rejected", label: t("bulk.rejected") },
        ]}
        statusValue={statusFilter}
        onStatusChange={setStatusFilter}
        actions={bulkActions}
      />

      <p className="text-sm text-gray-600 mb-3">
        {(filtered.length > 1 ? t("bulk.reviewsShownMany") : t("bulk.reviewsShown")).replace("{n}", String(filtered.length))}
        {filtered.length !== reviews.length && ` ${t("bulk.ofTotal").replace("{n}", String(reviews.length))}`}
        {selected.size > 0 && t("bulk.selectedSuffix").replace("{n}", String(selected.size))}
      </p>

      {/* Sélection globale (top de liste) */}
      {isAdmin && filtered.length > 0 && (
        <div className="flex items-center gap-2 mb-3 pl-2">
          <input
            type="checkbox"
            id="reviews-select-all"
            checked={allSelected}
            onChange={toggleAll}
            className="w-4 h-4 rounded border-gray-300 text-[#1B3A6B] focus:ring-[#1B3A6B]"
          />
          <label htmlFor="reviews-select-all" className="text-sm text-gray-600">
{t("bulk.selectAllVisible")}
          </label>
        </div>
      )}

      <Card padding="none">
        {filtered.length === 0 ? (
          <EmptyState
            icon={<MessageSquare className="w-12 h-12 text-gray-300" />}
            title="Aucun avis"
            description={t("bulk.noReviewsDesc")}
          />
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((r) => {
              const rating = parseFloat(r.review.overallRating);
              const info = ratingInfo(rating, t("bulk.ratingGreat"), t("bulk.ratingPoor"));
              const st = r.review.status ?? "pending";
              const isSelected = selected.has(r.review.id);
              return (
                <div
                  key={r.review.id}
                  className={`p-6 ${isSelected ? "bg-blue-50/50" : ""}`}
                >
                  <div className="flex items-start gap-3">
                    {isAdmin && (
                      <input
                        type="checkbox"
                        aria-label={t("bulk.selectNamed").replace("{name}", r.review.id)}
                        checked={isSelected}
                        onChange={() => toggle(r.review.id)}
                        className="mt-2 w-4 h-4 rounded border-gray-300 text-[#1B3A6B] focus:ring-[#1B3A6B]"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#1B3A6B] flex items-center justify-center text-white font-medium">
                            {r.user?.firstName?.charAt(0) ?? "?"}
                            {r.user?.lastName?.charAt(0) ?? "?"}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {r.user?.firstName} {r.user?.lastName}
                            </p>
                            <p className="text-sm text-gray-500">
                              {r.review.travelerType && (
                                <span className="capitalize">{r.review.travelerType}</span>
                              )}
                              {r.user?.country && ` · ${r.user.country}`}
                              {` · ${new Date(r.review.createdAt).toLocaleDateString(
                                "fr-FR",
                                { day: "numeric", month: "short", year: "numeric" },
                              )}`}
                              {st !== "approved" && (
                                <span className="ml-2 px-2 py-0.5 text-xs rounded bg-orange-100 text-orange-700">
                                  {st}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 px-2 py-1 bg-[#1B3A6B] text-white font-semibold rounded">
                            <Star className="w-3 h-3 fill-current" />
                            {rating.toFixed(1)}
                          </div>
                          <span className="text-sm text-gray-600">
                            {info.emoji} {info.label}
                          </span>
                        </div>
                      </div>

                      <div className="mb-3">
                        <p className="text-sm text-gray-500">
                          {t("dash.colProperty")} :{" "}
                          <span className="font-medium text-gray-900">
                            {r.property?.name}
                          </span>{" "}
                          ({r.property?.city})
                        </p>
                      </div>

                      {r.review.positiveComment && (
                        <div className="mb-2 p-3 bg-green-50 rounded-lg">
                          <p className="text-sm text-gray-700">
                            <span className="text-green-600 font-medium">👍 Ce qui a plu :</span>{" "}
                            {r.review.positiveComment}
                          </p>
                        </div>
                      )}
                      {r.review.negativeComment && (
                        <div className="mb-2 p-3 bg-red-50 rounded-lg">
                          <p className="text-sm text-gray-700">
                            <span className="text-red-600 font-medium">{t("bulk.toImprove")}</span>{" "}
                            {r.review.negativeComment}
                          </p>
                        </div>
                      )}

                      {r.review.hostReply && (
                        <div className="mt-4 ml-6 p-3 bg-gray-50 border-l-4 border-[#1B3A6B] rounded-r-lg">
                          <p className="text-sm font-medium text-gray-700 mb-1">
                            {t("bulk.hostReply")}
                          </p>
                          <p className="text-sm text-gray-600">{r.review.hostReply}</p>
                        </div>
                      )}

                      {!isAdmin && (
                        <div className="mt-4">
                          <HostReplyForm
                            reviewId={r.review.id}
                            initialReply={r.review.hostReply}
                          />
                        </div>
                      )}
                      {isAdmin && (
                        <div className="flex items-start gap-2">
                          <ReviewModerateActions
                            reviewId={r.review.id}
                            currentStatus={st}
                          />
                          <RowDeleteButton
                            entity="reviews"
                            id={r.review.id}
                            label={`l'avis de ${r.user?.firstName ?? "l'utilisateur"} ${r.user?.lastName ?? ""}`.trim()}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <p className="text-xs text-gray-400 mt-3">
{t("bulk.shortcuts")} <kbd className="px-1 bg-gray-100 rounded">/</kbd> {t("bulk.shortcutSearch")} ·{" "}
        {isAdmin && (
          <>
            <kbd className="px-1 bg-gray-100 rounded">Ctrl+A</kbd> {t("bulk.shortcutSelectAll")} ·{" "}
          </>
        )}
        <kbd className="px-1 bg-gray-100 rounded">Esc</kbd> {t("bulk.shortcutClear")}
      </p>
    </div>
  );
}
