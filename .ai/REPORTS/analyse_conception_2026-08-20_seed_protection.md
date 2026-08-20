# Analyse de conception — T-002 : protéger `POST /api/seed`

- **Date** : 2026-08-20
- **Tâche** : T-002
- **Niveau** : C
- **Référence** : `CODING_RULES.md` §15.1

## Options

### Option A — Refus binaire en prod, permissif en dev (retenue)

```ts
export async function POST(request: NextRequest) {
  const isProd = process.env.NODE_ENV === "production";
  if (isProd) {
    const expected = process.env.SEED_TOKEN;
    const received = request.headers.get("x-seed-token");
    if (!expected || !received || !timingSafeEqual(expected, received)) {
      return new NextResponse("Not Found", { status: 404 });
    }
  }
  // ... reste inchangé
}
```

**Avantages** :
- Zéro friction en dev.
- En prod, deux barrières : `NODE_ENV !== "production"` **et** absence
  de `SEED_TOKEN` = pas de route accessible.
- 404 cache la route à un attaquant.

**Inconvénients** :
- Si un dev déploie un container avec `NODE_ENV != production` (erreur
  de conf), la protection tombe. Mitigation : `avant_release.md`
  check déjà `NODE_ENV=production`.

### Option B — Supprimer la route en prod via `next.config.ts`

Rediriger `/api/seed` vers 404 quand `NODE_ENV === production`.

**Avantages** :
- Ne charge même pas le handler en prod.

**Inconvénients** :
- On perd la capacité de seed manuellement une prod si besoin.
- Configuration de routes conditionnelle complexe dans Next 16.

### Option C — Supprimer complètement `/api/seed`, remplacer par un script CLI

Script `scripts/seed.mjs` qui parle directement à la DB.

**Avantages** :
- Zéro surface HTTP.

**Inconvénients** :
- Duplique 500 lignes de code entre le handler et le script.
- Nécessite l'accès direct à la DB pour seed (pas toujours possible en
  prod managée).

## Option retenue : **A**

Garde-fou en tête du handler, tirant `NODE_ENV` et `SEED_TOKEN` d'env,
comparaison timing-safe.

## Plan d'implémentation

1. Modifier `src/app/api/seed/route.ts` — 12 lignes de garde en tête.
2. Documenter `SEED_TOKEN` dans `.env.example` et `DEV_ENVIRONMENT.md`.
3. Test Vitest : 4 scénarios (dev-OK, prod-noToken-404, prod-badToken-404,
   prod-goodToken-OK).
4. Mettre à jour SECURITY, API, BUGS.
5. Commit.
