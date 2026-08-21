# Conception — T-003 : middleware d'auth

## Options

**A. Vérifier JWT + cookie en middleware** (retenue) — `jose.jwtVerify`
fonctionne en edge, on vérifie que le cookie existe et que le JWT est
valide (signature + expiration).

**B. Simple présence du cookie sans vérification cryptographique** —
plus rapide mais un attaquant pourrait forger un cookie et voir la page
avant que le RSC ne le rejette.

**C. Pas de middleware, tout dans les layouts** — statu quo, laisse
`/mon-compte` etc. sans protection.

## Retenu : A

Coût : ~5ms par request protégée, négligeable. Bénéfice : fail-fast
avant même le RSC.

## Matcher

```ts
export const config = {
  matcher: [
    "/mon-compte/:path*",
    "/mes-reservations/:path*",
    "/mes-favoris/:path*",
    "/messages/:path*",
    "/reservation/:path*",
    "/dashboard/:path*",
  ],
};
```

## `?next=<url>`
Quand redirection vers `/connexion`, on passe le path d'origine dans
`?next=`, à charge pour la page connexion de rediriger après login.
Amélioration UX incrémentale, la page connexion actuelle ignorera le
paramètre pour l'instant (améliorable dans une future T).
