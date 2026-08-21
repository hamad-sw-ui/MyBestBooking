# 📦 Dépendances

Snapshot des versions déclarées dans `package.json` au moment de la rédaction.
À mettre à jour quand on change une version majeure.

## Runtime

| Paquet | Version | Rôle |
|---|---|---|
| `next` | `16.2.6` | Framework, App Router, RSC, route handlers |
| `react` | `19.2.6` | UI |
| `react-dom` | `19.2.6` | Renderer web |
| `drizzle-orm` | `0.45.2` | ORM typé PostgreSQL |
| `pg` | `8.20.0` | Driver PostgreSQL (Pool) |
| `jose` | `^6.2.9` | Signature/vérification JWT (HS256) |
| `bcryptjs` | `^3.0.3` | Hachage des mots de passe |
| `zod` | `^4.4.3` | Validation des payloads |
| `date-fns` | `^4.4.0` | Manipulation de dates (utilisation ponctuelle) |
| `clsx` | `^2.1.1` | Concaténation conditionnelle de classes |
| `tailwind-merge` | `^3.6.0` | Fusion intelligente de classes Tailwind |
| `dotenv` | `17.3.1` | Chargement `.env` (Next le fait déjà nativement) |
| `uuid` | `^14.0.2` | Génération d'UUID côté app (ex : `shareToken`) |
| `lucide-react` | `^1.33.0` | Icônes ⚠️ **à vérifier** — la ligne stable est 0.x |

## Types & dev

| Paquet | Version |
|---|---|
| `typescript` | `5.9.3` |
| `@types/node` | `22.19.15` |
| `@types/react` | `19.2.14` |
| `@types/react-dom` | `19.2.3` |
| `@types/pg` | `8.18.0` |
| `@types/bcryptjs` | `^2.4.6` |
| `@types/uuid` | `^10.0.0` |
| `tailwindcss` | `4.1.17` |
| `@tailwindcss/postcss` | `4.1.17` |
| `postcss` | `8.5.8` |
| `eslint` | `9.39.4` |
| `eslint-config-next` | `16.2.6` |
| `drizzle-kit` | `0.31.10` |

## Ce que ces choix impliquent

- **Tailwind v4** : plus de `tailwind.config.ts`. Les tokens vivent dans
  `globals.css` sous `@theme { ... }`. Les plugins passent par
  `@tailwindcss/postcss` (déjà configuré dans `postcss.config.mjs`).
- **Drizzle 0.45 + Kit 0.31** : `drizzle-kit push` est OK pour dev, `generate`
  produira un dossier `drizzle/` versionné. La config est en JSON
  (`drizzle.config.json`), on peut la migrer en `.ts` plus tard si besoin
  (défaults, env dynamique).
- **React 19 + Next 16** : hooks async côté serveur (`cookies()`, `headers()`,
  `params`) tous en `await`. Les Server Actions sont dispo mais **non
  utilisées** dans ce dépôt aujourd'hui — tout passe par `fetch` sur `/api/*`.
- **`bcryptjs`** (pur JS) plutôt que `bcrypt` (natif) : plus lent mais aucun
  binaire à compiler → OK pour Vercel/edge-less Node.
- **`jose`** plutôt que `jsonwebtoken` : plus moderne, isomorphe, mieux
  maintenu.

## Points de vigilance

- **`lucide-react` `1.33.0`** : la version officielle de `lucide-react` en
  août 2026 tourne autour de `0.4xx`. Cette version majeure (1.x) est
  probablement une erreur de résolution/typo. À vérifier avec `npm ls
  lucide-react` — si l'app compile et affiche des icônes correctement, laisser ;
  sinon repasser à la dernière `0.4xx` stable.
- **`zod` v4** : API `error.issues[0].message` correctement utilisée. Attention
  aux breaking changes si mise à jour depuis un tuto v3.
- **`dotenv`** est déclaré mais Next.js charge déjà `.env` / `.env.local`
  automatiquement — on peut probablement le retirer.
- Toutes les versions clés (`next`, `react`, `drizzle-kit`, `eslint-config-next`,
  `tailwindcss`) sont **pinnées** sans caret : bien, plus reproductible.

## Comment ajouter une dépendance

1. `npm install <pkg>` (ou `-D` pour dev).
2. Vérifier qu'elle apporte quelque chose que les libs déjà présentes ne font
   pas. Beaucoup de besoins (dates, classes, forms) sont couverts.
3. Mettre à jour ce fichier avec la version installée et son rôle.
