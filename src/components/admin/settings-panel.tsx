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
import { useT, useUiLocale } from "@/components/ui-locale-provider";
import type { UiStringKey } from "@/lib/ui-strings";

type AllSettings = { [K in SettingKey]: SettingValue<K> };
type Providers = { stripe: boolean; resend: boolean; s3: boolean };

interface Props {
  initial: AllSettings;
  providers: Providers;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

async function saveSection<K extends SettingKey>(
  key: K,
  value: SettingValue<K>,
  fallback: string,
) {
  const res = await fetch(`/api/admin/settings/${key}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({ error: fallback }));
    throw new Error(j.error || fallback);
  }
  return (await res.json()) as { key: K; value: SettingValue<K> };
}

function StatusPill({ status, error }: { status: SaveStatus; error?: string | null }) {
  const t = useT();
  if (status === "saving") return <Badge variant="info">{t("settings.saving")}</Badge>;
  if (status === "saved") return <Badge variant="success">{t("settings.saved")}</Badge>;
  if (status === "error") return <Badge variant="danger">{error || t("settings.error")}</Badge>;
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
  const t = useT();
  const [v, setV] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    setStatus("saving");
    startTransition(async () => {
      try {
        await saveSection("general", v, t("settings.saveError"));
        setStatus("saved");
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : t("settings.error"));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5 text-[#1B3A6B]" />
          <CardTitle>{t("settings.general")}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          label={t("settings.siteName")}
          value={v.siteName}
          onChange={(e) => setV({ ...v, siteName: e.target.value })}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t("settings.supportEmail")}
            type="email"
            value={v.supportEmail}
            onChange={(e) => setV({ ...v, supportEmail: e.target.value })}
          />
          <Input
            label={t("settings.partnersEmail")}
            type="email"
            value={v.partnersEmail}
            onChange={(e) => setV({ ...v, partnersEmail: e.target.value })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("settings.defaultLanguage")}</label>
            <select
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg"
              value={v.defaultLanguage}
              onChange={(e) => setV({ ...v, defaultLanguage: e.target.value as typeof v.defaultLanguage })}
            >
              <option value="fr">🇫🇷 {t("account.langFr")}</option>
              <option value="en">🇬🇧 {t("account.langEn")}</option>
              {/* T-145 : l'arabe n'est pas une locale UI supportée (UiLocale
                  = "fr" | "en") ; le proposer faisait retomber l'affichage en
                  français. Retiré jusqu'à une vraie traduction. */}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("settings.defaultCurrency")}</label>
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
        <Button onClick={save} disabled={isPending}>{t("action.save")}</Button>
        <StatusPill status={status} error={error} />
      </CardFooter>
    </Card>
  );
}

/* ─────────────────────────── BILLING ─────────────────────────── */

function BillingSection({ initial }: { initial: SettingValue<"billing"> }) {
  const t = useT();
  const [v, setV] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    setStatus("saving");
    startTransition(async () => {
      try {
        await saveSection("billing", v, t("settings.saveError"));
        setStatus("saved");
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : t("settings.error"));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <CreditCard className="w-5 h-5 text-[#1B3A6B]" />
          <CardTitle>{t("settings.billing")}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t("settings.taxRate")}
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={(v.taxRate * 100).toFixed(2)}
            onChange={(e) => setV({ ...v, taxRate: parseFloat(e.target.value) / 100 })}
          />
          <Input
            label={t("settings.commission")}
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={v.defaultCommissionRate}
            onChange={(e) => setV({ ...v, defaultCommissionRate: parseFloat(e.target.value) })}
          />
        </div>
        <p className="text-xs text-gray-500">
          {t("settings.billingNote")}
        </p>

        <div className="border-t border-gray-100 pt-4 mt-2">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">{t("settings.invoiceLegal")}</h3>
          <p className="text-xs text-gray-500 mb-4">
            {t("settings.invoiceLegalBody")}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label={t("settings.legalName")}
              value={v.companyLegalName ?? ""}
              onChange={(e) => setV({ ...v, companyLegalName: e.target.value })}
              placeholder="MyBestBooking SAS"
            />
            <Input
              label={t("settings.legalId")}
              value={v.companyLegalId ?? ""}
              onChange={(e) => setV({ ...v, companyLegalId: e.target.value })}
              placeholder="SIRET 123 456 789 00010"
            />
            <Input
              label={t("settings.vat")}
              value={v.vatNumber ?? ""}
              onChange={(e) => setV({ ...v, vatNumber: e.target.value })}
              placeholder="FR 12 345678901"
            />
            <Input
              label={t("settings.billingEmail")}
              type="email"
              value={v.companyContactEmail ?? ""}
              onChange={(e) => setV({ ...v, companyContactEmail: e.target.value })}
              placeholder="facturation@exemple.com"
            />
            <Input
              label={t("settings.invoicePrefix")}
              value={v.invoicePrefix ?? "FAC-"}
              onChange={(e) => setV({ ...v, invoicePrefix: e.target.value })}
            />
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("settings.companyAddress")}</label>
            <textarea
              className="block w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900"
              rows={2}
              value={v.companyAddress ?? ""}
              onChange={(e) => setV({ ...v, companyAddress: e.target.value })}
              placeholder="12 rue du Plateau, 75019 Paris, France"
            />
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">{t("settings.invoiceFooter")}</label>
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
        <Button onClick={save} disabled={isPending}>{t("action.save")}</Button>
        <StatusPill status={status} error={error} />
      </CardFooter>
    </Card>
  );
}

/* ─────────────────────────── BESTREWARDS ─────────────────────────── */

function BestrewardsSection({ initial }: { initial: SettingValue<"bestrewards"> }) {
  const t = useT();
  const [v, setV] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    setStatus("saving");
    startTransition(async () => {
      try {
        await saveSection("bestrewards", v, t("settings.saveError"));
        setStatus("saved");
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : t("settings.error"));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Award className="w-5 h-5 text-[#F5A623]" />
          <CardTitle>{t("settings.bestrewards")}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          {t("settings.bestrewardsBody")}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label={t("settings.threshold2")}
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
            label={t("settings.threshold3")}
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
          {([t("settings.level1"), t("settings.level2"), t("settings.level3")] as const).map((label, idx) => (
            <Input
              key={label}
              label={t("settings.discountPct").replace("{label}", label)}
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
        <Button onClick={save} disabled={isPending}>{t("action.save")}</Button>
        <StatusPill status={status} error={error} />
      </CardFooter>
    </Card>
  );
}

/* ─────────────────────────── CANCELLATION ─────────────────────────── */

function CancellationSection({ initial }: { initial: SettingValue<"cancellation"> }) {
  const t = useT();
  const POLICY_LABELS: Record<keyof SettingValue<"cancellation">, string> = {
    free: t("settings.policyFree"),
    flexible: t("settings.policyFlexible"),
    moderate: t("settings.policyModerate"),
    strict: t("settings.policyStrict"),
    non_refundable: t("settings.policyNonRefundable"),
  };
  const [v, setV] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    setStatus("saving");
    startTransition(async () => {
      try {
        await saveSection("cancellation", v, t("settings.saveError"));
        setStatus("saved");
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : t("settings.error"));
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
          <CardTitle>{t("settings.cancellationGrid")}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          {t("settings.cancellationBody")}
        </p>
        {(Object.keys(POLICY_LABELS) as (keyof SettingValue<"cancellation">)[]).map((policy) => (
          <div key={policy} className="border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 mb-3">{POLICY_LABELS[policy]}</h4>
            <div className="space-y-2">
              {v[policy].map((bucket, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-sm text-gray-500 w-16">{t("settings.from")}</span>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={bucket.days}
                    onChange={(e) => updateBucket(policy, idx, "days", parseInt(e.target.value, 10) || 0)}
                    className="w-24"
                  />
                  <span className="text-sm text-gray-500">{t("settings.daysArrow")}</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={bucket.percent}
                    onChange={(e) => updateBucket(policy, idx, "percent", parseFloat(e.target.value) || 0)}
                    className="w-24"
                  />
                  <span className="text-sm text-gray-500">{t("settings.feePct")}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex items-center gap-3">
        <Button onClick={save} disabled={isPending}>{t("action.save")}</Button>
        <StatusPill status={status} error={error} />
      </CardFooter>
    </Card>
  );
}

/* ─────────────────────────── SECURITY ─────────────────────────── */

function SecuritySection({ initial }: { initial: SettingValue<"security"> }) {
  const t = useT();
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
        await saveSection("security", { ...initial, maintenanceMode }, t("settings.saveError"));
        setStatus("saved");
      } catch (reason) {
        setStatus("error"); setError(reason instanceof Error ? reason.message : t("settings.error"));
      }
    });
  }

  return <Card>
    <CardHeader><div className="flex items-center gap-3"><Shield className="w-5 h-5 text-[#1B3A6B]" /><CardTitle>{t("settings.security")}</CardTitle></div></CardHeader>
    <CardContent className="space-y-4">
      <div className="flex items-center justify-between py-2">
        <div><p className="font-medium text-gray-900">{t("settings.maintenance")}</p><p className="text-sm text-gray-500">{t("settings.maintenanceBody")}</p></div>
        <label className="relative inline-flex items-center cursor-pointer"><input type="checkbox" className="sr-only peer" checked={maintenanceMode} onChange={(e) => setMaintenanceMode(e.target.checked)} /><div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#1B3A6B] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600" /></label>
      </div>
      <p className="text-xs text-gray-500 border-t pt-3">{t("settings.securityNote")}</p>
    </CardContent>
    <CardFooter className="flex items-center gap-3"><Button onClick={save} disabled={isPending}>{t("action.save")}</Button><StatusPill status={status} error={error} /></CardFooter>
  </Card>;
}

/* ─────────────────────────── EMAIL TEMPLATES (T-025) ─────────────────────────── */

function EmailTemplatesSection({ initial }: { initial: SettingValue<"emailTemplates"> }) {
  const t = useT();
  const TEMPLATE_LABELS: Record<keyof SettingValue<"emailTemplates">, { title: string; vars: string }> = {
    emailVerification: {
      title: t("settings.tplVerify"),
      vars: "{firstName}, {url}",
    },
    passwordReset: {
      title: t("settings.tplReset"),
      vars: "{firstName}, {url}",
    },
    welcomeEmail: {
      title: t("settings.tplWelcome"),
      vars: "{firstName}, {url}",
    },
    bookingConfirmation: {
      title: t("settings.tplBooking"),
      vars: "{firstName}, {bookingReference}, {propertyName}, {city}, {checkIn}, {checkOut}, {total}, {currency}",
    },
    bookingHostNotification: {
      title: t("settings.tplHost"),
      vars: "{hostFirstName}, {bookingReference}, {propertyName}, {guestName}, {checkIn}, {checkOut}",
    },
    bookingCancellation: {
      title: t("settings.tplCancel"),
      vars: "{firstName}, {bookingReference}, {propertyName}, {cancellationFee}, {currency}",
    },
    bookingReminder: {
      title: t("settings.tplReminder"),
      vars: "{firstName}, {bookingReference}, {propertyName}, {city}, {checkIn}, {checkOut}, {daysLabel}, {url}",
    },
    reviewRequest: {
      title: t("settings.tplReview"),
      vars: "{firstName}, {propertyName}, {bookingReference}, {url}",
    },
    newMessage: {
      title: t("settings.tplMessage"),
      vars: "{firstName}, {senderName}, {url}",
    },
  };
  const [v, setV] = useState(initial);
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    setStatus("saving");
    startTransition(async () => {
      try {
        await saveSection("emailTemplates", v, t("settings.saveError"));
        setStatus("saved");
      } catch (e) {
        setStatus("error");
        setError(e instanceof Error ? e.message : t("settings.error"));
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
          <CardTitle>{t("settings.emails")}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          {t("settings.emailsBody")}
        </p>
        {(Object.keys(TEMPLATE_LABELS) as (keyof SettingValue<"emailTemplates">)[]).map((key) => {
          const meta = TEMPLATE_LABELS[key];
          return (
            <div key={key} className="border border-gray-200 rounded-lg p-4 space-y-3">
              <h4 className="font-medium text-gray-900">{meta.title}</h4>
              <Input
                label={t("settings.subject")}
                value={v[key].subject}
                onChange={(e) => updateTemplate(key, "subject", e.target.value)}
              />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t("settings.body")}
                </label>
                <textarea
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1B3A6B] font-mono text-sm"
                  rows={4}
                  value={v[key].body}
                  onChange={(e) => updateTemplate(key, "body", e.target.value)}
                />
              </div>
              <p className="text-xs text-gray-500 font-mono">{t("settings.variables").replace("{vars}", meta.vars)}</p>
            </div>
          );
        })}
      </CardContent>
      <CardFooter className="flex items-center gap-3">
        <Button onClick={save} disabled={isPending}>{t("action.save")}</Button>
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

function providerUi(t: (key: UiStringKey) => string): Record<ProviderKey, { name: string; fields: { key: string; label: string; secret?: boolean }[] }> {
  return {
    stripe: {
      name: "Stripe",
      fields: [
        { key: "secretKey", label: t("settings.stripeSecret"), secret: true },
        { key: "webhookSecret", label: t("settings.stripeWebhook"), secret: true },
        { key: "publishableKey", label: t("settings.stripePk") },
      ],
    },
    resend: {
      name: t("settings.resendName"),
      fields: [
        { key: "apiKey", label: t("settings.resendKey"), secret: true },
        { key: "mailFrom", label: t("settings.mailFrom") },
      ],
    },
    s3: {
      name: t("settings.s3Name"),
      fields: [
        { key: "endpoint", label: t("settings.endpoint") },
        { key: "region", label: t("settings.region") },
        { key: "bucket", label: t("settings.bucket") },
        { key: "accessKey", label: t("settings.accessKey"), secret: true },
        { key: "secretKey", label: t("settings.secretKey"), secret: true },
        { key: "publicBaseUrl", label: t("settings.publicBase") },
      ],
    },
  };
}

function ProvidersSection({ providers }: { providers: Providers }) {
  const t = useT();
  const locale = useUiLocale();
  const PROVIDER_UI = providerUi(t);
  const [metadata, setMetadata] = useState<ProviderMetadata[] | null>(null);
  const [values, setValues] = useState<Record<ProviderKey, Record<string, string>>>({ stripe: {}, resend: {}, s3: {} });
  const [busy, setBusy] = useState<ProviderKey | "rotation" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch("/api/admin/providers", { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? t("settings.readProvidersFail"));
    setMetadata(body.providers);
  }

  useEffect(() => {
    let active = true;
    async function loadMetadata() {
      try {
        const response = await fetch("/api/admin/providers", { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.error ?? t("settings.readProvidersFail"));
        if (active) setMetadata(body.providers);
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : t("settings.error"));
      }
    }
    void loadMetadata();
    return () => { active = false; };
  }, []);

  async function save(provider: ProviderKey) {
    const nonEmpty = Object.fromEntries(Object.entries(values[provider]).filter(([, value]) => value.trim()));
    if (!Object.keys(nonEmpty).length) {
      setError(t("settings.needValue"));
      return;
    }
    setBusy(provider); setError(null); setSuccess(null);
    try {
      const response = await fetch(`/api/admin/providers/${provider}`, {
        method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ values: nonEmpty }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? t("settings.providerSaveFail"));
      setValues((current) => ({ ...current, [provider]: {} }));
      setSuccess(t("settings.providerSaved").replace("{name}", PROVIDER_UI[provider].name));
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("settings.error"));
    } finally { setBusy(null); }
  }

  async function testConnection(provider: ProviderKey) {
    setBusy(provider); setError(null); setSuccess(null);
    try {
      const response = await fetch(`/api/admin/providers/${provider}`, { method: "POST" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? t("settings.providerTestFail"));
      setSuccess(t("settings.providerTestOk").replace("{name}", PROVIDER_UI[provider].name));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("settings.error"));
    } finally { setBusy(null); }
  }

  async function rotateCredentials() {
    if (!window.confirm(t("settings.rotateConfirm"))) return;
    setBusy("rotation"); setError(null); setSuccess(null);
    try {
      const response = await fetch("/api/admin/providers/rotation", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: "ROTATE_CREDENTIALS" }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? t("settings.rotateFail"));
      setSuccess(t("settings.rotateOk").replace("{n}", String(body.reencrypted)));
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("settings.error"));
    } finally { setBusy(null); }
  }

  async function reset(provider: ProviderKey) {
    if (!window.confirm(t("settings.resetConfirm").replace("{name}", PROVIDER_UI[provider].name))) return;
    setBusy(provider); setError(null); setSuccess(null);
    try {
      const response = await fetch(`/api/admin/providers/${provider}`, {
        method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmProvider: provider }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? t("settings.resetFail"));
      setSuccess(t("settings.resetOk").replace("{name}", PROVIDER_UI[provider].name));
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("settings.error"));
    } finally { setBusy(null); }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3"><Package className="w-5 h-5 text-[#1B3A6B]" /><CardTitle>{t("settings.providers")}</CardTitle></div>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-sm text-gray-600">{t("settings.providersBody")}</p>
        {metadata?.some((provider) => provider.previousKeyConfigured) && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <p className="font-medium">{t("settings.rotationReady")}</p>
            <p className="mt-1">{t("settings.rotationBody")}</p>
            <Button size="sm" className="mt-3" variant="outline" onClick={rotateCredentials} disabled={busy !== null}>{busy === "rotation" ? t("settings.reencrypting") : t("settings.reencrypt")}</Button>
          </div>
        )}
        {(Object.keys(PROVIDER_UI) as ProviderKey[]).map((provider) => {
          const meta = metadata?.find((item) => item.provider === provider);
          const fallbackConfigured = providers[provider];
          return (
            <section key={provider} className="border border-gray-200 rounded-lg p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><h4 className="font-semibold text-gray-900">{PROVIDER_UI[provider].name}</h4><p className="text-xs text-gray-500">{t("settings.source").replace("{src}", meta?.source ?? t("settings.loading"))}</p></div>
                {(meta?.configured ?? fallbackConfigured) ? <Badge variant="success"><CheckCircle2 className="w-3 h-3 mr-1" /> {t("settings.configured")}</Badge> : <Badge variant="warning"><XCircle className="w-3 h-3 mr-1" /> {t("settings.notConfigured")}</Badge>}
              </div>
              {meta && !meta.encryptionReady && <p className="text-xs text-amber-800 bg-amber-50 p-2 rounded">{t("settings.needKey")}</p>}
              {meta?.lastTest && <p className={`text-xs p-2 rounded ${meta.lastTest.status === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{t("settings.lastTest").replace("{when}", new Date(meta.lastTest.createdAt).toLocaleString(locale === "en" ? "en-GB" : "fr-FR")).replace("{status}", meta.lastTest.status === "success" ? t("settings.testOk") : t("settings.testFail"))}{meta.lastTest.message ? ` (${meta.lastTest.message})` : ""}</p>}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {PROVIDER_UI[provider].fields.map((field) => {
                  const status = meta?.fields.find((item) => item.name === field.key);
                  return <label key={field.key} className="block text-sm font-medium text-gray-700">{field.label}
                    <input type={field.secret ? "password" : "text"} autoComplete="off" value={values[provider][field.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [provider]: { ...current[provider], [field.key]: event.target.value } }))} placeholder={status?.stored ? t("settings.storedReplace") : status?.environment ? t("settings.envReplace") : t("settings.notSet")} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm" />
                    <span className="mt-1 block text-xs text-gray-500">{status?.stored ? t("settings.overrideDb") : status?.environment ? t("settings.envFallback") : t("settings.noValue")}</span>
                  </label>;
                })}
              </div>
              <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => save(provider)} disabled={busy === provider || meta?.encryptionReady === false}>{busy === provider ? t("settings.saving") : t("settings.saveFields")}</Button><Button size="sm" variant="outline" onClick={() => testConnection(provider)} disabled={busy === provider || !(meta?.configured ?? fallbackConfigured)}>{t("settings.testConn")}</Button><Button size="sm" variant="ghost" onClick={() => reset(provider)} disabled={busy === provider}>{t("settings.resetEnv")}</Button></div>
            </section>
          );
        })}
        {success && <p className="text-sm text-green-700">{success}</p>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      </CardContent>
    </Card>
  );
}
