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

## 🚀 Lancement local complet

### Prérequis

- Windows avec PowerShell, ou macOS/Linux avec Bash ;
- Node.js 20 ou plus récent ;
- npm ;
- OpenSSL pour générer les secrets ;
- aucun `psql` ni Docker n'est nécessaire : le projet fournit PostgreSQL embarqué ;
- les providers externes (Stripe, Resend, S3/R2) sont optionnels en local.

### 1. Installer le projet

```powershell
git clone https://github.com/hamad-sw-ui/MyBestBooking.git
Set-Location MyBestBooking
npm install
Copy-Item .env.example .env.local
```

Si le fichier `.env.local` existe déjà, ne l'écrasez pas. Vérifiez surtout que
`DATABASE_URL` correspond à l'instance démarrée par `npm run db:dev` :

```env
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:55432/app_db"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
JWT_SECRET="une-valeur-aleatoire-d-au-moins-32-octets"
```

Générez le secret JWT avec :

```powershell
openssl rand -hex 32
```

Le fichier `.env.local` est ignoré par Git. Ne commitez jamais ses valeurs.

### 2. Démarrer PostgreSQL embarqué

Dans le **terminal 1**, depuis `MyBestBooking` :

```powershell
npm run db:dev
```

Laissez ce terminal ouvert. PostgreSQL écoute sur `127.0.0.1:55432` et conserve
ses données dans `.data/pg/`. Appuyez sur `Ctrl+C` pour l'arrêter proprement.

Ne mélangez pas cette instance avec un PostgreSQL déjà installé sur `5432`.
Si `.env.local` pointe sur `5432`, `db:push` et les tests peuvent utiliser une
base différente de celle du serveur embarqué.

### 3. Appliquer le schéma

Dans le **terminal 2** :

```powershell
npm run db:push
```

Cette commande synchronise le schéma Drizzle avec la base configurée. En local,
`db:push` est pratique pour le développement ; utilisez les migrations
versionnées pour les déploiements contrôlés.

### 4. Démarrer Next.js

Toujours dans le **terminal 2**, ou dans un nouveau terminal :

```powershell
npm run dev
```

Ouvrez ensuite <http://localhost:3000>.

Si le port 3000 est déjà occupé :

```powershell
npm run dev -- -p 3001
```

Dans ce cas, adaptez `NEXT_PUBLIC_APP_URL` et l'URL de navigation.

### 5. Charger les comptes et données de démonstration

Dans le **terminal 3**, après le démarrage de Next.js :

```powershell
Invoke-WebRequest -Method POST -Uri "http://localhost:3000/api/seed"
```

Le seed est destiné au développement. Il ne doit pas être activé librement en
production. En production, la route exige `SEED_TOKEN` et l'en-tête
`x-seed-token`.

Comptes de démonstration :

| Rôle | Email | Mot de passe |
|---|---|---|
| Admin | `admin@mybestbooking.com` | `Admin123!` |
| Hôte | `host@mybestbooking.com` | `Host123!` |
| Voyageur | `customer@mybestbooking.com` | `Customer123!` |

### 6. Vérifier le lancement

```powershell
npm run typecheck
npm run lint
npm test
```

Pour les tests d'intégration, PostgreSQL doit être démarré et `DATABASE_URL`
doit pointer sur la même instance que celle utilisée par `npm run db:push`.

Pour lancer uniquement les tests monétaires :

```powershell
npx --no-install vitest run `
  src/lib/i18n.test.ts `
  src/lib/utils.test.ts `
  src/lib/promotions.test.ts `
  src/lib/wallet-currency.test.ts `
  src/lib/currency-summary.test.ts
```

Pour compiler la version de production :

```powershell
npm run build
npm run start
```

### 7. Tests E2E

Les tests Playwright démarrent une instance de production sur le port 3100 :

```powershell
npm run e2e
```

Prérequis : PostgreSQL actif, schéma appliqué, `JWT_SECRET` défini et données
de test disponibles. Pour utiliser un serveur déjà démarré :

```powershell
$env:E2E_BASE_URL="http://localhost:3000"
npm run e2e
```

### 8. Arrêt propre et nettoyage des processus

Utilisez `Ctrl+C` dans chaque terminal qui exécute `npm run dev` ou
`npm run db:dev`.

Pour diagnostiquer les ports sous Windows :

```powershell
Get-NetTCPConnection -State Listen |
  Where-Object { $_.LocalPort -in 3000, 3100, 5432, 55432 } |
  Select-Object LocalPort, OwningProcess
```

Pour identifier un processus Node avant de l'arrêter :

```powershell
Get-CimInstance Win32_Process -Filter "name = 'node.exe'" |
  Select-Object ProcessId, ParentProcessId, CommandLine
```

N'arrêtez que les PID dont la commande contient le chemin du projet. Exemple :

```powershell
taskkill /PID <PID_NEXT> /T /F
taskkill /PID <PID_DEV_DB> /T /F
```

Ne tuez pas une instance PostgreSQL sur `5432` si elle appartient à un autre
projet ou service.

### Dépannage local

**`ENOENT package.json`** : le terminal est dans le dossier parent. Exécutez :

```powershell
Set-Location "D:\dow\build-accommodation-booking-platform\MyBestBooking"
```

**`npx` propose d'installer Vitest** : vous n'êtes pas dans le projet ou vous
utilisez une version absente de `node_modules`. Utilisez `npx --no-install` et
relancez `npm install` si nécessaire.

**Colonne absente ou tests bloqués** : vérifiez `DATABASE_URL`, puis relancez
`npm run db:push` sur la même base. Ne lancez pas `db:push` sur une autre URL.

**Port 3000 occupé** : identifiez le PID avec `Get-NetTCPConnection`, puis
arrêtez uniquement le processus du projet ou utilisez `-p 3001`.

## 🔑 Configuration sécurisée des providers

Un administrateur peut renseigner **Stripe**, **Resend** et **S3/R2** dans
`/dashboard/settings` → « Providers externes sécurisés ». Les valeurs sont
chiffrées côté serveur et ne sont jamais réaffichées. Cette interface exige
une clé maître d'infrastructure `CREDENTIALS_ENCRYPTION_KEY` (32 octets en hex
ou Base64), à définir uniquement dans l'environnement de déploiement.

Les variables `.env.local` restent compatibles comme fallback : elles sont
recommandées pour le bootstrap et la récupération. La rotation contrôlée est
opérationnelle : définir la nouvelle clé dans `CREDENTIALS_ENCRYPTION_KEY`,
l’ancienne temporairement dans `CREDENTIALS_ENCRYPTION_KEY_PREVIOUS`, utiliser
« Providers externes sécurisés » → « Réchiffrer le coffre », vérifier, puis
retirer la variable précédente. Aucune clé ne transite par le navigateur.
Voir `.env.example`, ADR-012 et `.ai/SECURITY.md`.

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
