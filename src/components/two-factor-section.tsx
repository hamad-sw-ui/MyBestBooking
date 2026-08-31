"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, ShieldCheck, Loader2 } from "lucide-react";
import { useT } from "@/components/ui-locale-provider";

interface Props { initiallyEnabled: boolean; }

type SetupState = { phase: "idle" } | { phase: "loading" } | { phase: "setup"; secret: string };

/**
 * TOTP local : aucun QR distant ne reçoit l’URI/secret. La saisie manuelle est
 * compatible avec toutes les applications TOTP et la rotation garde le facteur
 * actif jusqu’à la vérification du nouveau code.
 */
export function TwoFactorSection({ initiallyEnabled }: Props) {
  const t = useT();
  const router = useRouter();
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [setupState, setSetupState] = useState<SetupState>({ phase: "idle" });
  const [password, setPassword] = useState("");
  const [currentCode, setCurrentCode] = useState("");
  const [newCode, setNewCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function cleanCode(value: string) { return value.replace(/\D/g, "").slice(0, 6); }

  async function startSetup() {
    if (!password) { setError(t("tfa.needPassword")); return; }
    if (enabled && !/^\d{6}$/.test(currentCode)) { setError(t("tfa.needActiveCode")); return; }
    setError(null); setBusy(true); setSetupState({ phase: "loading" });
    try {
      const r = await fetch("/api/auth/2fa/setup", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, ...(enabled ? { currentCode } : {}) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? t("auth.error"));
      setSetupState({ phase: "setup", secret: j.secret });
      setNewCode("");
    } catch (e) {
      setSetupState({ phase: "idle" });
      setError(e instanceof Error ? e.message : t("auth.error"));
    } finally { setBusy(false); }
  }

  async function verify() {
    if (!/^\d{6}$/.test(newCode)) { setError(t("tfa.needSixDigits")); return; }
    setError(null); setBusy(true);
    try {
      const r = await fetch("/api/auth/2fa/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: newCode }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? t("auth.error"));
      setEnabled(true); setSetupState({ phase: "idle" }); setPassword(""); setCurrentCode(""); setNewCode(""); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : t("auth.error")); }
    finally { setBusy(false); }
  }

  async function disable() {
    if (!password || !/^\d{6}$/.test(currentCode)) { setError(t("tfa.needPasswordAndCode")); return; }
    setError(null); setBusy(true);
    try {
      const r = await fetch("/api/auth/2fa/disable", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password, code: currentCode }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? t("auth.error"));
      setEnabled(false); setSetupState({ phase: "idle" }); setPassword(""); setCurrentCode(""); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : t("auth.error")); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader><div className="flex items-center gap-2">{enabled ? <ShieldCheck className="w-5 h-5 text-green-600" /> : <Shield className="w-5 h-5 text-gray-400" />}<CardTitle>{t("tfa.title")}</CardTitle></div></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">{t("tfa.body")}</p>
        {setupState.phase === "idle" && (
          <div className="space-y-3">
            {enabled && <p className="flex items-center gap-2 text-sm font-medium text-green-700"><ShieldCheck className="w-4 h-4" />{t("tfa.enabled")}</p>}
            <Input label={t("account.currentPassword")} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {enabled && <Input label={t("tfa.activeCode")} value={currentCode} onChange={(e) => setCurrentCode(cleanCode(e.target.value))} placeholder="123456" inputMode="numeric" />}
            <div className="flex flex-wrap gap-2">
              <Button onClick={startSetup} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : enabled ? t("tfa.replace") : t("tfa.enable")}</Button>
              {enabled && <Button variant="danger" onClick={disable} disabled={busy}>{t("tfa.disable")}</Button>}
            </div>
          </div>
        )}
        {setupState.phase === "loading" && <div className="flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" />{t("tfa.generating")}</div>}
        {setupState.phase === "setup" && (
          <div className="space-y-4 border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-800">{t("tfa.step1")}</p>
            <code className="block bg-gray-100 px-3 py-2 rounded font-mono text-sm break-all select-all">{setupState.secret}</code>
            <p className="text-xs text-gray-600">{t("tfa.step2")}</p>
            <Input label={t("tfa.newCode")} value={newCode} onChange={(e) => setNewCode(cleanCode(e.target.value))} placeholder="123456" inputMode="numeric" />
            <div className="flex gap-2"><Button onClick={verify} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : t("tfa.verifyEnable")}</Button><Button variant="ghost" onClick={() => { setSetupState({ phase: "idle" }); setNewCode(""); }}>{t("action.cancel")}</Button></div>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
