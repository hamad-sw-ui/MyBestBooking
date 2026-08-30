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

- **Validation Stripe réelle non exécutée dans le sandbox.** Le checkout utilise
  Stripe Elements lorsque les clés Stripe secrète, webhook et publique sont
  configurées et ne présente jamais un intent `pending` comme payé. Aucun
  compte/jeu de clés Stripe n'est disponible ici : capture, webhook et
  remboursement Stripe test-mode restent à valider avant ouverture production.
  Le mock est explicitement limité au dev/test et refusé en production sans
  configuration complète.

- **Vérification d'email non bloquante.** L'inscription envoie un mail de
  vérification best-effort et crée la session immédiatement. Le produit ne
  bloque pas encore les actions sensibles tant que `emailVerified` est faux.

- **Rotation provider assistée mais opérée par l’infrastructure.** Les overrides
  Stripe, Resend et S3 sont chiffrés AES-GCM et peuvent être réchiffrés via le
  keyring temporaire documenté dans ADR-012. La clé primaire et l’ancienne
  restent exclusivement des variables d’environnement : leur perte avant
  rotation rend toujours les données chiffrées illisibles. Une sauvegarde
  sécurisée des secrets et une procédure d’incident restent indispensables.

- **Rate-limit en mémoire (mono-instance).** `src/lib/rate-limit.ts` de
  T-009 utilise une Map process-local. En déploiement multi-instance
  (Vercel, Kubernetes avec réplicas), chaque instance a son propre
  compteur → limite effective multipliée par le nombre d'instances.
  Suffisant pour ralentir un attaquant naïf, à remplacer par Redis
  (Upstash, ioredis) pour un vrai rate-limiting global.

- **Rotation JWT_SECRET manuelle.** Voir ADR-003. Une rotation
  invalide toutes les sessions actives (30 jours par défaut).
- **Uniquement le français.** Le modèle DB supporte `descriptionEn` et
  `users.language`, mais aucun mécanisme d'i18n n'est en place côté UI.
  Assumé tant que le marché cible est francophone.
- **Une seule devise affichée** au niveau utilisateur (EUR par défaut),
  bien que la table `bookings.currency` soit multi-devises.
- **Mode invité limité.** Le checkout accepte un email non enregistré et crée
  un profil sans mot de passe. Un email déjà associé à un compte doit être
  utilisé après connexion pour éviter le rattachement de données.

## E-mails (hôtes ↔ clients)

Audit du 2026-08-30 (`REPORTS/audit_emails_hotes_clients_2026-08-30.md`)
puis **implémentation T-150** (`REPORTS/validation_T-150_2026-08-30.md`) :
les trois écarts sont **résolus** — CTA direct dans `newMessage` (section
selon le rôle du destinataire), sujet/corps plateforme localisés fr/en,
e-mail d'annulation à l'hôte (`bookingHostCancellation`, localisé fr/en via
l'outbox). Restent assumées :

- **E-mail de vérification à l'inscription en français par défaut.** Le
  schéma `POST /api/auth/register` n'accepte pas `language` : l'e-mail de
  vérification part avant que la préférence puisse être enregistrée (elle
  arrive via `PATCH /api/users/me`). Préexistant, hors périmètre messaging —
  traitable dans une future tâche.
- **Corps éditables admin non traduits.** Les blocs `emailTemplates`
  personnalisés par l'admin gardent la langue de rédaction admin (compromis
  T-025) ; la localisation fr/en s'applique aux contenus plateforme
  (habillage, `priceAlert`, `guestAccountClaim`, `bookingHostCancellation`,
  `newMessage` par défaut) et au CTA.

## Technique

- **Migrations Drizzle présentes**, mais `drizzle-kit push` reste le chemin
  local le plus utilisé ; vérifier le pipeline de migration avant production.
- **Tests automatisés partiels.** Les tests unitaires et smoke existent, mais
  les parcours métier complets et les tests DB live ne sont pas tous stables.
- **Quelques `<img>` HTML natifs** restent dans des écrans secondaires ; ils
  doivent être migrés vers `next/image` pour un SEO/performance complet.
- **`POST /api/seed` public.** Assumé en dev, à supprimer/protéger en prod
  (BUG-002).
- **Rate-limit en mémoire** : présent sur les routes critiques, mais non
  distribué entre plusieurs instances. Voir la limite produit ci-dessus.

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

- **`next/font/google` désactivé** (T-017 → revert). `next build`
  échoue quand le CDN Google Fonts est inaccessible (cas du sandbox
  agent Arena). Retombé sur `<link>` Google Fonts dans
  `src/app/layout.tsx` (fonctionne à l'exécution : le navigateur du
  visiteur télécharge les fonts). En prod avec CI ayant accès CDN,
  migrer à `next/font/google` pour inlining + no-FOUT. Backlog.

- **PostgreSQL requis en local.** Pas de SQLite d'appoint, pas de mock DB
  intégré. Choisi pour rester au plus près de la prod. Suppose Docker (ou
  un Postgres installé nativement).
- **Node 20+** requis (contrainte de Next 16). Assumé.

---

Si l'une de ces limites bloque la prochaine étape (ex : mise en prod), la
déplacer immédiatement dans `BUGS.md` **avec la priorité appropriée** et
créer une tâche dans `BACKLOG.md`.
