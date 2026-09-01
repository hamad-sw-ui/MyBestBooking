/**
 * T-022 — Câblage du mode maintenance.
 *
 * Le paramètre `security.maintenanceMode` est enregistrable via T-021.
 * Ce module le rend effectif :
 *   - `isMaintenanceActive()` lit le settings (cache 60 s).
 *   - `assertNotMaintenance(user)` throw MaintenanceError si actif
 *     ET user non admin.
 *   - `shouldBypassMaintenance(pathname)` — whitelist déterministe
 *     (aucune lecture DB) des routes toujours ouvertes.
 *     Anti-lockout admin : /connexion, /api/auth/*, /api/admin/*,
 *     /maintenance, /_next/*, /favicon.ico, /robots.txt, /sitemap.xml.
 */

import { NextResponse } from "next/server";
import { apiError } from "./api-error";
import { getSetting } from "./settings";

export class MaintenanceError extends Error {
  code = "MAINTENANCE_MODE" as const;
  retryAfterSeconds: number;
  constructor(retryAfterSeconds = 60) {
    super("Service en maintenance");
    this.retryAfterSeconds = retryAfterSeconds;
    this.name = "MaintenanceError";
  }
}

export async function isMaintenanceActive(): Promise<boolean> {
  const security = await getSetting("security");
  return security.maintenanceMode === true;
}

/**
 * Throw MaintenanceError si le mode maintenance est actif ET que l'user
 * n'est pas admin. À appeler en tête des handlers API métier.
 */
export async function assertNotMaintenance(
  user: { role?: string | null } | null,
): Promise<void> {
  if (user && user.role === "admin") return;
  const active = await isMaintenanceActive();
  if (active) throw new MaintenanceError(60);
}

/**
 * Réponse HTTP 503 standard pour un handler bloqué par le mode
 * maintenance.
 */
export async function maintenanceResponse(retryAfterSeconds = 60): Promise<NextResponse> {
  return NextResponse.json(
    {
      error: await apiError("Service momentanément en maintenance"),
      code: "MAINTENANCE_MODE",
    },
    {
      status: 503,
      headers: { "Retry-After": String(retryAfterSeconds) },
    },
  );
}

/**
 * Whitelist déterministe des chemins toujours ouverts pendant le mode
 * maintenance. Aucune lecture DB, aucune dépendance runtime.
 */
export function shouldBypassMaintenance(pathname: string): boolean {
  if (!pathname) return true;
  // API critiques anti-lockout
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname.startsWith("/api/admin/")) return true;
  if (pathname.startsWith("/api/health")) return true;
  // Pages hors maintenance
  if (pathname === "/maintenance") return true;
  if (pathname === "/connexion") return true;
  if (pathname === "/inscription") return true; // laissé ouvert : un admin
  // Assets Next.js
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/uploads/")) return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/robots.txt") return true;
  if (pathname === "/sitemap.xml") return true;
  return false;
}
