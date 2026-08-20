import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Globe, CreditCard, Shield, Bell, Database,
  Mail, Users, Settings as SettingsIcon, Palette
} from "lucide-react";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Paramètres
        </h1>
        <p className="text-gray-600 mt-1">
          Configuration de la plateforme mybestbooking
        </p>
      </div>

      <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-900">
        ⚠️ Cette page est une vue d&apos;ensemble des paramètres à venir.
        Les formulaires ne sont pas encore branchés (T-017 les a désactivés
        pour ne plus induire en erreur). Les préférences utilisateur
        sont éditables dans <a href="/mon-compte" className="underline font-medium">Mon compte</a>.
      </div>

      <div className="space-y-6">
        {/* General */}
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
              value="mybestbooking"
              onChange={() => {}}
            />
            <Input
              label="URL du site"
              value="https://mybestbooking.com"
              onChange={() => {}}
              disabled
            />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Langue par défaut</label>
                <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg">
                  <option value="fr">🇫🇷 Français</option>
                  <option value="en">🇬🇧 English</option>
                  <option value="ar">🇸🇦 العربية</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Devise par défaut</label>
                <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg">
                  <option value="EUR">€ EUR</option>
                  <option value="USD">$ USD</option>
                  <option value="GBP">£ GBP</option>
                </select>
              </div>
            </div>
            <Input
              label="Email de support"
              value="support@mybestbooking.com"
              onChange={() => {}}
            />
            <Input
              label="Email partenaires"
              value="partners@mybestbooking.com"
              onChange={() => {}}
            />
          </CardContent>
          <CardFooter>
            <Button disabled>Bientôt disponible</Button>
          </CardFooter>
        </Card>

        {/* Commission */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-[#1B3A6B]" />
              <CardTitle>Commissions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { tier: "Standard", rate: "15%", desc: "Listing de base" },
                { tier: "Certifié", rate: "18%", desc: "Badge Partenaire Certifié, visibilité accrue" },
                { tier: "Premium", rate: "22%", desc: "Top des résultats, support dédié" },
                { tier: "BestRewards", rate: "+2%", desc: "Supplément accès membres BestRewards" },
              ].map((item) => (
                <div key={item.tier} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{item.tier}</p>
                    <p className="text-sm text-gray-500">{item.desc}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="info">{item.rate}</Badge>
                    <Button variant="ghost" size="sm" disabled>Bientôt</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* BestRewards */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Palette className="w-5 h-5 text-[#F5A623]" />
              <CardTitle>Programme BestRewards</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { level: "Level 1 — Explorer", threshold: 0, discount: "10%" },
                { level: "Level 2 — Voyageur", threshold: 5, discount: "15%" },
                { level: "Level 3 — Ambassador", threshold: 15, discount: "20%" },
              ].map((item) => (
                <div key={item.level} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{item.level}</p>
                    <p className="text-sm text-gray-500">
                      Seuil : {item.threshold} réservations • Réduction : {item.discount}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" disabled>Bientôt</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-[#1B3A6B]" />
              <CardTitle>Notifications email</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Expéditeur (From)"
              value="mybestbooking <noreply@mybestbooking.com>"
              onChange={() => {}}
            />
            <Input
              label="Répondre à"
              value="support@mybestbooking.com"
              onChange={() => {}}
            />
            <div className="space-y-3">
              {[
                { label: "Email de bienvenue", enabled: true },
                { label: "Confirmation de réservation", enabled: true },
                { label: "Rappels de voyage (J-3, J-1)", enabled: true },
                { label: "Demande d'avis post-séjour", enabled: true },
                { label: "Alertes prix favoris", enabled: true },
                { label: "Newsletter promotionnelle", enabled: false },
              ].map((notif) => (
                <div key={notif.label} className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-700">{notif.label}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked={notif.enabled} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#1B3A6B] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1B3A6B]"></div>
                  </label>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter>
            <Button disabled>Bientôt disponible</Button>
          </CardFooter>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-[#1B3A6B]" />
              <CardTitle>Sécurité</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-gray-900">2FA obligatoire hébergeurs</p>
                <p className="text-sm text-gray-500">Exiger la 2FA pour tous les comptes hébergeurs</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#1B3A6B] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1B3A6B]"></div>
              </label>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-gray-900">Rate limiting</p>
                <p className="text-sm text-gray-500">5 tentatives login/min, 100 recherches/min</p>
              </div>
              <Badge variant="success">Actif</Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="font-medium text-gray-900">Mode maintenance</p>
                <p className="text-sm text-gray-500">Afficher la page de maintenance</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:ring-2 peer-focus:ring-[#1B3A6B] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Database */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-[#1B3A6B]" />
              <CardTitle>Base de données</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-green-700 font-medium">Statut</p>
                <p className="text-lg font-bold text-green-800">✓ Connectée</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Dernière sauvegarde</p>
                <p className="text-lg font-bold text-gray-900">Aujourd&apos;hui</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" size="sm">Exporter les données</Button>
              <Button variant="outline" size="sm">Réinitialiser la démo</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
