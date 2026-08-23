"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { safeNextPath } from "@/lib/safe-next";

export default function LoginPage() {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, rememberMe }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.twoFactorRequired) {
          setRequiresTwoFactor(true);
        }
        setError(data.error || "Une erreur est survenue");
        setLoading(false);
        return;
      }

      // Le proxy conserve la destination initiale. Refuser toute URL externe
      // pour éviter une redirection ouverte après authentification.
      const requested = new URLSearchParams(window.location.search).get("next");
      const safeNext = safeNextPath(requested);
      router.push(safeNext ?? (data.user.role === "admin" || data.user.role === "host" ? "/dashboard" : "/"));
      router.refresh();
    } catch {
      setError("Une erreur est survenue");
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Connexion
        </h1>
        <p className="text-gray-600 mt-1">
          Bienvenue sur mybestbooking
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
          label="Email"
          placeholder="votre@email.com"
          icon={<Mail className="w-5 h-5" />}
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          required
        />

        <div className="relative">
          <Input
            type={showPassword ? "text" : "password"}
            label="Mot de passe"
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
            label="Code de vérification"
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
            <span className="text-gray-600">Se souvenir de moi</span>
          </label>
          <Link href="/mot-de-passe-oublie" className="text-[#1B3A6B] hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>

        <Button type="submit" loading={loading} className="w-full" size="lg">
          Se connecter
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        Pas encore de compte ?{" "}
        <Link href="/inscription" className="text-[#1B3A6B] font-medium hover:underline">
          Créer un compte
        </Link>
      </div>

      {/* Demo accounts */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-xs font-medium text-gray-500 mb-2">Comptes de démonstration :</p>
        <div className="space-y-1 text-xs text-gray-600">
          <p><strong>Admin :</strong> admin@mybestbooking.com / Admin123!</p>
          <p><strong>Hébergeur :</strong> host@mybestbooking.com / Host123!</p>
          <p><strong>Client :</strong> customer@mybestbooking.com / Customer123!</p>
        </div>
      </div>
    </Card>
  );
}
