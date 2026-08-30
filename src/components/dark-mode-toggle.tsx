"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * <DarkModeToggle /> (T-029) — bascule .dark sur <html>, persistée
 * dans localStorage. Respecte prefers-color-scheme au premier chargement.
 */
export function DarkModeToggle({ className = "p-2 rounded-lg hover:bg-gray-100 transition" }: { className?: string }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Défère le setState pour éviter le cascading render warning.
    const t = setTimeout(() => {
      const stored = localStorage.getItem("theme");
      const shouldDark =
        stored === "dark" ||
        (!stored && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", shouldDark);
      setIsDark(shouldDark);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  function toggle() {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setIsDark(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Activer le mode clair" : "Activer le mode sombre"}
      className={className}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
