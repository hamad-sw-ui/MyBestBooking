# Débat technique — T-002 : protéger `POST /api/seed`

- **Date** : 2026-08-20
- **Tâche** : T-002
- **Niveau** : C
- **Proposition** : Option A du rapport de conception

## Rôles

1. **Architecte** — Garde localisée en tête de handler, cohérente avec le pattern
   des autres routes qui vérifient `getCurrentUser`. RAS.
2. **Dev Next.js** — `request.headers.get("x-seed-token")` est l'API standard
   Next 16. RAS.
3. **Expert TypeScript** — Typer `expected` et `received` avant comparaison.
   RAS.
4. **Expert React** — Non applicable (route API).
5. **Expert Drizzle** — Le seed lui-même est inchangé. RAS.
6. **Expert PostgreSQL** — Idem. RAS.
7. **Expert sécurité web** — **Deux objections** :
   - Utiliser **`crypto.timingSafeEqual`** (Node), pas `===`. Résolue —
     inclus dans la conception.
   - Retourner **404**, pas 401/403. Résolue — inclus.
   - Ne **pas loguer** `expected` ni `received`. Résolu par
     `console.log(...)` absent du patch.
8. **QA** — 4 scénarios de test obligatoires (dev+noToken=OK,
   prod+noToken=404, prod+badToken=404, prod+goodToken=200). Résolu.
9. **DevOps** — `SEED_TOKEN` doit être aléatoire fort. Documenter dans
   `.env.example` avec `openssl rand -hex 32`.
10. **UX/a11y** — Non applicable.
11. **Relecteur** — Deux questions :
    - Et si le seed en prod devient nécessaire un jour ? → Option A
      permet, en définissant `SEED_TOKEN`. Acceptable.
    - Et si un attaquant tente 10 000 tokens ? → 404 pour tous, pas de
      rate-limit dédié, mais BUG-009 (rate-limiting global) est déjà
      dans le backlog et couvrira ça.

## Objections bloquantes

Aucune. Toutes les objections sécurité sont résolues par la conception.

## Décision

Option A, avec timing-safe compare + 404. Validé.
