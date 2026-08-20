"use client";

/**
 * Panneau d'administration configurable (T-021, ADR-007).
 * Chaque section rend son propre formulaire client contrôlé, avec
 * bouton d'enregistrement individuel et rate-limit côté serveur.
 */

import { useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Globe, CreditCard, Bell, Shield, Award,
  Package, CheckCircle2, XCircle, AlertCircle, Mail,
} from "lucide-react";
import type {
  SettingValue,
  SettingKey,
} from "@/lib/settings";

type AllSettings = { [K in SettingKey]: SettingValue<K> };
type Providers = { stripe: boolean; resend: boolean; s3: boolean };

interface Props {
  initial: AllSettings;
  providers: Providers;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

async function saveSection<K extends SettingKey>(key: K, value: SettingValue<K>) {
  const res = await fetch(`/api/admin/settings/${key}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({ error: "Erreur inconnue" }));
    throw new Error(j.error || "Erreur d'enregistrement");
  }
  return (await res.json()) as { key: K; value: SettingValue<K> };
}

function StatusPill({ status, error }: { status: SaveStatus; error?: string | null }) {
  if (status === "saving") return <Badge variant="info">Enregistrement…</Badge>;
  if (status === "saved") return <Badge variant="success">Enregistré ✓</Badge>;
  if (status === "error") return <Badge variant="danger">{error || "Erreur"}</Badge>;
  return null;
}

export function SettingsPanel({ initial, providers }: Props) {
  return (
    <div className="space-y-6">
      <GeneralSection initial={initial.general} />
      <BillingSection initial={initial.billing} />
      <BestrewardsSection initial={initial.bestrewards} />
      <CancellationSection initial={initial.cancellation} />
      <NotificationsSection initial={initial.notifications} />
      <EmailTemplatesSection initial={initial.emailTemplates} />
      <SecuritySection initial={initial.security} />
      <ProvidersSection providers={providers} />
    </div>
  );
}

/* ─────────────────────────── GENERAL ─────────────────────────── */

function GeneralSection({ initial }: { initial: SettingValue<"general"> }) {
  const [v, setV] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    setStatus("saving");
    startTransition(async () => {
      try {
        await saveSection("general", v);
        setStatus("saved");
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-[#1B3A6B]" />
          <CardTitle>Paramètres généraux</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          label="Nom de la plateforme"
          value={v.siteName}
          onChange={(e) => setV({ ...v, siteName: e.target.value })}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Email de support"
            type="email"
            value={v.supportEmail}
            onChange={(e) => setV({ ...v, supportEmail: e.target.value })}
          />
          <Input
            label="Email partenaires"
            type="email"
            value={v.partnersEmail}
            onChange={(e) => setV({ ...v, partnersEmail: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Langue par défaut</label>
            <select
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
              value={v.defaultLanguage}
              onChange={(e) => setV({ ...v, defaultLanguage: e.target.value as typeof v.defaultLanguage })}
            >
              <option value="fr">🇫🇷 Français</option>
              <option value="en">🇬🇧 English</option>
              <option value="ar">🇸🇦 العربية</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Devise par défaut</label>
            <select
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
              value={v.defaultCurrency}
              onChange={(e) => setV({ ...v, defaultCurrency: e.target.value as typeof v.defaultCurrency })}
            >
              <option value="EUR">€ EUR</option>
              <option value="USD">$ USD</option>
              <option value="GBP">£ GBP</option>
              <option value="XAF">FCFA XAF</option>
            </select>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex items-center gap-3">
        <Button onClick={save} disabled={isPending}>Enregistrer</Button>
        <StatusPill status={status} error={error} />
      </CardFooter>
    </Card>
  );
}

/* ─────────────────────────── BILLING ─────────────────────────── */

function BillingSection({ initial }: { initial: SettingValue<"billing"> }) {
  const [v, setV] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    setStatus("saving");
    startTransition(async () => {
      try {
        await saveSection("billing", v);
        setStatus("saved");
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <CreditCard className="w-5 h-5 text-[#1B3A6B]" />
          <CardTitle>Fiscalité & commissions</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Taux de TVA (%)"
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={(v.taxRate * 100).toFixed(2)}
            onChange={(e) => setV({ ...v, taxRate: parseFloat(e.target.value) / 100 })}
          />
          <Input
            label="Commission par défaut (%)"
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={v.defaultCommissionRate}
            onChange={(e) => setV({ ...v, defaultCommissionRate: parseFloat(e.target.value) })}
          />
        </div>
        <p className="text-xs text-gray-500">
          Ces valeurs s&apos;appliquent aux nouvelles réservations. Les
          propriétés qui possèdent une commission spécifique gardent leur
          valeur.
        </p>
      </CardContent>
      <CardFooter className="flex items-center gap-3">
        <Button onClick={save} disabled={isPending}>Enregistrer</Button>
        <StatusPill status={status} error={error} />
      </CardFooter>
    </Card>
  );
}

/* ─────────────────────────── BESTREWARDS ─────────────────────────── */

function BestrewardsSection({ initial }: { initial: SettingValue<"bestrewards"> }) {
  const [v, setV] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    setStatus("saving");
    startTransition(async () => {
      try {
        await saveSection("bestrewards", v);
        setStatus("saved");
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Award className="w-5 h-5 text-[#F5A623]" />
          <CardTitle>Programme BestRewards</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Seuils de passage de niveau (nombre de réservations) et
          réductions accordées par niveau.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Seuil Level 2 (réservations)"
            type="number"
            min={1}
            step={1}
            value={v.thresholds[0]}
            onChange={(e) => setV({
              ...v,
              thresholds: [parseInt(e.target.value, 10) || 1, v.thresholds[1]],
            })}
          />
          <Input
            label="Seuil Level 3 (réservations)"
            type="number"
            min={1}
            step={1}
            value={v.thresholds[1]}
            onChange={(e) => setV({
              ...v,
              thresholds: [v.thresholds[0], parseInt(e.target.value, 10) || 1],
            })}
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {(["Level 1 (Explorer)", "Level 2 (Voyageur)", "Level 3 (Ambassador)"] as const).map((label, idx) => (
            <Input
              key={label}
              label={`${label} — réduction (%)`}
              type="number"
              min={0}
              max={100}
              step={1}
              value={v.discounts[idx]}
              onChange={(e) => {
                const next = [...v.discounts] as [number, number, number];
                next[idx] = parseFloat(e.target.value) || 0;
                setV({ ...v, discounts: next });
              }}
            />
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex items-center gap-3">
        <Button onClick={save} disabled={isPending}>Enregistrer</Button>
        <StatusPill status={status} error={error} />
      </CardFooter>
    </Card>
  );
}

/* ─────────────────────────── CANCELLATION ─────────────────────────── */

const POLICY_LABELS: Record<keyof SettingValue<"cancellation">, string> = {
  free: "Gratuite",
  flexible: "Flexible",
  moderate: "Modérée",
  strict: "Stricte",
  non_refundable: "Non remboursable",
};

function CancellationSection({ initial }: { initial: SettingValue<"cancellation"> }) {
  const [v, setV] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    setStatus("saving");
    startTransition(async () => {
      try {
        await saveSection("cancellation", v);
        setStatus("saved");
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function updateBucket(policy: keyof SettingValue<"cancellation">, idx: number, field: "days" | "percent", value: number) {
    const nextBuckets = v[policy].map((b, i) =>
      i === idx ? { ...b, [field]: value } : b,
    );
    setV({ ...v, [policy]: nextBuckets });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-[#1B3A6B]" />
          <CardTitle>Grille d&apos;annulation</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Pour chaque politique, la ligne « à partir de N jours » applique
          le pourcentage de frais indiqué. Le seuil <code>0</code> capture
          l&apos;annulation le jour même.
        </p>
        {(Object.keys(POLICY_LABELS) as (keyof SettingValue<"cancellation">)[]).map((policy) => (
          <div key={policy} className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">{POLICY_LABELS[policy]}</h4>
            <div className="space-y-2">
              {v[policy].map((bucket, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 w-16">Dès</span>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={bucket.days}
                    onChange={(e) => updateBucket(policy, idx, "days", parseInt(e.target.value, 10) || 0)}
                    className="w-24"
                  />
                  <span className="text-sm text-gray-500">jours →</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={bucket.percent}
                    onChange={(e) => updateBucket(policy, idx, "percent", parseFloat(e.target.value) || 0)}
                    className="w-24"
                  />
                  <span className="text-sm text-gray-500">% de frais</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex items-center gap-3">
        <Button onClick={save} disabled={isPending}>Enregistrer</Button>
        <StatusPill status={status} error={error} />
      </CardFooter>
    </Card>
  );
}

/* ─────────────────────────── NOTIFICATIONS ─────────────────────────── */

const NOTIF_LABELS: Record<keyof SettingValue<"notifications">, string> = {
  welcomeEmail: "Email de bienvenue",
  bookingConfirmation: "Confirmation de réservation",
  bookingReminderJ3: "Rappel de voyage J-3",
  bookingReminderJ1: "Rappel de voyage J-1",
  reviewRequest: "Demande d'avis post-séjour",
  priceAlerts: "Alertes prix favoris",
  newsletter: "Newsletter promotionnelle",
};

function NotificationsSection({ initial }: { initial: SettingValue<"notifications"> }) {
  const [v, setV] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    setStatus("saving");
    startTransition(async () => {
      try {
        await saveSection("notifications", v);
        setStatus("saved");
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Bell className="w-5 h-5 text-[#1B3A6B]" />
          <CardTitle>Notifications email</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {(Object.keys(NOTIF_LABELS) as (keyof SettingValue<"notifications">)[]).map((k) => (
          <div key={k} className="flex items-center justify-between py-2">
            <span className="text-sm text-gray-700">{NOTIF_LABELS[k]}</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={v[k]}
                onChange={(e) => setV({ ...v, [k]: e.target.checked })}
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#1B3A6B] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1B3A6B]"></div>
            </label>
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex items-center gap-3">
        <Button onClick={save} disabled={isPending}>Enregistrer</Button>
        <StatusPill status={status} error={error} />
      </CardFooter>
    </Card>
  );
}

/* ─────────────────────────── SECURITY ─────────────────────────── */

function SecuritySection({ initial }: { initial: SettingValue<"security"> }) {
  const [v, setV] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    setStatus("saving");
    startTransition(async () => {
      try {
        await saveSection("security", v);
        setStatus("saved");
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-[#1B3A6B]" />
          <CardTitle>Sécurité</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Longueur min. mot de passe"
            type="number"
            min={6}
            max={64}
            step={1}
            value={v.minPasswordLength}
            onChange={(e) => setV({ ...v, minPasswordLength: parseInt(e.target.value, 10) || 8 })}
          />
          <Input
            label="Durée de session (jours)"
            type="number"
            min={1}
            max={90}
            step={1}
            value={v.sessionDays}
            onChange={(e) => setV({ ...v, sessionDays: parseInt(e.target.value, 10) || 30 })}
          />
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="font-medium text-gray-900">2FA obligatoire hébergeurs</p>
            <p className="text-sm text-gray-500">Exiger la 2FA pour tous les comptes hébergeurs</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={v.twoFactorRequiredHosts}
              onChange={(e) => setV({ ...v, twoFactorRequiredHosts: e.target.checked })}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#1B3A6B] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1B3A6B]"></div>
          </label>
        </div>
        <div className="flex items-center justify-between py-2">
          <div>
            <p className="font-medium text-gray-900">Mode maintenance</p>
            <p className="text-sm text-gray-500">
              Prépare l&apos;affichage d&apos;une page maintenance (paramètre
              enregistré, activation front à cabler ultérieurement).
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={v.maintenanceMode}
              onChange={(e) => setV({ ...v, maintenanceMode: e.target.checked })}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#1B3A6B] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
          </label>
        </div>
      </CardContent>
      <CardFooter className="flex items-center gap-3">
        <Button onClick={save} disabled={isPending}>Enregistrer</Button>
        <StatusPill status={status} error={error} />
      </CardFooter>
    </Card>
  );
}

/* ─────────────────────────── EMAIL TEMPLATES (T-025) ─────────────────────────── */

const TEMPLATE_LABELS: Record<keyof SettingValue<"emailTemplates">, { title: string; vars: string }> = {
  emailVerification: {
    title: "Vérification email",
    vars: "{firstName}, {url}",
  },
  passwordReset: {
    title: "Réinitialisation mot de passe",
    vars: "{firstName}, {url}",
  },
  bookingConfirmation: {
    title: "Confirmation de réservation (voyageur)",
    vars: "{firstName}, {bookingReference}, {propertyName}, {city}, {checkIn}, {checkOut}, {total}, {currency}",
  },
  bookingHostNotification: {
    title: "Nouvelle réservation (hôte)",
    vars: "{hostFirstName}, {bookingReference}, {propertyName}, {guestName}, {checkIn}, {checkOut}",
  },
  bookingCancellation: {
    title: "Annulation de réservation (voyageur)",
    vars: "{firstName}, {bookingReference}, {propertyName}, {cancellationFee}, {currency}",
  },
  newMessage: {
    title: "Nouveau message reçu",
    vars: "{firstName}, {senderName}",
  },
};

function EmailTemplatesSection({ initial }: { initial: SettingValue<"emailTemplates"> }) {
  const [v, setV] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    setStatus("saving");
    startTransition(async () => {
      try {
        await saveSection("emailTemplates", v);
        setStatus("saved");
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function updateTemplate(
    key: keyof SettingValue<"emailTemplates">,
    field: "subject" | "body",
    value: string,
  ) {
    setV({ ...v, [key]: { ...v[key], [field]: value } });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Mail className="w-5 h-5 text-[#1B3A6B]" />
          <CardTitle>Templates emails</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Éditez le sujet et le paragraphe principal de chaque email
          transactionnel. Les placeholders <code>{"{name}"}</code> sont
          remplacés automatiquement (variables listées sous chaque template).
          Le layout HTML (branding, boutons, tableau récap) reste figé.
        </p>
        {(Object.keys(TEMPLATE_LABELS) as (keyof SettingValue<"emailTemplates">)[]).map((key) => {
          const meta = TEMPLATE_LABELS[key];
          return (
            <div key={key} className="border border-gray-200 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-gray-900">{meta.title}</h4>
              <Input
                label="Sujet"
                value={v[key].subject}
                onChange={(e) => updateTemplate(key, "subject", e.target.value)}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Corps du message
                </label>
                <textarea
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] font-mono text-sm"
                  rows={4}
                  value={v[key].body}
                  onChange={(e) => updateTemplate(key, "body", e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-500 font-mono">Variables : {meta.vars}</p>
            </div>
          );
        })}
      </CardContent>
      <CardFooter className="flex items-center gap-3">
        <Button onClick={save} disabled={isPending}>Enregistrer</Button>
        <StatusPill status={status} error={error} />
      </CardFooter>
    </Card>
  );
}

/* ─────────────────────────── PROVIDERS ─────────────────────────── */

function ProvidersSection({ providers }: { providers: Providers }) {
  const items: { key: keyof Providers; name: string; help: string }[] = [
    { key: "stripe", name: "Stripe", help: "STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET" },
    { key: "resend", name: "Resend (email)", help: "RESEND_API_KEY" },
    { key: "s3", name: "S3 (uploads)", help: "S3_ENDPOINT / _BUCKET / _ACCESS_KEY / _SECRET_KEY" },
  ];
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Package className="w-5 h-5 text-[#1B3A6B]" />
          <CardTitle>Providers externes (lecture seule)</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-gray-500">
          Les clés d&apos;API sont pilotées par variables d&apos;environnement
          — leur modification exige un redéploiement. Cette section
          affiche uniquement l&apos;état (jamais les clés).
        </p>
        {items.map(({ key, name, help }) => (
          <div key={key} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
            <div>
              <p className="font-medium text-gray-900">{name}</p>
              <p className="text-xs text-gray-500 font-mono">{help}</p>
            </div>
            {providers[key] ? (
              <span className="inline-flex items-center gap-1 text-green-700 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" /> Configuré
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-gray-500 text-sm">
                <XCircle className="w-4 h-4" /> Non configuré
              </span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
