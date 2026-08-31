"use client";

import { useState } from "react";
import { useT } from "@/components/ui-locale-provider";

/**
 * Formulaire changement de mot de passe (T-016).
 * POST /api/auth/change-password
 */
export function ChangePasswordForm() {
  const t = useT();
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (newPw !== confirm) {
      setMsg({ kind: "err", text: t("account.passwordsMismatch") });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? t("auth.error"));
      setMsg({ kind: "ok", text: t("account.passwordChanged") });
      setOldPw(""); setNewPw(""); setConfirm("");
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : t("auth.error") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="cp-old" className="block text-sm font-medium text-gray-700 mb-1">{t("account.currentPassword")}</label>
        <input id="cp-old" type="password" required value={oldPw} onChange={(e) => setOldPw(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]" />
      </div>
      <div>
        <label htmlFor="cp-new" className="block text-sm font-medium text-gray-700 mb-1">{t("account.newPassword")}</label>
        <input id="cp-new" type="password" required minLength={8} value={newPw} onChange={(e) => setNewPw(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]" placeholder={t("auth.passwordMinPlaceholder")} />
      </div>
      <div>
        <label htmlFor="cp-confirm" className="block text-sm font-medium text-gray-700 mb-1">Confirmer</label>
        <input id="cp-confirm" type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B]" />
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={loading} className="px-6 py-2 bg-[#1B3A6B] text-white font-medium rounded-lg hover:bg-[#0f2444] disabled:opacity-50">
          {loading ? "…" : t("account.changePassword")}
        </button>
        {msg && (
          <span className={`text-sm ${msg.kind === "ok" ? "text-green-600" : "text-red-600"}`}>
            {msg.text}
          </span>
        )}
      </div>
    </form>
  );
}
