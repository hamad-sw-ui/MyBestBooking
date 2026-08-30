"use client";

import { useEffect } from "react";
import { chooseMaintenanceGate } from "@/lib/maintenance-gate";

/**
 * T-128 (audit n°8, P1) — garde « page de maintenance » côté client.
 *
 * Au montage (donc y compris sur un chargement direct / rechargement / lien
 * externe), interroge l'état public de maintenance. Si le mode est actif et
 * que l'utilisateur n'est pas admin et n'est pas déjà sur une page
 * autorisée (/maintenance, auth, assets…), on force la navigation vers
 * /maintenance via `window.location.replace` (remplace l'entrée d'historique,
 * évite « retour » vers une page en maintenance).
 *
 * Ce composant ne rend rien et n'a aucun effet quand le mode est inactif :
 * il est neutre pour le fonctionnement normal du site.
 */
export function MaintenanceGate({ isAdmin = false }: { isAdmin?: boolean }) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/maintenance-status", { cache: "no-store" });
        if (!res.ok) return; // ne jamais bloquer le site si la sonde échoue
        const data = (await res.json()) as { active?: boolean };
        if (cancelled) return;
        const pathname = window.location.pathname;
        if (chooseMaintenanceGate(data.active === true, isAdmin, pathname)) {
          window.location.replace("/maintenance");
        }
      } catch {
        // Réseau/erreur : on reste sur la page (les écritures API restent
        // bloquées par le serveur de toute façon). Pas d'effet de bord.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  return null;
}
