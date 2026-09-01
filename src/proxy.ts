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

/** Langue UI depuis `?lang=` (prioritaire) ou cookies anonymes. */
function localeFromRequest(request: NextRequest): "fr" | "en" | null {
  const q = request.nextUrl.searchParams.get("lang");
  if (q === "en" || q === "fr") return q;
  const alt = request.cookies.get("mybb-ui-language")?.value;
  if (alt === "en" || alt === "fr") return alt;
  const hist = request.cookies.get("mybb:ui-language")?.value;
  if (hist === "en" || hist === "fr") return hist;
  return null;
}

function stampLocaleCookies(res: NextResponse, lang: "fr" | "en", secure: boolean) {
  const common = {
    path: "/",
    maxAge: 31536000,
    sameSite: (secure ? "none" : "lax") as "none" | "lax",
    secure,
  };
  res.cookies.set("mybb-ui-language", lang, common);
  try {
    res.cookies.set("mybb:ui-language", lang, common);
  } catch {
    // nom avec deux-points refusé par certains runtimes
  }
}

function nextWithLocale(request: NextRequest): NextResponse {
  const lang = localeFromRequest(request);
  const h = new Headers(request.headers);
  if (lang) h.set("x-ui-language", lang);
  const res = NextResponse.next({ request: { headers: h } });
  const q = request.nextUrl.searchParams.get("lang");
  if (q === "en" || q === "fr") {
    stampLocaleCookies(res, q, request.nextUrl.protocol === "https:");
  }
  return res;
}

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

/**
 * T-163 (audit n°30) — vrai HTTP 404 pour les tokens de partage invalides.
 *
 * Le pattern documenté « notFound() dans generateMetadata » ne produit
 * PAS un 404 sur Next 16.2.6 : dès qu'une page dynamique valide son token
 * par un `await` (fetch/DB), le streaming a déjà commencé et le statut est
 * figé à 200 (docs « Streaming — The HTTP contract » + issue vercel/next.js
 * #82041). La seule couche qui peut encore changer le statut AVANT le
 * rendu est le proxy (edge) : on interroge l'API publique du partage et,
 * si elle répond 404, on renvoie un 404 HTML immédiat. Les tokens VALIDES
 * passent (NextResponse.next()) et la page RSC (localisée) s'exécute ;
 * elle conserve son notFound() en défense en profondeur (erreur API,
 * token vide). Aucun changement de contrat API.
 */
const SHARE_PREFIX = "/wishlists/share/";

async function shareNotFoundResponse(request: NextRequest): Promise<NextResponse | null> {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith(SHARE_PREFIX)) return null;
  const token = pathname.slice(SHARE_PREFIX.length).split("/")[0];
  if (!token) return null;
  // Interroge l'API publique du partage (même origin, aucun cookie requis).
  // En cas d'erreur réseau/5xx on laisse la page RSC gérer (défense en
  // profondeur) plutôt que de renvoyer un faux 404.
  let status = 0;
  try {
    const apiUrl = request.nextUrl.clone();
    apiUrl.pathname = `/api/wishlists/shared/${encodeURIComponent(token)}`;
    apiUrl.search = "";
    const res = await fetch(apiUrl, { method: "GET", cache: "no-store" });
    status = res.status;
  } catch {
    return null;
  }
  if (status !== 404) return null;
  const en = localeFromRequest(request) === "en";
  const title = en ? "Page not found" : "Page introuvable";
  const body = en
    ? "This shared list does not exist or is no longer available."
    : "Cette liste partagée n'existe pas ou n'est plus disponible.";
  const html = `<!doctype html><html lang="${en ? "en" : "fr"}"><head><meta charset="utf-8"/><meta name="robots" content="noindex"/><title>${title} | MyBestBooking</title><style>body{font-family:system-ui,sans-serif;margin:0;background:#f9fafb;display:flex;min-height:100vh;align-items:center;justify-content:center}main{max-width:28rem;width:100%;background:#fff;border-radius:1rem;box-shadow:0 1px 3px rgba(0,0,0,.1);padding:2rem;text-align:center}p{color:#6b7280;font-size:.9rem}h1{color:#111827;font-size:1.5rem;margin:.5rem 0}a{display:inline-block;margin:0 .25rem;padding:.6rem 1.2rem;border-radius:.5rem;text-decoration:none;font-size:.9rem}.a{background:#ff5a5f;color:#fff}.b{border:1px solid #d1d5db;color:#374151}</style></head><body><main><p>${en ? "Error 404" : "Erreur 404"}</p><h1>${title}</h1><p>${body}</p><p><a class="a" href="/">${en ? "Home" : "Accueil"}</a><a class="b" href="/recherche">${en ? "Search" : "Rechercher"}</a></p></main></body></html>`;
  return new NextResponse(html, {
    status: 404,
    headers: { "content-type": "text/html; charset=utf-8", "x-robots-tag": "noindex" },
  });
}

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

const PROTECTED_PREFIXES = [
  "/mon-compte",
  "/mes-reservations",
  "/mes-favoris",
  "/messages",
  "/dashboard",
];

export async function proxy(request: NextRequest) {
  const session = await getSession(request);
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

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
    return nextWithLocale(request);
  }

  // T-163 : partage de favoris — PUBLIC (aucune session requise). 404 réel
  // avant streaming si token inconnu, sinon la page RSC s'exécute.
  if (pathname.startsWith(SHARE_PREFIX)) {
    return (await shareNotFoundResponse(request)) ?? nextWithLocale(request);
  }

  // Pages publiques ajoutées au matcher uniquement pour tamponner la locale
  // (`?lang=` / cookie → header `x-ui-language` lu par getServerLocale).
  if (!isProtected) {
    return nextWithLocale(request);
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

  return nextWithLocale(request);
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
    // T-167 : /reservation reste public (achat invité) mais est matchée
    // pour tamponner `?lang=` / cookie → `x-ui-language`. Auth inchangée.
    "/reservation",
    "/reservation/:path*",
    "/dashboard",
    "/dashboard/:path*",
    // T-163 : partage public — validation du token au proxy pour un vrai 404.
    "/wishlists/share/:path*",
    // T-167 : tampon locale SSR sur les pages publiques (cookie iframe
    // parfois bloqué : le query `lang` est la source de vérité).
    "/",
    "/recherche",
    "/recherche/:path*",
    "/hebergement/:path*",
    "/bestrewards",
    "/aide",
    "/aide/:path*",
  ],
};
