"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { useT } from "@/components/ui-locale-provider";

function ResetPasswordInner() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("auth.invalidLink"));
      router.push("/connexion?reset=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.error"));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 text-center">
        <h1 className="text-xl font-bold text-gray-900 mb-2">{t("auth.resetInvalidTitle")}</h1>
        <p className="text-gray-600 mb-6">
          {t("auth.resetNoToken")}{" "}
          <Link href="/mot-de-passe-oublie" className="text-[#1B3A6B] underline">{t("auth.forgotTitle")}</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("auth.newPasswordTitle")}</h1>
      <p className="text-gray-600 mb-6">
        {t("auth.newPasswordBody")}
      </p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth.newPasswordLabel")}</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("auth.passwordMinPlaceholder")}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t("auth.confirm")}</label>
          <input
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[#FF5A5F] text-white font-semibold rounded-lg hover:bg-[#e54a4f] disabled:opacity-50"
        >
          {loading ? t("auth.saving") : t("auth.setNewPassword")}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  const t = useT();
  return (
    <Suspense fallback={<div className="text-center p-8 text-gray-500">{t("action.loading")}</div>}>
      <ResetPasswordInner />
    </Suspense>
  );
}
