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

1. **`JWT_SECRET` avec fallback hard-codé** (`src/lib/auth.ts:9`) :
   ```ts
   process.env.JWT_SECRET || "mybestbooking-secret-key-2025"
   ```
   Si la variable n'est pas définie en production, n'importe qui connaissant
   le code (public sur GitHub) peut forger un JWT admin. **Remplacer par un
   `throw` explicite au démarrage** :
   ```ts
   const secret = process.env.JWT_SECRET;
   if (!secret) throw new Error("JWT_SECRET is required");
   ```

2. **`POST /api/seed` accessible publiquement** (`src/app/api/seed/route.ts`).
   Une simple requête POST anonyme suffit à **truncate + réinsérer** toute la
   base. Deux options :
   - protéger derrière `NODE_ENV !== 'production'` **et** un token admin ;
   - ou retirer la route et déclencher le seed via un script CLI hors serveur.

3. **Paiement non implémenté**. `POST /api/bookings` force
   `paymentStatus: 'paid'` sans aucun débit. Une intégration réelle
   (Stripe/PayPal/CinetPay…) est indispensable avant d'ouvrir aux vrais
   clients.

### 🟠 P2 — importants

4. **Pas de rate-limiting** sur `/api/auth/login` et `/api/auth/register`.
   Vulnérable au brute-force et à l'énumération de comptes (les messages
   d'erreur sont heureusement génériques : `"Email ou mot de passe incorrect"`).
5. **Pas de headers de sécurité** (`next.config.ts` est vide) :
   `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
   `X-Frame-Options: DENY` (ou `Content-Security-Policy: frame-ancestors 'none'`),
   `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`.
6. **`NEXT_PUBLIC_APP_URL`** utilisé dans `logout` avec fallback
   `http://localhost:3000` — à définir en prod.

### 🟡 P3 — nice to have

7. **2FA** : `users.twoFactorEnabled` existe mais aucune logique associée.
8. **Vérification email** : `users.emailVerified` est mis à `true` d'office à
   l'inscription (`emailVerified: true, // For demo purposes`).
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
