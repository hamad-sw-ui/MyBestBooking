"use client";

import { useRef, useState } from "react";
import { Upload, X, ImagePlus } from "lucide-react";

interface ImageUploaderProps {
  value?: string;
  onChange?: (url: string | null) => void;
  label?: string;
  className?: string;
}

/**
 * Composant client d'upload d'image (T-014).
 * POST /api/uploads en multipart, retourne { url } appliqué via onChange.
 */
export function ImageUploader({ value, onChange, label = "Image", className }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Échec de l'upload");
      onChange?.(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      {value ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="w-40 h-40 object-cover rounded-lg border border-gray-200"
          />
          <button
            type="button"
            aria-label="Supprimer l'image"
            onClick={() => onChange?.(null)}
            className="absolute -top-2 -right-2 p-1 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-40 h-40 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-[#1B3A6B] hover:text-[#1B3A6B] disabled:opacity-50"
        >
          {uploading ? (
            <>
              <Upload className="w-6 h-6 animate-pulse" />
              <span className="text-xs">Envoi…</span>
            </>
          ) : (
            <>
              <ImagePlus className="w-6 h-6" />
              <span className="text-xs">Choisir une image</span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        className="hidden"
      />
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
