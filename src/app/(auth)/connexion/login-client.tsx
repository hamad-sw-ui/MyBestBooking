"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { safeNextPath } from "@/lib/safe-next";
import { invalidateDisplayPreferences } from "@/lib/use-display-currency";
import { invalidateWishlistCache } from "@/lib/use-wishlist-toggle";
import { useT } from "@/components/ui-locale-provider";

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    totpCode: "",
  });

  /** T-194 : logique de connexion partagée — le formulaire classique et les
   * boutons démo appellent la MÊME fonction (mêmes invalidations de cache,
   * même redirection). Aucun chemin d'accès spécial : identique à saisir
   * les identifiants soi-même. */
  const loginWith = async (credentials: { email: string; password: string; totpCode?: string }) => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...credentials, rememberMe }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.twoFactorRequired) {
          setRequiresTwoFactor(true);
        }
        setError(data.error || t("auth.genericError"));
        setLoading(false);
        return;
      }

      const requested = new URLSearchParams(window.location.search).get("next");
      const safeNext = safeNextPath(requested);
      // T-173 : sans plein rechargement, le cache client des préférences
      // d'affichage resterait sur la langue/devise anonyme → page mixte.
      // L'invalidation re-résout avec la session fraîche (compte prioritaire).
      invalidateDisplayPreferences();
      // T-174 : idem pour les favoris — le cache figé à null (401 anonyme)
      // rendait les cœurs faux et « toggle » unauthenticated à tort.
      invalidateWishlistCache();
      router.push(safeNext ?? (data.user.role === "admin" || data.user.role === "host" ? "/dashboard" : "/"));
      router.refresh();
    } catch {
      setError(t("auth.genericError"));
      setLoading(false);
    }
  };

  /** Accès démo en un clic : pré-remplit ET connecte via le flux normal. */
  const handleDemoLogin = (email: string, password: string) => {
    setFormData({ email, password, totpCode: "" });
    setRequiresTwoFactor(false);
    void loginWith({ email, password });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await loginWith(formData);
  };

  return (
    <Card className="w-full max-w-md">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {t("auth.login")}
        </h1>
        <p className="text-gray-600 mt-1">
          {t("auth.welcome")}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        <Input
          type="email"
          label={t("auth.email")}
          placeholder={t("auth.emailPlaceholder")}
          icon={<Mail className="w-5 h-5" />}
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />

        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            label={t("auth.password")}
            placeholder="••••••••"
            icon={<Lock className="w-5 h-5" />}
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>

        {requiresTwoFactor && (
          <Input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            label={t("auth.twoFactorCode")}
            placeholder="123456"
            value={formData.totpCode}
            onChange={(e) => setFormData({ ...formData, totpCode: e.target.value })}
            required
            maxLength={6}
          />
        )}

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="rounded border-gray-300"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span className="text-gray-600">{t("auth.rememberMe")}</span>
          </label>
          <Link href="/mot-de-passe-oublie" className="text-[#1B3A6B] hover:underline">
            {t("auth.forgotPassword")}
          </Link>
        </div>

        <Button type="submit" loading={loading} className="w-full" size="lg">
          {t("auth.loginButton")}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        {t("auth.noAccount")}{" "}
        <Link href="/inscription" className="text-[#1B3A6B] font-medium hover:underline">
          {t("auth.createAccountCta")}
        </Link>
      </div>

      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-xs font-medium text-gray-500 mb-2">{t("auth.demoAccounts")}</p>
        {/* T-194 : accès démo actionnables — un clic connecte via le flux
            normalement utilisé (aucune API spéciale, mêmes redirections). */}
        <div className="flex flex-col gap-2 mb-3">
          <Button type="button" variant="outline" size="sm" className="justify-between w-full"
            disabled={loading} onClick={() => handleDemoLogin("admin@mybestbooking.com", "Admin123!")}>
            <span><strong>{t("auth.roleAdmin")}</strong></span>
            <span className="opacity-70 text-xs">admin@mybestbooking.com</span>
          </Button>
          <Button type="button" variant="outline" size="sm" className="justify-between w-full"
            disabled={loading} onClick={() => handleDemoLogin("host@mybestbooking.com", "Host123!")}>
            <span><strong>{t("auth.roleHost")}</strong></span>
            <span className="opacity-70 text-xs">host@mybestbooking.com</span>
          </Button>
          <Button type="button" variant="outline" size="sm" className="justify-between w-full"
            disabled={loading} onClick={() => handleDemoLogin("customer@mybestbooking.com", "Customer123!")}>
            <span><strong>{t("auth.roleCustomer")}</strong></span>
            <span className="opacity-70 text-xs">customer@mybestbooking.com</span>
          </Button>
        </div>
        <p className="text-[11px] leading-snug text-gray-400">{t("auth.demoHint")}</p>
        <div className="space-y-1 text-[11px] text-gray-400 mt-1" aria-label="mots de passe">
          <p>{t("auth.roleAdmin")} : Admin123! · {t("auth.roleHost")} : Host123! · {t("auth.roleCustomer")} : Customer123!</p>
        </div>
      </div>
    </Card>
  );
}
