"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Loader2 } from "lucide-react";

/**
 * <DeleteAccountSection /> (T-030) — supprime définitivement le compte
 * (soft-delete côté DB, révoque toutes les sessions).
 * Confirmation par saisie du mot « SUPPRIMER » pour éviter les erreurs.
 */
export function DeleteAccountSection() {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function del() {
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/users/me", { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Erreur");
      // Le cookie a été retiré côté serveur, on redirige vers /
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur");
      setBusy(false);
    }
  }

  return (
    <Card className="border-red-200">
      <CardHeader>
        <CardTitle className="text-red-600">Zone de danger</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="font-medium text-red-600">Supprimer mon compte</p>
            <p className="text-sm text-gray-500">
              Cette action est irréversible. Toutes vos données de profil
              seront supprimées. Vos réservations passées et avis restent
              anonymisés en base pour la traçabilité comptable.
            </p>
          </div>
          <Input
            label='Tapez "SUPPRIMER" pour confirmer'
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="SUPPRIMER"
            aria-label="Confirmation de suppression"
          />
          <Button
            variant="danger"
            size="sm"
            onClick={del}
            disabled={busy || confirmText !== "SUPPRIMER"}
          >
            {busy ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4 mr-2" />
            )}
            Supprimer définitivement
          </Button>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
