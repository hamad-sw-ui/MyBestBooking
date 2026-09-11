"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  User, Award, Wallet, Shield, Bell, LogOut
} from "lucide-react";
import Link from "next/link";
import { ProfileForm } from "@/components/profile-form";
import { useT, useUiLocale } from "@/components/ui-locale-provider";
import { formatPrice } from "@/lib/utils";
import { useDisplayPreferences } from "@/lib/use-display-currency";
import { convertAmount, formatMoney, normalizeDisplayCurrency } from "@/lib/i18n";
import { UserAvatar } from "@/components/user-avatar";
import { ChangePasswordForm } from "@/components/change-password-form";
import { TwoFactorSection } from "@/components/two-factor-section";
import { DeleteAccountSection } from "@/components/delete-account-section";
import { NotificationPrefsSection } from "@/components/notification-prefs-section";
import { ReferralCard } from "@/components/referral-card";
import { ResendVerificationButton } from "@/components/resend-verification-button";
// T-248 (audit n°5, A6) : historique du wallet (lecture seule).
import { WalletHistoryCard } from "@/components/wallet-history-card";

interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  country: string | null;
  language: string | null;
  currency: string | null;
  role: string;
  approvalStatus: string | null;
  bestrewardsLevel: number | null;
  bestrewardsBookingsCount: number | null;
  walletBalance: string | null;
  emailVerified: boolean | null;
  twoFactorEnabled: boolean | null;
  timezone?: string | null;
  priceAlertEnabled?: boolean | null;
  avatarUrl?: string | null;
}

export default function MyAccountPage() {
  const router = useRouter();
  const t = useT();
  const locale = useUiLocale();
  const { currency: displayCurrency } = useDisplayPreferences();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");
  // T-143 : seuils/taux BestRewards lus depuis les réglages publics (mêmes
  // valeurs que la page /bestrewards) au lieu d'être codés en dur.
  const [rewardsConfig, setRewardsConfig] = useState<{
    thresholds: [number, number];
    discounts: [number, number, number];
  }>({ thresholds: [5, 15], discounts: [10, 15, 20] });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => {
        if (!res.ok) {
          router.push("/connexion");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setUser(data.user);
        }
        setLoading(false);
      });
    // Réglages BestRewards (non bloquant : repli sur les valeurs par défaut).
    fetch("/api/app-preferences")
      .then((res) => (res.ok ? res.json() : null))
      .then((prefs) => {
        if (prefs?.bestrewards?.thresholds && prefs?.bestrewards?.discounts) {
          setRewardsConfig({
            thresholds: prefs.bestrewards.thresholds,
            discounts: prefs.bestrewards.discounts,
          });
        }
      })
      .catch(() => {
        /* conserve les valeurs par défaut */
      });
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B3A6B]"></div>
      </div>
    );
  }

  if (!user) return null;

  // Niveaux dérivés des réglages publics (T-143) : mêmes seuils et taux que
  // la page /bestrewards. Le cashback Ambassador (5%) est une règle fixe de
  // la plateforme, également annoncée sur la page publique.
  const [level2Threshold, level3Threshold] = rewardsConfig.thresholds;
  const [level1Discount, level2Discount, level3Discount] = rewardsConfig.discounts;
  const bestrewardsLevels = [
    { level: 1, name: t("bestrewards.level1Name"), bookings: 0, benefits: t("account.benefitL1").replace("{pct}", String(level1Discount)) },
    { level: 2, name: t("bestrewards.level2Name"), bookings: level2Threshold, benefits: t("account.benefitL2").replace("{pct}", String(level2Discount)) },
    { level: 3, name: t("bestrewards.level3Name"), bookings: level3Threshold, benefits: t("account.benefitL3").replace("{pct}", String(level3Discount)) },
  ];

  const currentLevel = bestrewardsLevels.find((l) => l.level === user.bestrewardsLevel) || bestrewardsLevels[0];
  const nextLevel = bestrewardsLevels.find((l) => l.level === (user.bestrewardsLevel || 1) + 1);
  const bookingsToNextLevel = nextLevel ? nextLevel.bookings - (user.bestrewardsBookingsCount || 0) : 0;
  const hostApproval = user.role === "host"
    ? {
        label: t(user.approvalStatus === "approved" ? "dash.hostApproved" : user.approvalStatus === "rejected" ? "dash.hostRejected" : "dash.hostPending"),
        description: t(user.approvalStatus === "approved" ? "account.hostApprovedDesc" : user.approvalStatus === "rejected" ? "account.hostRejectedDesc" : "account.hostPendingDesc"),
        variant: (user.approvalStatus === "approved" ? "success" : user.approvalStatus === "rejected" ? "danger" : "warning") as "success" | "danger" | "warning",
      }
    : null;

  const tabs = [
    { id: "profile", label: t("account.tabProfile"), icon: User },
    { id: "bestrewards", label: t("nav.bestrewards"), icon: Award },
    { id: "security", label: t("account.security"), icon: Shield },
    { id: "notifications", label: t("account.notifications"), icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
            {t("account.title")}
          </h1>
          <p className="text-gray-600 mt-1">
            {t("account.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="md:col-span-1">
            <Card padding="sm">
              <CardContent className="space-y-1">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "bg-[#1B3A6B] text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
                <hr className="my-2" />
                <form action="/api/auth/logout" method="POST">
                  <button
                    type="submit"
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    {t("nav.logout")}
                  </button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Content */}
          <div className="md:col-span-3 space-y-6">
            {activeTab === "profile" && (
              <>
                {/* T-137 (A3) : renvoi de l'email de vérification si non vérifié. */}
                <ResendVerificationButton verified={user.emailVerified} />

                {/* Profile Info */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t("account.personalInfo")}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4 mb-6">
                      <UserAvatar avatarUrl={user.avatarUrl} firstName={user.firstName} lastName={user.lastName} size={80} className="text-2xl font-bold" />
                      <div>
                        <h3 className="text-lg font-semibold">{user.firstName} {user.lastName}</h3>
                        <p className="text-gray-500">{user.email}</p>
                        <Badge variant="bestrewards" className="mt-1">
                          💎 {currentLevel.name}
                        </Badge>
                      </div>
                    </div>

                    <div className="mb-2 text-sm text-gray-600">
                      {t("account.emailLabel")} : <strong>{user.email}</strong>{" "}
                      <span className="text-xs text-gray-500">
                        {t("account.emailReadonly")}
                      </span>
                    </div>
                    {hostApproval && (
                      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-gray-900">{t("account.hostApprovalTitle")}</span>
                          <Badge variant={hostApproval.variant}>{hostApproval.label}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">{hostApproval.description}</p>
                      </div>
                    )}
                    <ProfileForm initial={{
                      firstName: user.firstName,
                      lastName: user.lastName,
                      phone: user.phone,
                      country: user.country ?? null,
                      language: user.language ?? null,
                      currency: user.currency ?? null,
                      timezone: user.timezone ?? null,
                      // T-232 : fuseau utilisé pour exprimer les dates de
                      // saisie (elles-mêmes stockées en UTC).
                      displayTimezone: user.timezone ?? null,
                      avatarUrl: user.avatarUrl ?? null,
                    }} />
                  </CardContent>
                </Card>
              </>
            )}

            {activeTab === "bestrewards" && (
              <>
                {/* BestRewards Status */}
                <Card className="bg-gradient-to-br from-[#1B3A6B] to-[#0f2444] text-white">
                  <CardContent>
                    <div className="flex items-center gap-2 mb-4">
                      <Award className="w-8 h-8 text-[#F5A623]" />
                      <span className="text-2xl font-bold">BestRewards</span>
                    </div>
                    <div className="flex items-end justify-between mb-4">
                      <div>
                        <p className="text-white/70 text-sm">{t("account.yourLevel")}</p>
                        <p className="text-3xl font-bold">{currentLevel.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/70 text-sm">{t("account.bookingsCount")}</p>
                        <p className="text-3xl font-bold">{user.bestrewardsBookingsCount || 0}</p>
                      </div>
                    </div>
                    
                    {nextLevel && (
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>{t("account.progressTo").replace("{name}", nextLevel.name)}</span>
                          <span>{user.bestrewardsBookingsCount || 0}/{nextLevel.bookings}</span>
                        </div>
                        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#F5A623] rounded-full transition-all"
                            style={{ width: `${((user.bestrewardsBookingsCount || 0) / nextLevel.bookings) * 100}%` }}
                          />
                        </div>
                        <p className="text-sm text-white/70 mt-2">
                          {(bookingsToNextLevel > 1 ? t("account.toNextMany") : t("account.toNextOne")).replace("{n}", String(bookingsToNextLevel))}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Wallet */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="w-5 h-5" />
                      {t("account.walletTitle")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm text-gray-500">{t("account.availableBalance")}</p>
                        <p className="text-3xl font-bold text-[#1B3A6B]">
                          {(() => {
                            // T-195 — le solde wallet est libellé en EUR (crédits
                            // BestRewards/parrainage). On convertit l'AFFICHAGE en
                            // devise d'affichage ; la valeur débitée/restituée reste en EUR.
                            const walletEur = parseFloat(user.walletBalance || "0");
                            const target = normalizeDisplayCurrency(displayCurrency, "EUR");
                            return target === "EUR"
                              ? formatPrice(walletEur, "EUR", locale)
                              : formatMoney(convertAmount(walletEur, "EUR", target), target, locale);
                          })()}
                        </p>
                        {Boolean(displayCurrency) && (displayCurrency ?? "EUR").toUpperCase() !== "EUR" && (
                          <p className="text-xs text-gray-400">{t("wallet.convertedNote")}</p>
                        )}
                      </div>
                      {/* T-207 : le wallet reste informatif ; le CTA n'envoie
                          plus vers un tunnel de déduction/paiement. */}
                      <Link
                        href="/recherche"
                        className="inline-flex items-center px-4 py-2 rounded-lg border border-[#1B3A6B] text-[#1B3A6B] font-medium hover:bg-[#1B3A6B] hover:text-white transition"
                      >
                        {t("account.useBalance")}
                      </Link>
                    </div>
                    <p className="text-sm text-gray-500 mt-3">
                      {t("account.walletHint")}
                    </p>
                    <WalletHistoryCard />
                  </CardContent>
                </Card>

                {/* T-130 : parrainage réellement exposé (T-125 livré côté API) */}
                <ReferralCard />

                {/* Levels */}
                <Card>
                  <CardHeader>
                    <CardTitle>{t("account.levelsTitle")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {bestrewardsLevels.map((level) => (
                        <div 
                          key={level.level}
                          className={`p-4 rounded-lg border-2 ${
                            level.level === user.bestrewardsLevel 
                              ? "border-[#F5A623] bg-[#F5A623]/5" 
                              : "border-gray-100"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${
                                level.level <= (user.bestrewardsLevel || 1) ? "bg-[#F5A623]" : "bg-gray-300"
                              }`}>
                                {level.level}
                              </div>
                              <div>
                                <p className="font-semibold">{level.name}</p>
                                <p className="text-sm text-gray-500">{t("account.bookingsPlus").replace("{n}", String(level.bookings))}</p>
                              </div>
                            </div>
                            <p className="text-sm text-gray-600">{level.benefits}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {activeTab === "security" && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle>{t("account.password")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChangePasswordForm />
                  </CardContent>
                </Card>

                {/* T-030 : 2FA TOTP complète (setup + QR + verify + disable) */}
                <TwoFactorSection initiallyEnabled={user.twoFactorEnabled || false} />

                {/* T-030 : suppression compte réelle */}
                <DeleteAccountSection walletBalance={user.walletBalance} />
              </>
            )}

            {activeTab === "notifications" && (
              <div className="space-y-6">
                {/* T-030 : préférence user réellement branchée */}
                <NotificationPrefsSection
                  initial={{
                    priceAlertEnabled: user.priceAlertEnabled ?? false,
                  }}
                />
                {/* T-130 : le parrainage est disponible (T-125) ; on renvoie vers l'onglet BestRewards */}
                <Card>
                  <CardContent className="flex items-start gap-3 py-4">
                    <Award className="w-5 h-5 text-[#F5A623] mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-600">
                      {t("account.referralHint")}{" "}
                      <button
                        type="button"
                        onClick={() => setActiveTab("bestrewards")}
                        className="text-[#1B3A6B] font-medium hover:underline"
                      >
                        BestRewards
                      </button>
                      .
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
