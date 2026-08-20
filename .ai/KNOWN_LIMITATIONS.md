# 🚧 KNOWN_LIMITATIONS — limites assumées

Ce document liste les **limites connues** du produit qui **ne sont pas des
bugs** : ce sont des choix ou des dettes acceptées, avec la raison. Une
limite peut redevenir un bug si le contexte change — la déplacer alors dans
`BUGS.md`.

À distinguer de :

- `BUGS.md` — défauts non voulus.
- `BACKLOG.md` — évolutions désirées, non encore priorisées.

---

## Produit

- **Paiement mocké.** `POST /api/bookings` force `paymentStatus: 'paid'`
  sans débit. Limite assumée le temps du prototype ; devient un bug le jour
  où le produit est exposé à de vrais utilisateurs (déjà tracé en B-003).
- **Uniquement le français.** Le modèle DB supporte `descriptionEn` et
  `users.language`, mais aucun mécanisme d'i18n n'est en place côté UI.
  Assumé tant que le marché cible est francophone.
- **Une seule devise affichée** au niveau utilisateur (EUR par défaut),
  bien que la table `bookings.currency` soit multi-devises.
- **Pas de mode invité** au checkout : il faut créer un compte pour
  réserver. Choix pour simplifier le programme BestRewards.

## Technique

- **Aucune migration Drizzle versionnée.** Le schéma est synchronisé via
  `drizzle-kit push` en dev. Assumé jusqu'au premier déploiement, ensuite
  ce devient un bloqueur (tracé en B-015).
- **Aucun test automatisé.** État courant, cible : voir `TEST_PLAN.md`.
- **`<img>` HTML natif** partout au lieu de `next/image`. Assumé pour aller
  vite sur le prototype ; à migrer avant tout SEO sérieux (B-006).
- **Fallback `JWT_SECRET`** hard-codé. Assumé **uniquement en dev**. Devient
  une faille P1 en prod (B-001).
- **`POST /api/seed` public.** Assumé en dev, à supprimer/protéger en prod
  (B-002).
- **Pas de rate-limiting.** Assumé sans utilisateurs réels. Devient bug avec
  premier utilisateur (B-009).
- **`averageRating` recalculé à la main** dans `POST /api/reviews`. Race
  condition théorique acceptée tant que le trafic est faible (B-010).

## Framework

- **Application manuelle du framework.** Aucun linter, aucun hook Git ne
  vérifie que `CURRENT_TASK.md` est à jour, que les rapports d'impact
  existent, ou que les tags §16 sont posés. L'application repose sur la
  discipline des humains et des agents. Un mécanisme automatisé
  (`.githooks/`, GitHub Actions) est souhaitable — voir
  `PROCESS_IMPROVEMENTS.md`.
- **Pas de vérification que `framework.manifest.json` est cohérent** avec
  l'arborescence réelle. Un fichier obligatoire supprimé ne fait pas
  échouer un `npm run build`. À terme, un script `scripts/check-ai.mjs`
  pourrait détecter les incohérences.

## Environnement de développement

- **PostgreSQL requis en local.** Pas de SQLite d'appoint, pas de mock DB
  intégré. Choisi pour rester au plus près de la prod. Suppose Docker (ou
  un Postgres installé nativement).
- **Node 20+** requis (contrainte de Next 16). Assumé.

---

Si l'une de ces limites bloque la prochaine étape (ex : mise en prod), la
déplacer immédiatement dans `BUGS.md` **avec la priorité appropriée** et
créer une tâche dans `BACKLOG.md`.
