"use client";

/**
 * Panneau d'administration configurable (T-021, ADR-007).
 * Chaque section rend son propre formulaire client contrôlé, avec
 * bouton d'enregistrement individuel et rate-limit côté serveur.
 */

import { useEffect, useState, useTransition } from "react";
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

        <div className="border-t border-gray-100 pt-4 mt-2">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">Mentions légales des factures</h3>
          <p className="text-xs text-gray-500 mb-4">
            Renseigner la société émettrice et ses numéros légaux fait passer
            les documents de « Reçu » à « Facture » conforme. Tant que ces
            champs sont vides, le document porte la mention « non conforme
            facturation légale ».
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Raison sociale"
              value={v.companyLegalName ?? ""}
              onChange={(e) => setV({ ...v, companyLegalName: e.target.value })}
              placeholder="MyBestBooking SAS"
            />
            <Input
              label="SIREN / SIRET / RCCM"
              value={v.companyLegalId ?? ""}
              onChange={(e) => setV({ ...v, companyLegalId: e.target.value })}
              placeholder="SIRET 123 456 789 00010"
            />
            <Input
              label="N° de TVA"
              value={v.vatNumber ?? ""}
              onChange={(e) => setV({ ...v, vatNumber: e.target.value })}
              placeholder="FR 12 345678901"
            />
            <Input
              label="Email de contact facturation"
              type="email"
              value={v.companyContactEmail ?? ""}
              onChange={(e) => setV({ ...v, companyContactEmail: e.target.value })}
              placeholder="facturation@exemple.com"
            />
            <Input
              label="Préfixe des numéros de facture"
              value={v.invoicePrefix ?? "FAC-"}
              onChange={(e) => setV({ ...v, invoicePrefix: e.target.value })}
            />
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Adresse de la société</label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900"
              rows={2}
              value={v.companyAddress ?? ""}
              onChange={(e) => setV({ ...v, companyAddress: e.target.value })}
              placeholder="12 rue du Plateau, 75019 Paris, France"
            />
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Pied de facture (CGV, pénalités, IBAN…)</label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900"
              rows={3}
              value={v.invoiceFooter ?? ""}
              onChange={(e) => setV({ ...v, invoiceFooter: e.target.value })}
            />
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

/* ─────────────────────────── SECURITY ─────────────────────────── */

function SecuritySection({ initial }: { initial: SettingValue<"security"> }) {
  const [maintenanceMode, setMaintenanceMode] = useState(initial.maintenanceMode);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setStatus("saving"); setError(null);
    startTransition(async () => {
      try {
        // Conserve les clés legacy mais n'expose comme toggle que la seule
        // politique effectivement lue par le runtime: maintenanceMode.
        await saveSection("security", { ...initial, maintenanceMode });
        setStatus("saved");
      } catch (reason) {
        setStatus("error"); setError(reason instanceof Error ? reason.message : "Erreur");
      }
    });
  }

  return <Card>
    <CardHeader><div className="flex items-center gap-3"><Shield className="w-5 h-5 text-[#1B3A6B]" /><CardTitle>Sécurité opérationnelle</CardTitle></div></CardHeader>
    <CardContent className="space-y-4">
      <div className="flex items-center justify-between py-2">
        <div><p className="font-medium text-gray-900">Mode maintenance</p><p className="text-sm text-gray-500">Bloque les parcours métier non admin; les routes administrateur restent accessibles pour éviter un verrouillage.</p></div>
        <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={maintenanceMode} onChange={(e) => setMaintenanceMode(e.target.checked)} /><div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#1B3A6B] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600" /></label>
      </div>
      <p className="text-xs text-gray-500 border-t pt-3">Les politiques de mot de passe, durée de session, obligation 2FA hôte et campagnes email ne sont pas encore configurables à chaud. Elles ne sont donc volontairement pas présentées comme des contrôles actifs.</p>
    </CardContent>
    <CardFooter className="flex items-center gap-3"><Button onClick={save} disabled={isPending}>Enregistrer</Button><StatusPill status={status} error={error} /></CardFooter>
  </Card>;
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

type ProviderKey = "stripe" | "resend" | "s3";
type ProviderMetadata = {
  provider: ProviderKey;
  configured: boolean;
  encryptionReady: boolean;
  previousKeyConfigured: boolean;
  source: "database" | "environment" | "none";
  fields: { name: string; stored: boolean; environment: boolean; updatedAt: string | null }[];
  lastTest: { status: string; message: string | null; createdAt: string } | null;
};

const PROVIDER_UI: Record<ProviderKey, { name: string; fields: { key: string; label: string; secret?: boolean }[] }> = {
  stripe: {
    name: "Stripe",
    fields: [
      { key: "secretKey", label: "Clé secrète Stripe", secret: true },
      { key: "webhookSecret", label: "Secret webhook Stripe", secret: true },
      { key: "publishableKey", label: "Clé publique Stripe" },
    ],
  },
  resend: {
    name: "Resend (emails)",
    fields: [
      { key: "apiKey", label: "Clé API Resend", secret: true },
      { key: "mailFrom", label: "Expéditeur (MAIL_FROM)" },
    ],
  },
  s3: {
    name: "S3 / R2 (uploads)",
    fields: [
      { key: "endpoint", label: "Endpoint" },
      { key: "region", label: "Région" },
      { key: "bucket", label: "Bucket" },
      { key: "accessKey", label: "Access key", secret: true },
      { key: "secretKey", label: "Secret key", secret: true },
      { key: "publicBaseUrl", label: "Base URL publique" },
    ],
  },
};

function ProvidersSection({ providers }: { providers: Providers }) {
  const [metadata, setMetadata] = useState<ProviderMetadata[] | null>(null);
  const [values, setValues] = useState<Record<ProviderKey, Record<string, string>>>({ stripe: {}, resend: {}, s3: {} });
  const [busy, setBusy] = useState<ProviderKey | "rotation" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch("/api/admin/providers", { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? "Impossible de lire les providers");
    setMetadata(body.providers);
  }

  useEffect(() => {
    let active = true;
    async function loadMetadata() {
      try {
        const response = await fetch("/api/admin/providers", { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? "Impossible de lire les providers");
        if (active) setMetadata(body.providers);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Erreur");
      }
    }
    void loadMetadata();
    return () => { active = false; };
  }, []);

  async function save(provider: ProviderKey) {
    const nonEmpty = Object.fromEntries(Object.entries(values[provider]).filter(([, value]) => value.trim()));
    if (!Object.keys(nonEmpty).length) {
      setError("Saisissez au moins une valeur à mettre à jour. Les champs vides ne remplacent jamais une clé existante.");
      return;
    }
    setBusy(provider); setError(null); setSuccess(null);
    try {
      const response = await fetch(`/api/admin/providers/${provider}`, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ values: nonEmpty }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Impossible d'enregistrer le provider");
      setValues((current) => ({ ...current, [provider]: {} }));
      setSuccess(`${PROVIDER_UI[provider].name} enregistré. Les valeurs ne sont jamais réaffichées.`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erreur");
    } finally { setBusy(null); }
  }

  async function testConnection(provider: ProviderKey) {
    setBusy(provider); setError(null); setSuccess(null);
    try {
      const response = await fetch(`/api/admin/providers/${provider}`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Test provider échoué");
      setSuccess(`${PROVIDER_UI[provider].name} : connexion validée.`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erreur");
    } finally { setBusy(null); }
  }

  async function rotateCredentials() {
    if (!window.confirm("Réchiffrer tous les overrides avec la nouvelle clé maître ? Vérifiez que CREDENTIALS_ENCRYPTION_KEY est la nouvelle clé et CREDENTIALS_ENCRYPTION_KEY_PREVIOUS l’ancienne.")) return;
    setBusy("rotation"); setError(null); setSuccess(null);
    try {
      const response = await fetch("/api/admin/providers/rotation", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: "ROTATE_CREDENTIALS" }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Impossible de réchiffrer le coffre");
      setSuccess(`Coffre réchiffré : ${body.reencrypted} valeur(s). Vérifiez les providers puis retirez CREDENTIALS_ENCRYPTION_KEY_PREVIOUS.`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erreur");
    } finally { setBusy(null); }
  }

  async function reset(provider: ProviderKey) {
    if (!window.confirm(`Retirer les overrides chiffrés ${PROVIDER_UI[provider].name} et revenir aux variables d’environnement ?`)) return;
    setBusy(provider); setError(null); setSuccess(null);
    try {
      const response = await fetch(`/api/admin/providers/${provider}`, {
        method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmProvider: provider }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Impossible de réinitialiser le provider");
      setSuccess(`${PROVIDER_UI[provider].name} revient aux variables d’environnement.`);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Erreur");
    } finally { setBusy(null); }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3"><Package className="w-5 h-5 text-[#1B3A6B]" /><CardTitle>Providers externes sécurisés</CardTitle></div>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-gray-600">Les valeurs saisies sont chiffrées côté serveur avec une clé maître hors base de données. Elles ne sont jamais affichées, même à un administrateur. Les champs vides conservent la valeur actuelle.</p>
        {metadata?.some((provider) => provider.previousKeyConfigured) && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <p className="font-medium">Rotation de clé prête</p>
            <p className="mt-1">La clé précédente est détectée côté serveur. Après sauvegarde de la nouvelle clé primaire, réchiffrez le coffre, testez les providers, puis retirez la variable précédente.</p>
            <Button size="sm" className="mt-3" variant="outline" onClick={rotateCredentials} disabled={busy !== null}>{busy === "rotation" ? "Réchiffrement…" : "Réchiffrer le coffre"}</Button>
          </div>
        )}
        {(Object.keys(PROVIDER_UI) as ProviderKey[]).map((provider) => {
          const meta = metadata?.find((item) => item.provider === provider);
          const fallbackConfigured = providers[provider];
          return (
            <section key={provider} className="border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h4 className="font-semibold text-gray-900">{PROVIDER_UI[provider].name}</h4><p className="text-xs text-gray-500">Source : {meta?.source ?? "chargement…"}</p></div>
                {(meta?.configured ?? fallbackConfigured) ? <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" /> Configuré</Badge> : <Badge variant="warning"><XCircle className="w-3 h-3 mr-1" /> Non configuré</Badge>}
              </div>
              {meta && !meta.encryptionReady && <p className="text-xs text-amber-800 bg-amber-50 p-2 rounded">Ajoutez `CREDENTIALS_ENCRYPTION_KEY` dans l’environnement du serveur pour autoriser l’enregistrement web chiffré.</p>}
              {meta?.lastTest && <p className={`text-xs p-2 rounded ${meta.lastTest.status === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>Dernier test : {new Date(meta.lastTest.createdAt).toLocaleString("fr-FR")} — {meta.lastTest.status === "success" ? "réussi" : "échec"}{meta.lastTest.message ? ` (${meta.lastTest.message})` : ""}</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PROVIDER_UI[provider].fields.map((field) => {
                  const status = meta?.fields.find((item) => item.name === field.key);
                  return <label key={field.key} className="block text-sm font-medium text-gray-700">{field.label}
                    <input type={field.secret ? "password" : "text"} autoComplete="off" value={values[provider][field.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [provider]: { ...current[provider], [field.key]: event.target.value } }))} placeholder={status?.stored ? "Valeur chiffrée enregistrée — saisir pour remplacer" : status?.environment ? "Fourni par l’environnement — saisir pour remplacer" : "Non configuré"} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm" />
                    <span className="mt-1 block text-xs text-gray-500">{status?.stored ? "Override chiffré en base" : status?.environment ? "Fallback environnement" : "Aucune valeur"}</span>
                  </label>;
                })}
              </div>
              <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => save(provider)} disabled={busy === provider || meta?.encryptionReady === false}>{busy === provider ? "Enregistrement…" : "Enregistrer les champs saisis"}</Button><Button size="sm" variant="outline" onClick={() => testConnection(provider)} disabled={busy === provider || !(meta?.configured ?? fallbackConfigured)}>Tester la connexion</Button><Button size="sm" variant="ghost" onClick={() => reset(provider)} disabled={busy === provider}>Revenir à l’environnement</Button></div>
            </section>
          );
        })}
        {success && <p className="text-sm text-green-700">{success}</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </CardContent>
    </Card>
  );
}
