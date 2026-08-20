# ADR-005 — Middleware d'authentification (protection des routes voyageur)

- **Date** : 2026-08-20 · **Statut** : accepté · **Niveau** : S
- **Tâche** : T-003 (corrige BUG-005)

## Décision

Un `src/middleware.ts` unique, matchant les chemins voyageur/dashboard
nécessitant un compte, valide le cookie `session` via `jose.jwtVerify`
(compatible edge runtime). Sur échec → `NextResponse.redirect` vers
`/connexion?next=<pathname>`.

## Alternatives écartées

- Vérification en base (`getSession`) : incompatible edge (`pg`, `bcrypt`).
- Pas de middleware : laisse la surface actuelle.

## Conséquences
- Défense en profondeur : middleware + layout dashboard + handlers API.
- Une session révoquée en base laisse passer le middleware (JWT non
  expiré). L'appel API/RSC en aval la rejettera. Compromis assumé.
