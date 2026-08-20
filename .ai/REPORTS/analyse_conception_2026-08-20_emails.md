# Conception — T-013 : emails transactionnels

## Architecture

```
src/lib/mail/
├── index.ts          # export const mailer: Mailer (factory selon env)
├── types.ts          # Mailer interface + Email type
├── console-mailer.ts # écrit dans .data/mails/*.txt (dev/test)
├── resend-mailer.ts  # fetch https://api.resend.com (prod)
├── templates.ts      # 5 templates (verification, reset, booking-*,
│                     # host-notif) — HTML minimal + text fallback
└── *.test.ts
```

Interface :
```ts
export interface Email {
  to: string;
  subject: string;
  html: string;
  text: string;
}
export interface Mailer {
  send(email: Email): Promise<{ id: string }>;
}
```

Sélection :
```ts
// src/lib/mail/index.ts
export const mailer: Mailer =
  process.env.RESEND_API_KEY
    ? new ResendMailer(process.env.RESEND_API_KEY)
    : new ConsoleMailer();
```

## Table `verification_tokens`

```ts
export const verificationTokens = pgTable("verification_tokens", {
  id: uuid().defaultRandom().primaryKey(),
  userId: uuid().references(() => users.id).notNull(),
  tokenHash: varchar({ length: 64 }).unique().notNull(),
  purpose: varchar({ length: 20 }).notNull(), // 'email_verification' | 'password_reset'
  expiresAt: timestamp().notNull(),
  usedAt: timestamp(),
  createdAt: timestamp().defaultNow().notNull(),
});
```

Stockage : `tokenHash = sha256(token)`. Token clair uniquement envoyé
par email. Impossible de reconstruire un token à partir d'un dump DB.

## Flux vérification email

1. `POST /api/auth/register` crée `users` (`emailVerified: false`).
2. Génère token clair (`crypto.randomUUID()`) + insert
   `verification_tokens { hash, purpose: "email_verification", expiresAt: +24h }`.
3. `mailer.send({ to, subject: "Vérifiez votre email", html: templates.verification({ url: "https://.../verifier-email?token=" + tokenClair }) })`.
4. Utilisateur clique → `GET /api/auth/verify?token=X` :
   - Cherche `tokenHash = sha256(X)`, purpose email_verification, not used, not expired.
   - Marque `users.emailVerified = true`, `verification_tokens.usedAt = now`.
   - Redirige `/verifier-email?ok=1`.

## Flux mot de passe oublié

1. `POST /api/auth/forgot-password { email }` :
   - Cherche user. Si absent, **ne rien faire** mais **retourner 200**.
   - Si présent, génère token + insert avec `purpose: "password_reset"`, `expiresAt: +1h`.
   - Envoie mail avec lien `/reinitialiser?token=X`.
2. `POST /api/auth/reset-password { token, password }` :
   - Vérifie token, hash le nouveau mdp, met à jour `users.passwordHash`.
   - Marque `usedAt`, **supprime toutes les `sessions` de l'user**.

## Rate-limit

- `/api/auth/forgot-password` : `rateLimit('forgot:email:' + email, {limit:5, windowMs:3600_000})`.
- `/api/auth/reset-password` : `rateLimit('reset:ip:' + ip, {limit:10, windowMs:3600_000})`.

## Templates

Format minimal, sans framework CSS lourd :
```
Subject: Vérifiez votre email
---
<h1>Bienvenue chez mybestbooking !</h1>
<p>Cliquez ci-dessous pour vérifier votre email…</p>
<a href="{url}">Vérifier mon email</a>
```

Chaque template a une **version texte** générée automatiquement (strip HTML).
