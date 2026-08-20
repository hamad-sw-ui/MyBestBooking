import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number | string, currency: string = "EUR"): string {
  const numAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
  }).format(numAmount);
}

export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...options,
  }).format(d);
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("fr-FR", {
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

export function getRatingLabel(rating: number): { label: string; emoji: string } {
  if (rating >= 9) return { label: "Exceptionnel", emoji: "🏆" };
  if (rating >= 8) return { label: "Superbe", emoji: "⭐" };
  if (rating >= 7) return { label: "Bien", emoji: "👍" };
  if (rating >= 6) return { label: "Agréable", emoji: "🙂" };
  if (rating >= 5) return { label: "Correct", emoji: "😐" };
  return { label: "À améliorer", emoji: "⚠️" };
}

export function getPropertyTypeLabel(type: string): string {
  const types: Record<string, string> = {
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
