"use client";

import { useState } from "react";

/**
 * T-133 (A4) — Avatar utilisateur avec repli sur les initiales.
 *
 * Affiche `avatarUrl` si elle est fournie et charge correctement ; sinon
 * montre les initiales (prénom + nom). Composant client pour pouvoir gérer
 * l'erreur de chargement d'une URL cassée sans casser le rendu.
 */
export function UserAvatar({
  avatarUrl,
  firstName,
  lastName,
  size = 40,
  className = "",
}: {
  avatarUrl?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = `${(firstName ?? "").trim().charAt(0)}${(lastName ?? "").trim().charAt(0)}`.toUpperCase() || "?";
  const showImage = Boolean(avatarUrl) && !failed;

  return (
    <span
      className={`inline-flex items-center justify-center overflow-hidden rounded-full bg-[#1B3A6B] text-white font-semibold shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={avatarUrl as string}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        initials
      )}
    </span>
  );
}
