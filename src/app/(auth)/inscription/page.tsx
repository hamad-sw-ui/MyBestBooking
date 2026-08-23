"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Mail, Lock, User, Eye, EyeOff, Building2 } from "lucide-react";
import { safeNextPath } from "@/lib/safe-next";

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isHost, setIsHost] = useState(false);
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

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          role: isHost ? "host" : "customer",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Une erreur est survenue");
        setLoading(false);
        return;
      }

      const requested = new URLSearchParams(window.location.search).get("next");
      const safeNext = safeNextPath(requested);
      router.push(safeNext ?? (isHost ? "/dashboard" : "/"));
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
          Créer un compte
        </h1>
        <p className="text-gray-600 mt-1">
          Rejoignez mybestbooking gratuitement
        </p>
      </div>

      {/* Account type selector */}
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
            Voyageur
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
            Hébergeur
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
            label="Prénom"
            placeholder="Jean"
            value={formData.firstName}
            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            required
          />
          <Input
            type="text"
            label="Nom"
            placeholder="Dupont"
            value={formData.lastName}
            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            required
          />
        </div>

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
            placeholder="Min. 8 caractères"
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

        <p className="text-xs text-gray-500">
          En créant un compte, vous acceptez nos{" "}
          <Link href="/mentions-legales" className="text-[#1B3A6B] hover:underline">Mentions légales &amp; CGU</Link> et notre{" "}
          <Link href="/confidentialite" className="text-[#1B3A6B] hover:underline">Politique de confidentialité</Link>.
        </p>

        <Button type="submit" loading={loading} className="w-full" size="lg">
          {isHost ? "Créer mon compte hébergeur" : "Créer mon compte"}
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        Déjà un compte ?{" "}
        <Link href="/connexion" className="text-[#1B3A6B] font-medium hover:underline">
          Se connecter
        </Link>
      </div>

      {isHost && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg text-sm text-blue-800">
          <strong>Hébergeurs :</strong> Après inscription, vous pourrez ajouter vos hébergements et gérer vos réservations depuis votre tableau de bord.
        </div>
      )}
    </Card>
  );
}
