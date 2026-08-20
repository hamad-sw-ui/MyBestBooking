import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Users as UsersIcon, Mail, Calendar, Award } from "lucide-react";

async function getUsers() {
  return db
    .select()
    .from(users)
    .orderBy(desc(users.createdAt));
}

export default async function UsersPage() {
  const user = await getCurrentUser();
  
  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }

  const allUsers = await getUsers();

  const roleLabels: Record<string, string> = {
    customer: "Client",
    host: "Hébergeur",
    admin: "Admin",
    moderator: "Modérateur",
    support: "Support",
  };

  const roleBadges: Record<string, string> = {
    customer: "bg-blue-100 text-blue-800",
    host: "bg-green-100 text-green-800",
    admin: "bg-purple-100 text-purple-800",
    moderator: "bg-orange-100 text-orange-800",
    support: "bg-teal-100 text-teal-800",
  };

  // Calculate stats
  const stats = {
    total: allUsers.length,
    customers: allUsers.filter(u => u.role === "customer").length,
    hosts: allUsers.filter(u => u.role === "host").length,
    admins: allUsers.filter(u => u.role === "admin").length,
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: "'Poppins', sans-serif" }}>
          Utilisateurs
        </h1>
        <p className="text-gray-600 mt-1">
          Gérez les utilisateurs de la plateforme
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">Clients</p>
            <p className="text-2xl font-bold text-blue-600">{stats.customers}</p>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">Hébergeurs</p>
            <p className="text-2xl font-bold text-green-600">{stats.hosts}</p>
          </CardContent>
        </Card>
        <Card padding="sm">
          <CardContent>
            <p className="text-sm text-gray-500">Admins</p>
            <p className="text-2xl font-bold text-purple-600">{stats.admins}</p>
          </CardContent>
        </Card>
      </div>

      {/* Users List */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-500 border-b border-gray-100">
                <th className="px-6 py-4 font-medium">Utilisateur</th>
                <th className="px-6 py-4 font-medium">Email</th>
                <th className="px-6 py-4 font-medium">Rôle</th>
                <th className="px-6 py-4 font-medium">BestRewards</th>
                <th className="px-6 py-4 font-medium">Inscrit le</th>
                <th className="px-6 py-4 font-medium">Dernière connexion</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.map((u) => (
                <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1B3A6B] flex items-center justify-center text-white font-medium">
                        {u.firstName.charAt(0)}{u.lastName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{u.firstName} {u.lastName}</p>
                        {u.country && <p className="text-sm text-gray-500">{u.country}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-sm">{u.email}</span>
                      {u.emailVerified && (
                        <span className="text-green-500 text-xs">✓</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge className={roleBadges[u.role] || "bg-gray-100 text-gray-800"}>
                      {roleLabels[u.role] || u.role}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    {u.bestrewardsLevel && (
                      <div className="flex items-center gap-2">
                        <Badge variant="bestrewards">
                          💎 Level {u.bestrewardsLevel}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {u.bestrewardsBookingsCount} résa.
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {formatDate(u.createdAt, { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {u.lastLoginAt 
                      ? formatDate(u.lastLoginAt, { day: "numeric", month: "short", year: "numeric" })
                      : "—"
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
