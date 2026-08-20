# 🛡️ Sécurité

État réel du code au moment de la rédaction. Ce document décrit ce qui est en
place et ce qui reste à traiter avant une mise en production.

## Modèle d'authentification

- **Table `sessions`** : chaque login insère une ligne (`userId`, `token`,
  `expiresAt`).
- **JWT** signé avec `jose` (HS256), payload minimal `{userId}`, TTL 30 jours,
  émis par `createToken()` dans `src/lib/auth.ts`.
- **Cookie** `session` :
  - `HttpOnly: true`
  - `SameSite: "lax"`
  - `Secure: true` en production (`NODE_ENV === "production"`)
  - `path: "/"`
  - `expires` = `Date.now() + 30j`
- **Vérification** (`getSession()`) : parse le JWT, puis vérifie que la ligne
  `sessions` existe et n'est pas expirée, puis charge le `users` (et refuse
  si `deletedAt` est set).

**Conséquence intéressante** : la révocation est possible côté serveur (on
supprime la ligne `sessions`) même si le JWT n'est pas expiré. C'est un choix
délibéré et à conserver.

## Mots de passe

- **`bcryptjs`** avec coût 12 (~250 ms sur un CPU moderne).
- Validation minimale à l'inscription : longueur ≥ 8.
- Aucune vérification de complexité, pas de check contre les listes de mots de
  passe faibles.

## Autorisation

Trois rôles, appliqués à deux endroits :

1. **Layout `dashboard/layout.tsx`** : `redirect('/connexion')` si non
   authentifié, `redirect('/')` si `role !== 'host' && role !== 'admin'`.
2. **Handlers `/api/*`** : chaque handler qui mute vérifie explicitement le
   rôle et/ou la propriété de la ressource.

Il **n'y a pas de `middleware.ts`** global. C'est acceptable tant que chaque
handler et chaque layout protégé fait sa vérification, mais un middleware
serait une seconde ligne de défense simple à ajouter.

## Points critiques à traiter avant production

### 🔴 P1 — bloquants

1. ~~**`JWT_SECRET` avec fallback hard-codé**~~ **CORRIGÉ 2026-08-20 (T-001, BUG-001, ADR-003)**.
   Le module `src/lib/auth.ts` throw explicitement au chargement si
   `process.env.JWT_SECRET` est absent ou vide. Un `console.warn` est
   émis si le secret fait moins de 32 caractères. Un test automatisé
   (`src/lib/auth.test.ts`, 9 cas) protège contre la régression.

2. ~~**`POST /api/seed` accessible publiquement**~~ **CORRIGÉ 2026-08-20 (T-002, BUG-002, ADR-004)**.
   Le handler retourne `404` en production sauf si l'en-tête
   `x-seed-token` correspond à `process.env.SEED_TOKEN` (comparaison
   timing-safe). En développement, aucun changement. 7 tests
   automatisés (`src/app/api/seed/route.test.ts`) couvrent les
   scénarios.

3. **Paiement non implémenté**. `POST /api/bookings` force
   `paymentStatus: 'paid'` sans aucun débit. Déplacé dans
   `KNOWN_LIMITATIONS.md` en attendant des credentials Stripe/CinetPay
   test. Aucune vraie transaction n'a jamais été réalisée par
   l'application.

### 🟠 P2 — importants

4. ~~**Pas de rate-limiting**~~ **CORRIGÉ 2026-08-20 (T-009, BUG-009)**.
   `src/lib/rate-limit.ts` applique 20 req/min/IP + 5 req/min/email sur
   `/api/auth/login`, 10 req/min/IP sur `/api/auth/register`. Retourne
   429 + Retry-After. Voir `KNOWN_LIMITATIONS.md` pour la limite
   mono-instance à traiter avec Redis dans un déploiement scaled.
5. ~~**Pas de headers de sécurité**~~ **CORRIGÉ 2026-08-20 (T-008)**.
   `next.config.ts → headers()` pose `X-Content-Type-Options: nosniff`,
   `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy:
   strict-origin-when-cross-origin`, `Strict-Transport-Security:
   max-age=31536000; includeSubDomains`, `Permissions-Policy`. La CSP
   fine reste à définir (voir BACKLOG).
6. **`NEXT_PUBLIC_APP_URL`** utilisé dans `logout` avec fallback
   `http://localhost:3000` — à définir en prod.

### 🟡 P3 — nice to have

7. **2FA** : `users.twoFactorEnabled` existe mais aucune logique associée.
8. ~~**Vérification email d'office**~~ **CORRIGÉ 2026-08-20 (T-008,
   BUG-008)**. `POST /api/auth/register` met désormais
   `emailVerified: false`. Le flux d'envoi/vérification email reste à
   implémenter — tracé dans `KNOWN_LIMITATIONS.md`.
9. **Politique de mot de passe** : ajouter un check contre HaveIBeenPwned ou
   au minimum une règle de complexité.
10. **CSRF** : le fait que les cookies soient `SameSite=Lax` bloque la plupart
    des attaques CSRF, mais les formulaires HTML de logout / actions
    sensibles pourraient bénéficier d'un token anti-CSRF explicite.
11. **Injection** : Drizzle paramétrise correctement, aucune concat SQL
    détectée. Continuer sur ce standard, éviter `sql\`\`` interpolé.
12. **Uploads d'images** : les URLs d'images sont stockées telles quelles en
    base. Aujourd'hui elles pointent vers `unsplash.com`. Dès qu'un upload
    réel arrivera, prévoir une validation MIME/dimension et un stockage
    contrôlé (S3, R2…).

## Variables d'environnement sensibles

| Nom | Rôle | Obligatoire |
|---|---|---|
| `DATABASE_URL` | URL PostgreSQL | oui (throw au boot) |
| `JWT_SECRET` | Secret HMAC pour les JWT | oui à corriger — actuellement fallback |
| `NEXT_PUBLIC_APP_URL` | URL publique pour redirect logout | recommandé |
| `NODE_ENV` | `development` / `production` | géré par Next |

Ne **jamais** commiter de `.env`. Un `.env.example` reste à créer.
