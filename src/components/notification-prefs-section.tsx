"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useT } from "@/components/ui-locale-provider";
import type { UiStringKey } from "@/lib/ui-strings";
import {
  USER_NOTIFICATION_CATEGORIES,
  type UserNotificationCategory,
  type UserNotificationPrefs,
} from "@/lib/notification-prefs";

interface Props {
  initial: {
    priceAlertEnabled: boolean;
    /** T-261 — `null`/absent = héritage du réglage global (aucun envoi changé). */
    notificationPrefs?: UserNotificationPrefs | null;
  };
}

/** Libellés et descriptions de chaque catégorie réglable (clés i18n). */
const CATEGORY_TEXT: Record<UserNotificationCategory, { label: UiStringKey; body: UiStringKey }> = {
  stayReminders: { label: "notif.stayReminders", body: "notif.stayRemindersBody" },
  reviewRequests: { label: "notif.reviewRequests", body: "notif.reviewRequestsBody" },
  moderationDecisions: {
    label: "notif.moderationDecisions",
    body: "notif.moderationDecisionsBody",
  },
};

/**
 * <NotificationPrefsSection /> (T-030, étendu T-261 — audit n°6, B9)
 *
 * Éditeur des préférences de notification de l'utilisateur.
 *  - **Alertes prix** : colonne dédiée `users.price_alert_enabled` (inchangé) ;
 *  - **Rappels de séjour / demandes d'avis / décisions de modération** :
 *    `users.notification_prefs` (T-261). Une case **cochée** = « je reçois »
 *    (sauf si l'équipe a coupé le type au niveau global : l'utilisateur ne peut
 *    pas le réactiver) ; décochée = ma catégorie est coupée. Enregistrer sans
 *    jamais toucher aux cases laisse la colonne à `null`, donc l'héritage —
 *    c'est ce qui garantit l'absence de régression pour les comptes existants.
 */
export function NotificationPrefsSection({ initial }: Props) {
  const t = useT();
  const router = useRouter();
  const [priceAlert, setPriceAlert] = useState(initial.priceAlertEnabled);
  const [categories, setCategories] = useState<Record<UserNotificationCategory, boolean>>(() => ({
    // Absent ⇒ coché : l'interrupteur global est actif, l'utilisateur hérite.
    stayReminders: initial.notificationPrefs?.stayReminders !== false,
    reviewRequests: initial.notificationPrefs?.reviewRequests !== false,
    moderationDecisions: initial.notificationPrefs?.moderationDecisions !== false,
  }));
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
        body: JSON.stringify({
          priceAlertEnabled: priceAlert,
          // Toutes les catégories sont envoyées explicitement : l'utilisateur
          // voit l'état de ses cases, il enregistre ce qu'il voit.
          notificationPrefs: {
            stayReminders: categories.stayReminders,
            reviewRequests: categories.reviewRequests,
            moderationDecisions: categories.moderationDecisions,
          },
        }),
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

  function toggle(category: UserNotificationCategory, value: boolean) {
    setCategories((current) => ({ ...current, [category]: value }));
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

        {/* T-261 — catégories « confort » réellement réglables par l'utilisateur. */}
        {USER_NOTIFICATION_CATEGORIES.map((category) => (
          <div
            key={category}
            className="flex items-center justify-between border-t border-gray-100 pt-4"
          >
            <div>
              <p className="font-medium">{t(CATEGORY_TEXT[category].label)}</p>
              <p className="text-sm text-gray-500">{t(CATEGORY_TEXT[category].body)}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={categories[category]}
                onChange={(e) => toggle(category, e.target.checked)}
                aria-label={t(CATEGORY_TEXT[category].label)}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#1B3A6B] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1B3A6B]"></div>
            </label>
          </div>
        ))}

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
