"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { useT } from "@/components/ui-locale-provider";

export default function ForgotPasswordPage() {
  const t = useT();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t("auth.error"));
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("auth.forgotTitle")}</h1>
      <p className="text-gray-600 mb-6">
        {t("auth.forgotBody")}
      </p>
      {sent ? (
        <div className="p-4 rounded-lg bg-green-50 text-green-800 text-sm">
          {t("auth.forgotSent")}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth.email")}</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                required
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#FF5A5F] text-white font-semibold rounded-lg hover:bg-[#e54a4f] disabled:opacity-50"
          >
            {loading ? t("auth.sending") : t("auth.sendLink")}
          </button>
        </form>
      )}
      <p className="text-sm text-gray-500 text-center mt-6">
        <Link href="/connexion" className="text-[#1B3A6B] hover:underline">
          {t("auth.backToLogin")}
        </Link>
      </p>
    </div>
  );
}
