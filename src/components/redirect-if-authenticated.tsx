import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentUser } from "@/lib/auth";

/**
 * BUG-024 — garde serveur « visiteur déjà connecté → accueil ».
 *
 * Historiquement faite dans `src/proxy.ts` (T-135). Le proxy s'exécute en
 * runtime edge sans accès base : il ne pouvait vérifier que la **signature**
 * du JWT. Un cookie dont la session a été révoquée ou expirée en base (ou
 * dont le compte est suspendu/supprimé) était donc considéré comme connecté,
 * et tout clic sur « Se connecter » / « S'inscrire » était renvoyé vers `/`.
 * Le header, lui, interroge la base et affichait ces mêmes boutons : le
 * visiteur ne pouvait plus atteindre les pages de connexion/inscription.
 *
 * Ici, `getCurrentUser()` lit la session ET l'utilisateur en base — la source
 * de vérité — donc un cookie obsolète laisse accéder au formulaire.
 *
 * À ne poser que sur `/connexion` et `/inscription` : les pages d'auth à
 * jeton (`reinitialiser`, `activer-compte`, `verifier-email`,
 * `mot-de-passe-oublie`) doivent rester ouvertes à un utilisateur connecté.
 */
export async function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/");
  }
  return <>{children}</>;
}
