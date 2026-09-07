import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export type HostApprovalStatus = "pending" | "approved" | "rejected";

export interface HostApprovalState {
  /** true si le user est un hôte approuvé et peut publier sans gate. */
  approved: boolean;
  /** true si le user n'est pas (ou plus) un hôte. */
  notHost: boolean;
  /** Statut d'approbation, ou null pour un non-hôte. */
  status: HostApprovalStatus | null;
}

/**
 * T-202 — lit l'état d'approbation d'un hôte.
 *
 * Additif : un utilisateur qui n'est pas hôte (`role !== "host"`) n'est
 * jamais bloqué — c'est le comportement historique. Un hôte `approved`
 * publie normalement ; `pending`/`rejected` déclenchent une garde.
 */
export async function getHostApprovalState(
  userId: string,
  role?: string | null,
): Promise<HostApprovalState> {
  // Si le rôle est déjà connu (ex : getCurrentUser le fournit), on évite une
  // requête. Sinon on charge lidée.
  const [user] = await db
    .select({ role: users.role, approvalStatus: users.approvalStatus })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return { approved: false, notHost: true, status: null };
  if ((role ?? user.role) !== "host") {
    return { approved: false, notHost: true, status: null };
  }
  const status = user.approvalStatus as HostApprovalStatus;
  return { approved: status === "approved", notHost: false, status };
}

/**
 * T-202 — garde de publication : un hôte doit être approuvé par l'admin avant
 * de pouvoir faire passer un hébergement en `active`.
 *
 * Retourne `null` si la publication est autorisée, sinon un objet décrivant
 * le blocage (statut HTTP + clé i18n + libellé par défaut).
 */
export async function requireApprovedHost(userId: string, role?: string | null): Promise<{
  ok: true;
} | {
  ok: false;
  status: number;
  messageKey: string;
  defaultMessage: string;
}> {
  const state = await getHostApprovalState(userId, role);
  // Non-hôte (admin) → jamais bloqué (comportement historique : l'admin
  // publie directement). Un hôte null/inexistant → bloqué par sécurité.
  if (state.notHost && state.status === null) {
    if (role === "admin" || role === undefined) return { ok: true };
  }
  if (state.approved) return { ok: true };
  if (state.status === "rejected") {
    return {
      ok: false,
      status: 403,
      messageKey: "host.rejected",
      defaultMessage: "Votre compte hôte a été refusé. Contactez le support.",
    };
  }
  return {
    ok: false,
    status: 403,
    messageKey: "host.pendingApproval",
    defaultMessage:
      "Votre compte hôte doit être validé par un administrateur avant de pouvoir publier un hébergement.",
  };
}
