# ADR-004 — Protection de `POST /api/seed` en production

- **Date** : 2026-08-20
- **Statut** : accepté
- **Niveau** : C
- **Tâche** : T-002 (corrige BUG-002)
- **Rapports** :
  - `REPORTS/analyse_impact_2026-08-20_seed_protection.md`
  - `REPORTS/analyse_conception_2026-08-20_seed_protection.md`
  - `REPORTS/debat_technique_2026-08-20_seed_protection.md`

## Contexte

`POST /api/seed` était accessible sans authentification. Bien que le
handler soit idempotent (early-exit si `users` non vide), une base vide
en prod pouvait être peuplée par un tiers, créant notamment un compte
admin `admin@mybestbooking.com / Admin123!` (mot de passe présent en
clair dans le code source).

## Décision

Ajouter une garde en tête du handler `POST` :

```ts
const isProd = process.env.NODE_ENV === "production";
if (isProd) {
  const expected = process.env.SEED_TOKEN;
  const received = request.headers.get("x-seed-token");
  const ok =
    expected &&
    received &&
    expected.length === received.length &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  if (!ok) {
    return new NextResponse("Not Found", { status: 404 });
  }
}
```

En prod, la route est **invisible** (404) tant que `SEED_TOKEN` n'est pas
défini et fourni via l'en-tête `x-seed-token`. En dev/test, comportement
inchangé.

## Alternatives écartées

- **Supprimer la route en prod via `next.config.ts`** — perte de
  capacité manuelle, config Next 16 complexe.
- **Remplacer par un script CLI** — duplication de 500 lignes.
- **Auth admin via cookie session** — nécessite un admin déjà créé
  → poule/œuf.

## Conséquences

### Positives
- BUG-002 corrigé.
- Seed en prod possible manuellement avec un token dédié si besoin.
- 404 cache la route.

### Négatives
- Un container avec `NODE_ENV` incorrect (pas "production") supprime la
  protection. Mitigation : `avant_release.md` vérifie déjà `NODE_ENV`.

### À suivre
- Envisager de supprimer complètement la route quand un vrai script
  CLI d'admin sera disponible.

## Preuves (§16)

- 🔨 `npm run typecheck` OK
- 🔨 `npm run build` OK
- 🧪 4 tests dans `src/app/api/seed/route.test.ts`
- ▶️ Sur le dev server, seed continue de fonctionner (non-régression)

## Signatures

- Auteur : Arena Agent Mode (Session 4)
- Validé par : responsable (validation-cadre 2026-08-20)
