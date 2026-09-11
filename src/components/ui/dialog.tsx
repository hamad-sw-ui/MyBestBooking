"use client";

import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Titre accessible (aussi utilisé comme `aria-labelledby`). */
  title: string;
  /** Description optionnelle (`aria-describedby`). */
  description?: string;
  /** Libellé du bouton de fermeture (icône croix). */
  closeLabel?: string;
  /** `false` = la fermeture par Échap / clic extérieur est neutralisée. */
  dismissible?: boolean;
  className?: string;
  children?: ReactNode;
  footer?: ReactNode;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * T-247 (audit n°5, A3) — dialogue réutilisable, sans dépendance externe.
 *
 * Remplace les `window.prompt` natifs des écrans d'administration : mêmes
 * garanties d'accessibilité qu'un dialogue applicatif (`role="dialog"`,
 * `aria-modal`, titre lié, focus piégé, retour du focus à l'élément d'origine)
 * et fermeture maîtrisée (`Esc`, croix, clic extérieur sauf `dismissible=false`).
 * Aucun rendu SSR : tant que `open` est faux, rien n'est monté.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  closeLabel = "Fermer",
  dismissible = true,
  className,
  children,
  footer,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);

  const close = useCallback(() => {
    if (dismissible) onClose();
  }, [dismissible, onClose]);

  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
    // Le premier champ (motif) reçoit le focus : l'admin peut taper tout de suite.
    (first ?? panelRef.current)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (nodes.length === 0) return;
      const firstNode = nodes[0]!;
      const lastNode = nodes[nodes.length - 1]!;
      if (event.shiftKey && document.activeElement === firstNode) {
        event.preventDefault();
        lastNode.focus();
      } else if (!event.shiftKey && document.activeElement === lastNode) {
        event.preventDefault();
        firstNode.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      const opener = openerRef.current;
      if (opener instanceof HTMLElement && document.contains(opener)) opener.focus();
    };
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
      onClick={dismissible ? close : undefined}
    >
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "relative w-full max-w-md rounded-xl bg-white shadow-xl outline-none",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-gray-900">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="mt-1 text-sm text-gray-600">
                {description}
              </p>
            )}
          </div>
          {dismissible && (
            <button
              type="button"
              onClick={close}
              aria-label={closeLabel}
              className="rounded-lg p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
