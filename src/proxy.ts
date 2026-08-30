import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

/**
 * Proxy d'authentification (T-003, ADR-005, BUG-005 ; G2/T-123).
 *
 * Depuis Next.js 16, la convention `middleware.ts` est renommée en
 * `proxy.ts`. La fonction exportée est `proxy`. Le fichier reste au
 * même emplacement (src/proxy.ts au niveau de src/app/).
 *
 * Rôles :
 *  - Redirige vers /connexion?next=<path> tout accès **non authentifié**
 *    aux routes voyageur nécessitant un compte et à /dashboard/*.
 *  - T-123 (G2) : applique **au plein-chargement** les gardes de rôle sur
 *    `/dashboard/*`. Avant, le proxy ne vérifiait que la validité du JWT et
 *    les `redirect()` RSC ne produisent pas de 307 lors d'un chargement
 *    direct (URL tapée / rechargement / lien externe) : un client authentifié
 *    recevait une 200 avec l'enveloppe de l'espace hôte/admin. Le rôle est lu
 *    depuis le JWT (embarqué depuis T-123), sans accès base.
 *
 * Contraintes edge runtime : uniquement `jose` (pas de `pg`, pas de
 * `bcrypt`, pas de `next/headers`). Une révocation ou un changement de rôle
 * en base ne sera détecté que par le RSC ou le handler API en aval — d'où
 * le fait que les gardes RSC restent la seconde couche (défense en
 * profondeur).
 *
 * `JWT_SECRET` est requis (T-001, ADR-003). Si absent, l'utilisateur
 * est traité comme non authentifié plutôt que de crasher tout Next.
 */

const JWT_SECRET = process.env.JWT_SECRET
  ? new TextEncoder().encode(process.env.JWT_SECRET)
  : null;

type SessionRole = "admin" | "host" | "customer" | "guest" | string;

interface SessionInfo {
  userId: string;
  role?: SessionRole;
}

/**
 * Vérifie le cookie de session. Retourne les infos de session (dont le rôle
 * si le JWT l'embarque) ou `null` si absent/invalide/expiré.
 */
async function getSession(request: NextRequest): Promise<SessionInfo | null> {
  if (!JWT_SECRET) return null;
  const token = request.cookies.get("session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (typeof payload.userId !== "string") return null;
    return {
      userId: payload.userId,
      role: typeof payload.role === "string" ? payload.role : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * T-123 (G2) : segments du dashboard réservés à l'admin. Un hôte (ou tout
 * autre rôle) y est renvoyé vers `/dashboard` ; un non-hôte/non-admin vers
 * `/`. Reste du `/dashboard` : hôte ou admin.
 */
const ADMIN_ONLY_SEGMENTS = [
  "users",
  "settings",
  "audit",
  "promotions",
];

/** Renvoie la destination d'une redirection hors du dashboard, ou null. */
function dashboardDeniedDestination(
  pathname: string,
  role: SessionRole | undefined,
): string | null {
  // Rétrocompatibilité T-123 : un token émis avant cette tâche n'embarque pas
  // le claim `role`. On ne peut pas décider au niveau du proxy : on laisse
  // passer et les gardes RSC (qui lisent la base) tranchent en aval.
  if (!role) return null;

  const isAdmin = role === "admin";
  const isHost = role === "host" || isAdmin;

  // Segment /dashboard/<seg>...
  const seg = pathname.split("/").filter(Boolean)[1]; // ["","dashboard","<seg>"]
  const isAdminArea = seg ? ADMIN_ONLY_SEGMENTS.includes(seg) : false;

  if (isAdmin) return null;
  if (isAdminArea) return isHost ? "/dashboard" : "/";
  if (!isHost) return "/";
  return null;
}

function redirectToLogin(request: NextRequest): NextResponse {
  const url = request.nextUrl.clone();
  const next = url.pathname + url.search;
  url.pathname = "/connexion";
  url.search = `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const session = await getSession(request);
  const { pathname } = request.nextUrl;

  // T-135 — pages d'authentification publiques (connexion/inscription).
  // Un visiteur déjà authentifié n'a rien à y faire : on le renvoie à
  // l'accueil. Un visiteur anonyme, lui, doit y accéder : on court-circuite
  // la redirection « non authentifié » ci-dessous (sinon boucle
  // /connexion?next=/connexion). Fait au proxy (pas via redirect() dans un
  // layout RSC) pour produire un vrai 307 en chargement direct — voir le
  // commentaire d'en-tête. Les pages d'auth basées sur un jeton
  // (reinitialiser, activer-compte, verifier-email, mot-de-passe-oublie)
  // ne sont pas dans le matcher et restent accessibles dans tous les cas.
  const isAuthPage = pathname === "/connexion" || pathname === "/inscription";
  if (isAuthPage) {
    if (session) {
      const home = request.nextUrl.clone();
      home.pathname = "/";
      home.search = "";
      return NextResponse.redirect(home);
    }
    return NextResponse.next();
  }

  // Non authentifié (ou JWT absent/invalide) → connexion sur les routes
  // protégées par le matcher.
  if (!session) {
    return redirectToLogin(request);
  }


  // Garde de rôle sur le dashboard (au plein-chargement).
  if (pathname.startsWith("/dashboard")) {
    const dest = dashboardDeniedDestination(pathname, session.role);
    if (dest) {
      const target = request.nextUrl.clone();
      target.pathname = dest;
      target.search = "";
      return NextResponse.redirect(target);
    }
    // Un token d'avant T-123 n'embarque pas le rôle : on laisse passer et
    // les gardes RSC (qui lisent la base) tranchent côté serveur.
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/mon-compte/:path*",
    "/mes-reservations/:path*",
    "/mes-favoris/:path*",
    "/messages/:path*",
    // T-135 : pages d'auth à interdire aux visiteurs déjà connectés.
    "/connexion",
    "/inscription",
    // /reservation reste public pour permettre l'achat invité. Les règles
    // d'authentification et de propriété sont vérifiées dans les handlers API.
    "/dashboard/:path*",
  ],
};
