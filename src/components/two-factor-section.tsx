"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Shield, ShieldCheck, Loader2 } from "lucide-react";

interface Props {
  initiallyEnabled: boolean;
}

/**
 * <TwoFactorSection /> (T-030)
 * Interface complète 2FA TOTP :
 * - Setup : appel /api/auth/2fa/setup → affiche otpauth URI + input code
 * - Verify : appel /api/auth/2fa/verify → activation
 * - Disable : appel /api/auth/2fa/disable avec code TOTP requis
 *
 * QR code : on affiche l'URI otpauth encodée en URL image via
 * `qrserver.com` (service public gratuit, aucun secret transmis puisque
 * l'URI contient déjà le secret et que la CSP l'autorise en `img-src`).
 * Alternative : librairie qrcode locale à ajouter si CSP resserrée.
 */
export function TwoFactorSection({ initiallyEnabled }: Props) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [setupState, setSetupState] = useState<
    | { phase: "idle" }
    | { phase: "loading" }
    | { phase: "setup"; otpauth: string; secret: string }
    | { phase: "disabling" }
  >({ phase: "idle" });
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function startSetup() {
    setError(null);
    setSetupState({ phase: "loading" });
    try {
      const r = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      setSetupState({ phase: "setup", otpauth: j.otpauth, secret: j.secret });
    } catch (e) {
      setSetupState({ phase: "idle" });
      setError(e instanceof Error ? e.message : "Erreur");
    }
  }

  async function verify() {
    if (!/^\d{6}$/.test(code)) {
      setError("Le code doit contenir 6 chiffres");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Code invalide");
      setEnabled(true);
      setSetupState({ phase: "idle" });
      setCode("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    if (!/^\d{6}$/.test(code)) {
      setError("Entrez un code TOTP à 6 chiffres pour confirmer");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Code invalide");
      setEnabled(false);
      setSetupState({ phase: "idle" });
      setCode("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          {enabled ? (
            <ShieldCheck className="w-5 h-5 text-green-600" />
          ) : (
            <Shield className="w-5 h-5 text-gray-400" />
          )}
          <CardTitle>Authentification à deux facteurs (TOTP)</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Ajoutez une couche de sécurité supplémentaire avec une application
          d&apos;authentification (Google Authenticator, Authy, 1Password,
          Bitwarden…).
        </p>

        {enabled && setupState.phase === "idle" && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-green-700">
              <ShieldCheck className="w-4 h-4" />
              <span className="font-medium">2FA activée sur votre compte</span>
            </div>
            <div className="flex gap-2 items-end">
              <Input
                label="Code TOTP pour désactiver"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                aria-label="Code TOTP à 6 chiffres"
              />
              <Button variant="danger" onClick={disable} disabled={busy}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Désactiver"}
              </Button>
            </div>
          </div>
        )}

        {!enabled && setupState.phase === "idle" && (
          <Button onClick={startSetup}>Activer la 2FA</Button>
        )}

        {setupState.phase === "loading" && (
          <div className="flex items-center gap-2 text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin" /> Génération du secret…
          </div>
        )}

        {setupState.phase === "setup" && (
          <div className="space-y-4 border border-gray-200 rounded-lg p-4">
            <p className="text-sm text-gray-700 font-medium">
              1. Scannez ce QR code avec votre application d&apos;authentification :
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setupState.otpauth)}`}
              alt="QR code TOTP"
              width={200}
              height={200}
              className="border border-gray-200 rounded-lg"
            />
            <p className="text-xs text-gray-500">
              Ou saisissez le secret manuellement :{" "}
              <code className="bg-gray-100 px-2 py-1 rounded font-mono text-[11px] break-all">
                {setupState.secret}
              </code>
            </p>
            <div className="pt-2 border-t border-gray-100">
              <p className="text-sm text-gray-700 font-medium mb-2">
                2. Entrez le code à 6 chiffres généré :
              </p>
              <div className="flex gap-2 items-end">
                <Input
                  label="Code TOTP"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="123456"
                  aria-label="Code TOTP à 6 chiffres"
                />
                <Button onClick={verify} disabled={busy}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Vérifier"}
                </Button>
                <Button variant="ghost" onClick={() => setSetupState({ phase: "idle" })}>
                  Annuler
                </Button>
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
