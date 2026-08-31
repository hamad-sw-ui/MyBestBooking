import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(
  amount: number | string,
  currency: string = "EUR",
  locale: string = "fr-FR",
): string {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "currency",
    currency,
  }).format(numAmount);
}

/** BCP-47 tag for Intl date format from the UI locale (`fr` | `en`). */
export function intlLocale(ui?: string | null): string {
  return ui === "en" || (ui ?? "").toLowerCase().startsWith("en") ? "en-GB" : "fr-FR";
}

export function formatDate(
  date: Date | string,
  options?: Intl.DateTimeFormatOptions,
  locale: string = "fr-FR",
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...options,
  }).format(d);
}

export function formatDateShort(date: Date | string, locale: string = "fr-FR"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    day: "numeric",
    month: "short",
  }).format(d);
}

export function generateBookingReference(): string {
  const year = new Date().getFullYear();
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `MBB-${year}-${code}`;
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function getRatingLabel(rating: number, locale: string = "fr"): { label: string; emoji: string } {
  const en = locale === "en" || locale.startsWith("en");
  if (rating >= 9) return { label: en ? "Exceptional" : "Exceptionnel", emoji: "🏆" };
  if (rating >= 8) return { label: en ? "Superb" : "Superbe", emoji: "⭐" };
  if (rating >= 7) return { label: en ? "Good" : "Bien", emoji: "👍" };
  if (rating >= 6) return { label: en ? "Pleasant" : "Agréable", emoji: "🙂" };
  if (rating >= 5) return { label: en ? "Fair" : "Correct", emoji: "😐" };
  return { label: en ? "Needs improvement" : "À améliorer", emoji: "⚠️" };
}

export function getPropertyTypeLabel(type: string, locale: string = "fr"): string {
  const fr: Record<string, string> = {
    hotel: "Hôtel",
    apartment: "Appartement",
    house: "Maison",
    villa: "Villa",
    hostel: "Auberge",
    resort: "Resort",
    bnb: "B&B",
    guesthouse: "Maison d'hôtes",
    riad: "Riad",
    camping: "Camping",
  };
  const en: Record<string, string> = {
    hotel: "Hotel",
    apartment: "Apartment",
    house: "House",
    villa: "Villa",
    hostel: "Hostel",
    resort: "Resort",
    bnb: "B&B",
    guesthouse: "Guesthouse",
    riad: "Riad",
    camping: "Camping",
  };
  const types = locale === "en" || locale.startsWith("en") ? en : fr;
  return types[type] || type;
}

export function getStatusBadgeColor(status: string): string {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    confirmed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
    completed: "bg-blue-100 text-blue-800",
    no_show: "bg-gray-100 text-gray-800",
    active: "bg-green-100 text-green-800",
    draft: "bg-gray-100 text-gray-800",
    suspended: "bg-red-100 text-red-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

export function calculateNights(checkIn: Date | string, checkOut: Date | string): number {
  const start = typeof checkIn === "string" ? new Date(checkIn) : checkIn;
  const end = typeof checkOut === "string" ? new Date(checkOut) : checkOut;
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
