import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

/**
 * Proxy d'authentification (T-003, ADR-005, BUG-005).
 *
 * Depuis Next.js 16, la convention `middleware.ts` est renommée en
 * `proxy.ts`. La fonction exportée est `proxy`. Le fichier reste au
 * même emplacement (src/proxy.ts au niveau de src/app/).
 *
 * Redirige vers /connexion?next=<path> tout accès non authentifié aux
 * routes voyageur nécessitant un compte et à /dashboard/*.
 *
 * Contraintes edge runtime : uniquement `jose` (pas de `pg`, pas de
 * `bcrypt`, pas de `next/headers`). Une révocation en base ne sera
 * détectée que par le RSC ou le handler API en aval.
 *
 * `JWT_SECRET` est requis (T-001, ADR-003). Si absent, l'utilisateur
 * est traité comme non authentifié plutôt que de crasher tout Next.
 */

const JWT_SECRET = process.env.JWT_SECRET
  ? new TextEncoder().encode(process.env.JWT_SECRET)
  : null;

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  if (!JWT_SECRET) return false;
  const token = request.cookies.get("session")?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, JWT_SECRET);
    return true;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const authed = await isAuthenticated(request);
  if (authed) return NextResponse.next();

  const url = request.nextUrl.clone();
  const next = url.pathname + url.search;
  url.pathname = "/connexion";
  url.search = `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/mon-compte/:path*",
    "/mes-reservations/:path*",
    "/mes-favoris/:path*",
    "/messages/:path*",
    // /reservation reste public pour permettre l'achat invité. Les règles
    // d'authentification et de propriété sont vérifiées dans les handlers API.
    "/dashboard/:path*",
  ],
};
