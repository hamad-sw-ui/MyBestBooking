"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  User, Mail, Phone, Globe, Award, Wallet, 
  Shield, Bell, LogOut, Trash2, ChevronRight 
} from "lucide-react";
import Link from "next/link";
import { ProfileForm } from "@/components/profile-form";
import { useDisplayPreferences } from "@/lib/use-display-currency";
import { makeT } from "@/lib/ui-strings";
import { UserAvatar } from "@/components/user-avatar";
import { ChangePasswordForm } from "@/components/change-password-form";
import { TwoFactorSection } from "@/components/two-factor-section";
import { DeleteAccountSection } from "@/components/delete-account-section";
import { NotificationPrefsSection } from "@/components/notification-prefs-section";
import { ReferralCard } from "@/components/referral-card";
import { ResendVerificationButton } from "@/components/resend-verification-button";

interface UserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  country: string | null;
  language: string | null;
  currency: string | null;
  bestrewardsLevel: number | null;
  bestrewardsBookingsCount: number | null;
  walletBalance: string | null;
  emailVerified: boolean | null;
  twoFactorEnabled: boolean | null;
  avatarUrl?: string | null;
}

export default function MyAccountPage() {
  const router = useRouter();
  const { language } = useDisplayPreferences();
  const t = makeT(language);
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("profile");

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
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1B3A6B]"></div>
      </div>
    );
  }

  if (!user) return null;

  const bestrewardsLevels = [
    { level: 1, name: "Explorer", bookings: 0, benefits: "-10% sur BestRewards" },
    { level: 2, name: "Voyageur", bookings: 5, benefits: "-15% + Petit-déj." },
    { level: 3, name: "Ambassador", bookings: 15, benefits: "-20% + Cashback 5%" },
  ];

  const currentLevel = bestrewardsLevels.find((l) => l.level === user.bestrewardsLevel) || bestrewardsLevels[0];
  const nextLevel = bestrewardsLevels.find((l) => l.level === (user.bestrewardsLevel || 1) + 1);
  const bookingsToNextLevel = nextLevel ? nextLevel.bookings - (user.bestrewardsBookingsCount || 0) : 0;

  const tabs = [
    { id: "profile", label: "Profil", icon: User },
    { id: "bestrewards", label: "BestRewards", icon: Award },
    { id: "security", label: t("account.security"), icon: Shield },
    { id: "notifications", label: t("account.notifications"), icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
            Mon compte
          </h1>
          <p className="text-gray-600 mt-1">
            Gérez vos informations personnelles et préférences
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
                    Déconnexion
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
                      Email : <strong>{user.email}</strong>{" "}
                      <span className="text-xs text-gray-500">
                        (non modifiable ici — contact support si besoin)
                      </span>
                    </div>
                    <ProfileForm initial={{
                      firstName: user.firstName,
                      lastName: user.lastName,
                      phone: user.phone,
                      country: null,
                      language: user.language ?? null,
                      currency: user.currency ?? null,
                      timezone: (user as unknown as { timezone?: string | null }).timezone ?? null,
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
                        <p className="text-white/70 text-sm">Votre niveau</p>
                        <p className="text-3xl font-bold">{currentLevel.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/70 text-sm">Réservations</p>
                        <p className="text-3xl font-bold">{user.bestrewardsBookingsCount || 0}</p>
                      </div>
                    </div>
                    
                    {nextLevel && (
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Progression vers {nextLevel.name}</span>
                          <span>{user.bestrewardsBookingsCount || 0}/{nextLevel.bookings}</span>
                        </div>
                        <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-[#F5A623] rounded-full transition-all"
                            style={{ width: `${((user.bestrewardsBookingsCount || 0) / nextLevel.bookings) * 100}%` }}
                          />
                        </div>
                        <p className="text-sm text-white/70 mt-2">
                          Plus que {bookingsToNextLevel} réservation{bookingsToNextLevel > 1 ? "s" : ""} pour atteindre le niveau suivant !
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
                      Wallet mybestbooking
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm text-gray-500">Solde disponible</p>
                        <p className="text-3xl font-bold text-[#1B3A6B]">
                          €{parseFloat(user.walletBalance || "0").toFixed(2)}
                        </p>
                      </div>
                      <Link
                        href="/recherche"
                        className="inline-flex items-center px-4 py-2 rounded-lg border border-[#1B3A6B] text-[#1B3A6B] font-medium hover:bg-[#1B3A6B] hover:text-white transition"
                      >
                        Utiliser mon solde
                      </Link>
                    </div>
                    <p className="text-sm text-gray-500 mt-3">
                      {t("account.walletHint")}
                    </p>
                  </CardContent>
                </Card>

                {/* T-130 : parrainage réellement exposé (T-125 livré côté API) */}
                <ReferralCard />

                {/* Levels */}
                <Card>
                  <CardHeader>
                    <CardTitle>Niveaux et avantages</CardTitle>
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
                                <p className="text-sm text-gray-500">{level.bookings}+ réservations</p>
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
                <DeleteAccountSection />
              </>
            )}

            {activeTab === "notifications" && (
              <div className="space-y-6">
                {/* T-030 : préférence user réellement branchée */}
                <NotificationPrefsSection
                  initial={{
                    priceAlertEnabled: (user as unknown as { priceAlertEnabled?: boolean }).priceAlertEnabled ?? false,
                  }}
                />
                {/* T-130 : le parrainage est disponible (T-125) ; on renvoie vers l'onglet BestRewards */}
                <Card>
                  <CardContent className="flex items-start gap-3 py-4">
                    <Award className="w-5 h-5 text-[#F5A623] mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-600">
                      Parrainez vos amis et gagnez des crédits : retrouvez votre
                      code de parrainage dans l&apos;onglet{" "}
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
