# Analyse d'impact — T-013 : Emails transactionnels

- **Date** : 2026-08-20 · **Niveau** : **S** · **Ref** : §14

## 1. Quoi
Introduire un service d'envoi d'emails abstrait (interface `Mailer`) avec
2 adaptateurs :
- **`ConsoleMailer`** (dev/test) : écrit l'email dans
  `.data/mails/<timestamp>-<to>.txt`. Aucune dépendance externe.
- **`ResendMailer`** (prod) : appelle l'API Resend via `fetch`, activé
  si `RESEND_API_KEY` est défini.

Emails câblés dans T-013 :
- **email de vérification** à `POST /api/auth/register` (avec lien signé
  contenant un token unique).
- **email de reset password** à `POST /api/auth/forgot-password`
  (endpoint créé dans T-013).
- **email de confirmation booking** à `POST /api/bookings`.
- **email de notification à l'hôte** quand un booking est créé sur sa
  property.

Note : la vérification effective d'email (endpoint `/api/auth/verify?token=`)
est **également livrée en T-013** pour compléter la chaîne.

## 2. Où
- Nouveau `src/lib/mail/index.ts` (interface + factory)
- Nouveau `src/lib/mail/console-mailer.ts`
- Nouveau `src/lib/mail/resend-mailer.ts`
- Nouveau `src/lib/mail/templates.ts` (5 templates HTML+text)
- Nouveau `src/lib/mail/*.test.ts`
- Nouvelle table `verification_tokens` dans `schema.ts` (verify email + reset password)
- Nouveaux endpoints :
  - `POST /api/auth/forgot-password`
  - `POST /api/auth/reset-password`
  - `GET /api/auth/verify?token=`
- Nouvelles pages :
  - `/mot-de-passe-oublie` (formulaire email)
  - `/reinitialiser?token=` (formulaire nouveau mdp)
  - `/verifier-email?token=` (résultat de vérification)
- Modif : `POST /api/auth/register`, `POST /api/bookings` (envoient les mails)
- `.env.example` : `RESEND_API_KEY`, `MAIL_FROM`

## 3. Pourquoi
Débloquer PAR-001 (email confirmation), PAR-003 (mot de passe oublié),
PAR-006 (notif email nouveau message → hors périmètre T-013),
PAR-007 (email invitation avis → hors périmètre T-013 pour l'instant).
FEATURES.md § Emails : 0 % → ~70 %.

## 4. Appelants
- `POST /api/auth/register` → mail vérification
- `POST /api/auth/forgot-password` → mail reset
- `POST /api/bookings` (dans la transaction, best-effort) → mail
  confirmation voyageur + mail notif hôte
- Tous les envois sont **non-bloquants** : si l'envoi échoue, on log
  l'erreur mais la réponse HTTP reste 201 (l'utilisateur ne doit pas
  perdre sa réservation à cause d'une panne SMTP).

## 5. Contrat public
- Register retourne toujours 200 même si vérif email ratée.
- Nouveau endpoint `/api/auth/verify?token=X` : 200 si valide et non
  expiré, 400 sinon.
- Nouveau endpoint `/api/auth/forgot-password` : **retourne toujours**
  `{ message: "Si un compte existe pour cet email, un lien a été envoyé" }`
  (200) — évite l'énumération de comptes.
- Nouveau endpoint `/api/auth/reset-password` : `{ token, password }`
  → 200 ou 400.

## 6. Migration
- Nouvelle table `verification_tokens` : migration Drizzle 0003_*.
- `.env.example` documenté avec `RESEND_API_KEY` (optionnel) et
  `MAIL_FROM` (obligatoire en prod, defaults en dev).
- Pas de changement de contrat existant → aucune migration DB destructive.

## 7. Sécurité
- Tokens de vérification / reset : UUID v4 crypto (via `crypto.randomUUID()`),
  stockés hashés (SHA-256) en base pour éviter fuite si dump DB.
- Expiration : 24h vérification, 1h reset password.
- Reset password : après succès, révoque **toutes** les sessions de
  l'utilisateur.
- Rate-limit sur `/api/auth/forgot-password` (5 req/h par email).
- Message d'énumération anti-fuite (voir §5).

## 8. Test
- Unitaire : `ConsoleMailer` écrit le fichier correct, template rendu.
- Unitaire : hash + expiration des tokens.
- Intégration : POST /api/auth/register écrit un mail dans `.data/mails/`,
  puis GET /api/auth/verify?token= valide.
- Intégration : POST /api/auth/forgot-password + reset-password chaîne complète.

## 9. Rollback
`git revert` — les 3 endpoints disparaissent, la table
`verification_tokens` reste (soft ; peut être `DROP` avec migration
séparée si besoin).
