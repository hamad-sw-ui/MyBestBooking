import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { desc } from "drizzle-orm";
import { UsersManager, type UserRow } from "@/components/bulk/users-manager";

/**
 * /dashboard/users (admin) — T-033 Session 12
 * Page shell (Server Component) : charge les utilisateurs et délègue
 * l'affichage + filtres + actions groupées au composant client
 * <UsersManager>.
 */

async function getUsers() {
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export default async function UsersPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    redirect("/dashboard");
  }
  const rows = await getUsers();

  // Sérialiser pour le composant client (dates → ISO string)
  const serialized: UserRow[] = rows.map((u) => ({
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    role: u.role,
    country: u.country,
    emailVerified: u.emailVerified,
    bestrewardsLevel: u.bestrewardsLevel,
    bestrewardsBookingsCount: u.bestrewardsBookingsCount,
    createdAt:
      u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt),
    lastLoginAt: u.lastLoginAt
      ? u.lastLoginAt instanceof Date
        ? u.lastLoginAt.toISOString()
        : String(u.lastLoginAt)
      : null,
    deletedAt: u.deletedAt
      ? u.deletedAt instanceof Date
        ? u.deletedAt.toISOString()
        : String(u.deletedAt)
      : null,
  }));

  return (
    <div>
      <div className="mb-6">
        <h1
          className="text-2xl font-bold text-gray-900"
          style={{ fontFamily: "'Poppins', sans-serif" }}
        >
          Utilisateurs
        </h1>
        <p className="text-gray-600 mt-1">
          Gérez les utilisateurs de la plateforme — filtres, recherche, actions groupées
        </p>
      </div>
      <UsersManager users={serialized} currentUserId={user.id} />
    </div>
  );
}
