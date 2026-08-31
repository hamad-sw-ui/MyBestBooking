"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useT } from "@/components/ui-locale-provider";

interface Props {
  initial: {
    priceAlertEnabled: boolean;
    // Les préférences par catégorie sont stockées globalement dans
    // app_settings.notifications (T-021). Pour un vrai contrôle par user
    // il faudrait une table user_notification_prefs — hors périmètre V1.
    // Ici on n'expose que priceAlertEnabled (colonne user).
  };
}

/**
 * <NotificationPrefsSection /> (T-030)
 * Éditeur simple des préférences notification par user.
 * Écrit `users.priceAlertEnabled` via PATCH /api/users/me.
 * Les autres flags (booking, review request) sont gérés globalement
 * dans /dashboard/settings > Notifications.
 */
export function NotificationPrefsSection({ initial }: Props) {
  const t = useT();
  const router = useRouter();
  const [priceAlert, setPriceAlert] = useState(initial.priceAlertEnabled);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      const r = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priceAlertEnabled: priceAlert }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? t("auth.error"));
      }
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("auth.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("notif.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">{t("notif.priceAlerts")}</p>
            <p className="text-sm text-gray-500">
              {t("notif.priceAlertsBody")}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={priceAlert}
              onChange={(e) => setPriceAlert(e.target.checked)}
              aria-label={t("notif.priceAlerts")}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#1B3A6B] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1B3A6B]"></div>
          </label>
        </div>
        <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">
          {t("notif.globalNote")}
        </p>
      </CardContent>
      <CardFooter className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>
          {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          {t("action.save")}
        </Button>
        {saved && <span className="text-sm text-green-600">{t("notif.saved")}</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </CardFooter>
    </Card>
  );
}
