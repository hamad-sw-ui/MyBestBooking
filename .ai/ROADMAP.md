# 🧭 Roadmap indicative

Ceci est une **suggestion d'ordre** pour faire évoluer le projet, pas un
engagement contractuel. Rien de ce qui est en dessous n'est un prérequis pour
travailler sur autre chose.

## Étape 1 — Solidifier la base (avant tout déploiement)

Objectif : ne plus dépendre de valeurs par défaut dangereuses, avoir un
socle reproductible.

- `JWT_SECRET` obligatoire au démarrage.
- Protéger / retirer `POST /api/seed`.
- Créer `README.md`, `.env.example`.
- Ajouter les scripts npm `db:push` / `db:generate` / `db:studio`.
- Générer les migrations Drizzle et commiter le dossier `drizzle/`.
- CI minimale : `lint` + `typecheck` + `build`.

## Étape 2 — Réservation réelle

Objectif : rendre le tunnel de réservation exploitable en conditions réelles.

- Intégration paiement Stripe (test mode puis live), webhooks de confirmation.
- Vérifier la disponibilité (`room_availability`) au moment de la réservation
  et décrémenter atomiquement.
- Envoi d'un email de confirmation avec la référence `MBB-YYYY-XXXXXX`.
- Politique d'annulation appliquée réellement (`cancellationPolicy` du
  `rate_plan` ou de la `property`).
- Suspense + fallback propres sur `reservation/page.tsx`.

## Étape 3 — Confort hôte

Objectif : donner à un hôte de quoi vraiment gérer son offre.

- Éditeur de calendrier (prix / stock / stop-sell) sur `/dashboard/rooms`.
- Validation admin des `properties` (`status: pending → active`).
- Analytics : chiffre d'affaires, commissions, taux d'occupation.
- Messagerie fonctionnelle (endpoints + notifications).

## Étape 4 — Confiance et croissance

- 2FA, vérification email réelle, rate-limiting.
- I18n EN (le modèle est prêt), devises multiples au checkout.
- Programme BestRewards vraiment récompensant (remises, wallet utilisable).
- SEO : `sitemap.xml`, `robots.txt`, `next/image`, `metadata` par page,
  balises OpenGraph.

## Étape 5 — Qualité et exploitation

- Tests d'intégration API par ressource.
- Smoke test E2E Playwright (recherche → réservation → avis).
- Monitoring erreurs (Sentry ou équivalent).
- Backups PostgreSQL automatisés.
- Runbook incident dans `.ai/` (que faire si la DB est HS, si le paiement
  tombe, etc.).
