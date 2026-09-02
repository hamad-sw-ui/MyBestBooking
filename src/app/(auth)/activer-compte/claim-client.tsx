"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { useT } from "@/components/ui-locale-provider";

function ClaimGuestInner() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirm) { setError(t("auth.passwordMismatch")); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, password, claimGuest: true }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? t("auth.invalidLinkOrExpired"));
      router.replace("/mes-reservations?claimed=1");
    } catch (reason) { setError(reason instanceof Error ? reason.message : t("auth.error")); }
    finally { setBusy(false); }
  }

  if (!token) return <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8 text-center"><h1 className="text-xl font-bold text-gray-900 mb-2">{t("auth.invalidLink")}</h1><p className="text-gray-600">{t("auth.claimNoToken")}</p></div>;

  return <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-8">
    <h1 className="text-2xl font-bold text-gray-900 mb-2">{t("auth.claimTitle")}</h1>
    <p className="text-gray-600 mb-6">{t("auth.claimBody")}</p>
    <form onSubmit={submit} className="space-y-4">
      <label className="block text-sm font-medium text-gray-700">{t("auth.password")}
        <span className="relative block mt-1"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg" placeholder={t("auth.passwordMinPlaceholder")} /></span>
      </label>
      <label className="block text-sm font-medium text-gray-700">{t("auth.confirm")}
        <input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} className="mt-1 w-full px-4 py-3 border border-gray-200 rounded-lg" />
      </label>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className="w-full py-3 bg-[#FF5A5F] text-white font-semibold rounded-lg disabled:opacity-50">{busy ? t("auth.activating") : t("auth.activateAndView")}</button>
    </form>
    <p className="mt-5 text-sm text-gray-500">{t("auth.hasAccount")} <Link href="/connexion" className="text-[#1B3A6B] underline">{t("auth.loginLink")}</Link>.</p>
  </div>;
}

export default function ClaimGuestPage() {
  const t = useT();
  return <Suspense fallback={<div className="text-center p-8 text-gray-500">{t("action.loading")}</div>}><ClaimGuestInner /></Suspense>;
}
