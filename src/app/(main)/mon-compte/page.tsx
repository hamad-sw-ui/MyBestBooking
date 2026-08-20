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
}

export default function MyAccountPage() {
  const router = useRouter();
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
    { id: "security", label: "Sécurité", icon: Shield },
    { id: "notifications", label: "Notifications", icon: Bell },
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
                {/* Profile Info */}
                <Card>
                  <CardHeader>
                    <CardTitle>Informations personnelles</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-20 h-20 rounded-full bg-[#1B3A6B] flex items-center justify-center text-white text-2xl font-bold">
                        {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold">{user.firstName} {user.lastName}</h3>
                        <p className="text-gray-500">{user.email}</p>
                        <Badge variant="bestrewards" className="mt-1">
                          💎 {currentLevel.name}
                        </Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        label="Prénom"
                        value={user.firstName}
                        onChange={() => {}}
                        icon={<User className="w-4 h-4" />}
                      />
                      <Input
                        label="Nom"
                        value={user.lastName}
                        onChange={() => {}}
                      />
                      <Input
                        label="Email"
                        value={user.email}
                        onChange={() => {}}
                        icon={<Mail className="w-4 h-4" />}
                        disabled
                      />
                      <Input
                        label="Téléphone"
                        value={user.phone || ""}
                        onChange={() => {}}
                        placeholder="+33 6 00 00 00 00"
                        icon={<Phone className="w-4 h-4" />}
                      />
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button loading={saving}>Enregistrer les modifications</Button>
                  </CardFooter>
                </Card>

                {/* Preferences */}
                <Card>
                  <CardHeader>
                    <CardTitle>Préférences</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Langue</label>
                        <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg">
                          <option value="fr">🇫🇷 Français</option>
                          <option value="en">🇬🇧 English</option>
                          <option value="ar">🇸🇦 العربية</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Devise</label>
                        <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg">
                          <option value="EUR">€ EUR</option>
                          <option value="USD">$ USD</option>
                          <option value="MAD">MAD</option>
                          <option value="TND">TND</option>
                        </select>
                      </div>
                    </div>
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
                      <Button variant="outline">Utiliser mon solde</Button>
                    </div>
                    <p className="text-sm text-gray-500 mt-3">
                      Votre solde peut être utilisé lors de votre prochaine réservation.
                    </p>
                  </CardContent>
                </Card>

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
                    <CardTitle>Mot de passe</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Input
                      type="password"
                      label="Mot de passe actuel"
                      placeholder="••••••••"
                    />
                    <Input
                      type="password"
                      label="Nouveau mot de passe"
                      placeholder="Min. 8 caractères"
                    />
                    <Input
                      type="password"
                      label="Confirmer le nouveau mot de passe"
                      placeholder="••••••••"
                    />
                  </CardContent>
                  <CardFooter>
                    <Button>Modifier le mot de passe</Button>
                  </CardFooter>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Authentification à deux facteurs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">2FA par SMS</p>
                        <p className="text-sm text-gray-500">
                          Recevez un code par SMS lors de la connexion
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={user.twoFactorEnabled || false} onChange={() => {}} />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#1B3A6B] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1B3A6B]"></div>
                      </label>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-red-200">
                  <CardHeader>
                    <CardTitle className="text-red-600">Zone de danger</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-red-600">Supprimer mon compte</p>
                        <p className="text-sm text-gray-500">
                          Cette action est irréversible
                        </p>
                      </div>
                      <Button variant="danger" size="sm">
                        <Trash2 className="w-4 h-4 mr-2" />
                        Supprimer
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}

            {activeTab === "notifications" && (
              <Card>
                <CardHeader>
                  <CardTitle>Préférences de notification</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {[
                    { id: "booking", label: "Confirmations de réservation", desc: "Emails et SMS pour vos réservations" },
                    { id: "reminder", label: "Rappels de voyage", desc: "Notifications avant votre séjour" },
                    { id: "promo", label: "Offres et promotions", desc: "Bons plans et réductions exclusives" },
                    { id: "review", label: "Demandes d'avis", desc: "Invitations à laisser un avis après séjour" },
                    { id: "price", label: "Alertes prix", desc: "Baisse de prix sur vos favoris" },
                  ].map((notif) => (
                    <div key={notif.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{notif.label}</p>
                        <p className="text-sm text-gray-500">{notif.desc}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" defaultChecked />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#1B3A6B] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1B3A6B]"></div>
                      </label>
                    </div>
                  ))}
                </CardContent>
                <CardFooter>
                  <Button>Enregistrer les préférences</Button>
                </CardFooter>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
