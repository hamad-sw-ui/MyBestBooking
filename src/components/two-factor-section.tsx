"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, ShieldCheck, Loader2 } from "lucide-react";

interface Props { initiallyEnabled: boolean; }

type SetupState = { phase: "idle" } | { phase: "loading" } | { phase: "setup"; secret: string };

/**
 * TOTP local : aucun QR distant ne reçoit l’URI/secret. La saisie manuelle est
 * compatible avec toutes les applications TOTP et la rotation garde le facteur
 * actif jusqu’à la vérification du nouveau code.
 */
export function TwoFactorSection({ initiallyEnabled }: Props) {
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
    if (!password) { setError("Confirmez votre mot de passe pour modifier la 2FA"); return; }
    if (enabled && !/^\d{6}$/.test(currentCode)) { setError("Entrez votre code TOTP actif pour remplacer la 2FA"); return; }
    setError(null); setBusy(true); setSetupState({ phase: "loading" });
    try {
      const r = await fetch("/api/auth/2fa/setup", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ password, ...(enabled ? { currentCode } : {}) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setSetupState({ phase: "setup", secret: j.secret });
      setNewCode("");
    } catch (e) {
      setSetupState({ phase: "idle" });
      setError(e instanceof Error ? e.message : "Erreur");
    } finally { setBusy(false); }
  }

  async function verify() {
    if (!/^\d{6}$/.test(newCode)) { setError("Le nouveau code doit contenir 6 chiffres"); return; }
    setError(null); setBusy(true);
    try {
      const r = await fetch("/api/auth/2fa/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: newCode }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Code invalide");
      setEnabled(true); setSetupState({ phase: "idle" }); setPassword(""); setCurrentCode(""); setNewCode(""); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(false); }
  }

  async function disable() {
    if (!password || !/^\d{6}$/.test(currentCode)) { setError("Mot de passe et code TOTP actif requis"); return; }
    setError(null); setBusy(true);
    try {
      const r = await fetch("/api/auth/2fa/disable", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password, code: currentCode }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setEnabled(false); setSetupState({ phase: "idle" }); setPassword(""); setCurrentCode(""); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader><div className="flex items-center gap-2">{enabled ? <ShieldCheck className="w-5 h-5 text-green-600" /> : <Shield className="w-5 h-5 text-gray-400" />}<CardTitle>Authentification à deux facteurs (TOTP)</CardTitle></div></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">Utilisez une application d&apos;authentification. Le secret reste entre votre navigateur, votre application TOTP et MyBestBooking : aucun service QR tiers n&apos;est appelé.</p>
        {setupState.phase === "idle" && (
          <div className="space-y-3">
            {enabled && <p className="flex items-center gap-2 text-sm font-medium text-green-700"><ShieldCheck className="w-4 h-4" />2FA activée. Remplacez-la seulement avec le facteur actif.</p>}
            <Input label="Mot de passe actuel" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            {enabled && <Input label="Code TOTP actif" value={currentCode} onChange={(e) => setCurrentCode(cleanCode(e.target.value))} placeholder="123456" inputMode="numeric" />}
            <div className="flex flex-wrap gap-2">
              <Button onClick={startSetup} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : enabled ? "Remplacer la 2FA" : "Activer la 2FA"}</Button>
              {enabled && <Button variant="danger" onClick={disable} disabled={busy}>Désactiver</Button>}
            </div>
          </div>
        )}
        {setupState.phase === "loading" && <div className="flex items-center gap-2 text-gray-600"><Loader2 className="w-4 h-4 animate-spin" />Génération locale du secret…</div>}
        {setupState.phase === "setup" && (
          <div className="space-y-4 border border-gray-200 rounded-lg p-4">
            <p className="text-sm font-medium text-gray-800">1. Ajoutez ce secret dans votre application TOTP (saisie manuelle).</p>
            <code className="block bg-gray-100 px-3 py-2 rounded font-mono text-sm break-all select-all">{setupState.secret}</code>
            <p className="text-xs text-gray-600">2. Le facteur actuel reste actif jusqu&apos;à validation du nouveau code.</p>
            <Input label="Nouveau code TOTP" value={newCode} onChange={(e) => setNewCode(cleanCode(e.target.value))} placeholder="123456" inputMode="numeric" />
            <div className="flex gap-2"><Button onClick={verify} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Vérifier et activer"}</Button><Button variant="ghost" onClick={() => { setSetupState({ phase: "idle" }); setNewCode(""); }}>Annuler</Button></div>
          </div>
        )}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
