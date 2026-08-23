# mybestbooking

> *Réservez mieux. Voyagez plus.*

Plateforme web de réservation d'hébergements bâtie sur **Next.js 16** (App
Router, React 19), **PostgreSQL** et **Drizzle ORM**.

## 🎯 Fonctionnalités

- Recherche multicritère d'hébergements (ville, dates, type, prix, équipements)
- Fiche hébergement avec chambres, avis vérifiés, politique d'annulation
- Tunnel de réservation multi-étapes avec calcul de commission
- Espace voyageur : compte, réservations, favoris, messages, programme
  fidélité **BestRewards** (3 niveaux)
- Dashboard hôte : properties, rooms, bookings, avis, promotions, analytics
- Rôles `customer` / `host` / `admin`

## 🚀 Démarrage rapide

```bash
# 1. Cloner + installer
git clone https://github.com/hamad-sw-ui/MyBestBooking.git
cd MyBestBooking
npm install

# 2. Créer .env.local (à partir de .env.example)
cp .env.example .env.local
# → générer un vrai JWT_SECRET avec : openssl rand -hex 32
# → puis le copier dans .env.local

# 3. Lancer PostgreSQL embarqué en local (dev only, pas de Docker requis)
npm run db:dev     # laisser tourner dans un terminal

# 4. Dans un autre terminal, appliquer le schéma + seed
npm run db:push
curl -X POST http://localhost:3000/api/seed   # après avoir lancé npm run dev

# 5. Serveur de développement
npm run dev
# → http://localhost:3000
```

Comptes de démo créés par le seed :

| Rôle | Email | Mot de passe |
|---|---|---|
| Admin | `admin@mybestbooking.com` | `Admin123!` |
| Hôte | `host@mybestbooking.com` | `Host123!` |
| Voyageur | `customer@mybestbooking.com` | `Customer123!` |

## 🔑 Configuration sécurisée des providers

Un administrateur peut renseigner **Stripe**, **Resend** et **S3/R2** dans
`/dashboard/settings` → « Providers externes sécurisés ». Les valeurs sont
chiffrées côté serveur et ne sont jamais réaffichées. Cette interface exige
une clé maître d'infrastructure `CREDENTIALS_ENCRYPTION_KEY` (32 octets en hex
ou Base64), à définir uniquement dans l'environnement de déploiement.

Les variables `.env.local` restent compatibles comme fallback : elles sont
recommandées pour le bootstrap, la récupération et la rotation de secrets.
Voir `.env.example` et `.ai/SECURITY.md`.

## 📚 Documentation

Le dossier [`.ai/`](.ai/) contient la **documentation vivante** et le
**framework de gouvernance** du projet (AI-DOS Web v1.0.2). Points d'entrée :

- [`.ai/README.md`](.ai/README.md) — carte du framework
- [`.ai/PROJECT.md`](.ai/PROJECT.md) — contexte métier
- [`.ai/ARCHITECTURE.md`](.ai/ARCHITECTURE.md) — architecture réelle
- [`.ai/API.md`](.ai/API.md) — endpoints REST
- [`.ai/DATABASE.md`](.ai/DATABASE.md) — schéma Drizzle
- [`.ai/SECURITY.md`](.ai/SECURITY.md) — modèle de sécurité
- [`.ai/DEV_ENVIRONMENT.md`](.ai/DEV_ENVIRONMENT.md) — setup local

## 🧪 Qualité

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest — 43+ tests
npm run build       # next build (production)
npm run ai:check    # vérifie la cohérence du framework .ai/
```

## 🗄️ Base de données

- Schéma : [`src/db/schema.ts`](src/db/schema.ts) — 14 tables Drizzle
- Migrations versionnées : [`drizzle/`](drizzle/)
- `npm run db:generate` — génère une nouvelle migration à partir du schéma
- `npm run db:push` — pousse le schéma directement (dev only)
- `npm run db:studio` — interface web Drizzle Studio

## 🔐 Sécurité

- Auth : JWT `HttpOnly` (jose) + session en base, révocation possible
- Mots de passe : bcrypt coût 12
- Rate-limiting sur `/api/auth/login` et `/api/auth/register`
- Proxy edge (`src/proxy.ts`) qui protège les routes voyageur privées
- Headers de sécurité globaux (HSTS, X-Frame-Options, Referrer-Policy…)
- `POST /api/seed` protégée en prod par token
- Rôles vérifiés côté handler API

Voir [`.ai/SECURITY.md`](.ai/SECURITY.md) pour le détail.

## 📦 Stack

| Domaine | Choix |
|---|---|
| Runtime | Next.js 16.2.6, React 19, Node.js 20+ |
| Langage | TypeScript strict |
| Style | TailwindCSS 4 |
| DB | PostgreSQL, Drizzle ORM 0.45, driver `pg` |
| Auth | `jose` (JWT) + `bcryptjs` |
| Validation | Zod 4 |
| Tests | Vitest 4 |
| Icônes | lucide-react 1.x |

## 🤝 Contribuer

Le projet suit un cadre de gouvernance strict décrit dans
[`.ai/CODING_RULES.md`](.ai/CODING_RULES.md) :

- Proportionnalité T/L/S/C (§15.0)
- Analyse d'impact avant tâche S/C (§14)
- Débat multi-rôles pour tâches C (§15.2)
- Règle de clôture §13 : typecheck + build + tests + zéro régression
- Honnêteté technique §16 : tags 🔍/🔨/🧪/▶️/🧠/❓

En début de session, copier [`prompt de démarrage`](.ai/PROMPTS/session_start.md)
dans votre assistant IA.

## 📄 Licence

Non publiée — projet privé.
