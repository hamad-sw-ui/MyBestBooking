"use client";

import { useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Bouton « Importer depuis l'ordinateur » : un bouton stylé qui ouvre le
 * gestionnaire/sélecteur de fichiers de la machine (via un <input type="file">
 * masqué). Plus accessible et plus explicite qu'un champ de fichier natif brut.
 *
 * La sélection du/des fichier(s) est déléguée au parent via `onFile`, qui se
 * charge de l'upload (POST /api/properties/upload ou autre).
 */
interface PhotoUploadButtonProps {
  onFile: (file: File) => void;
  children: ReactNode;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  className?: string;
  title?: string;
  ariaLabel?: string;
}

export function PhotoUploadButton({
  onFile,
  children,
  accept = "image/jpeg,image/png,image/webp,image/gif",
  multiple = false,
  disabled = false,
  loading = false,
  variant = "primary",
  size = "md",
  className,
  title,
  ariaLabel,
}: PhotoUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        disabled={disabled || loading}
        loading={loading}
        title={title}
        aria-label={ariaLabel}
        onClick={() => inputRef.current?.click()}
      >
        {children}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const files = e.target.files;
          if (files && files.length > 0) {
            if (multiple) {
              Array.from(files).forEach((f) => onFile(f));
            } else {
              onFile(files[0]);
            }
          }
          // Permet de re-sélectionner le même fichier (déclenche onChange).
          e.target.value = "";
        }}
      />
    </>
  );
}
