"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Mail, Lock, User, Eye, EyeOff, Building2, Gift } from "lucide-react";
import { safeNextPath } from "@/lib/safe-next";
import { useDisplayPreferences } from "@/lib/use-display-currency";
import { isUiLocale } from "@/lib/ui-strings";
import { useT } from "@/components/ui-locale-provider";

export default function RegisterPage() {
  const t = useT();
  const router = useRouter();
  const { language } = useDisplayPreferences();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [referralCode, setReferralCode] = useState(() => {
    if (typeof window === "undefined") return "";
    const params = new URLSearchParams(window.location.search);
    return (params.get("ref") ?? params.get("referral") ?? "").trim().toUpperCase();
  });
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (formData.password !== confirmPassword) {
      setError(t("auth.passwordMismatch"));
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          role: isHost ? "host" : "customer",
          ...(language && isUiLocale(language) ? { language } : {}),
          ...(referralCode.trim() ? { referralCode: referralCode.trim() } : {}),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || t("auth.genericError"));
        setLoading(false);
        return;
      }

      const requested = new URLSearchParams(window.location.search).get("next");
      const safeNext = safeNextPath(requested);
      router.push(safeNext ?? (isHost ? "/dashboard" : "/"));
      router.refresh();
    } catch {
      setError(t("auth.genericError"));
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
          {t("auth.createTitle")}
        </h1>
        <p className="text-gray-600 mt-1">
          {t("auth.createSubtitle")}
        </p>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          type="button"
          onClick={() => setIsHost(false)}
          className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
            !isHost
              ? "border-[#1B3A6B] bg-[#1B3A6B]/5"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <User className={`w-5 h-5 mx-auto mb-1 ${!isHost ? "text-[#1B3A6B]" : "text-gray-400"}`} />
          <span className={`text-sm font-medium ${!isHost ? "text-[#1B3A6B]" : "text-gray-600"}`}>
            {t("auth.traveler")}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setIsHost(true)}
          className={`flex-1 p-3 rounded-lg border-2 transition-colors ${
            isHost
              ? "border-[#1B3A6B] bg-[#1B3A6B]/5"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <Building2 className={`w-5 h-5 mx-auto mb-1 ${isHost ? "text-[#1B3A6B]" : "text-gray-400"}`} />
          <span className={`text-sm font-medium ${isHost ? "text-[#1B3A6B]" : "text-gray-600"}`}>
            {t("auth.host")}
          </span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Input
            type="text"
            label={t("auth.firstName")}
            placeholder={t("auth.firstNamePlaceholder")}
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            required
          />
          <Input
            type="text"
            label={t("auth.lastName")}
            placeholder={t("auth.lastNamePlaceholder")}
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            required
          />
        </div>

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
            placeholder={t("auth.passwordMinPlaceholder")}
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

        <Input
          type={showPassword ? "text" : "password"}
          label={t("auth.confirmPassword")}
          placeholder={t("auth.confirmPasswordPlaceholder")}
          icon={<Lock className="w-5 h-5" />}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          pattern={formData.password ? formData.password.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : undefined}
          title={t("auth.passwordMatchTitle")}
        />

        <Input
          type="text"
          label={t("auth.referralOptional")}
          placeholder={t("auth.referralPlaceholder")}
          icon={<Gift className="w-5 h-5" />}
          value={referralCode}
          onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
          maxLength={12}
          autoComplete="off"
        />

        <p className="text-xs text-gray-500">
          {t("auth.termsPrefix")}{" "}
          <Link href="/mentions-legales" className="text-[#1B3A6B] hover:underline">{t("auth.legalCgu")}</Link> {t("auth.termsAnd")}{" "}
          <Link href="/confidentialite" className="text-[#1B3A6B] hover:underline">{t("privacy.meta.title")}</Link>.
        </p>

        <Button type="submit" loading={loading} className="w-full" size="lg">
          {isHost ? t("auth.createHostAccount") : t("auth.registerButton")}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        {t("auth.hasAccount")}{" "}
        <Link href="/connexion" className="text-[#1B3A6B] font-medium hover:underline">
          {t("auth.loginButton")}
        </Link>
      </div>

      {isHost && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
          {t("auth.hostHint")}
        </div>
      )}
    </Card>
  );
}
