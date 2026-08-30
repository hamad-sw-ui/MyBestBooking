# 🧭 Roadmap indicative

Ceci est une **suggestion d'ordre** pour faire évoluer le projet, pas un
engagement contractuel. Rien de ce qui est en dessous n'est un prérequis pour
travailler sur autre chose.

## Étape 1 — Solidifier la base (avant tout déploiement)

Objectif : ne plus dépendre de valeurs par défaut dangereuses, avoir un
socle reproductible.

- ✅ `JWT_SECRET` obligatoire au démarrage.
- ✅ `POST /api/seed` protégé en production par `SEED_TOKEN`.
- ✅ `README.md`, `.env.example`, scripts npm et migrations Drizzle présents.
- ✅ Build, lint et typecheck exécutables.

## Étape 2 — Réservation réelle

Objectif : rendre le tunnel de réservation exploitable en conditions réelles.

- ⚠️ Paiement réel à activer avec les credentials fournisseur ; le mock reste
  disponible pour le développement.
- ✅ Disponibilité, `room_availability` et verrouillage anti-surbooking
  appliqués au moment de la réservation.
- ✅ Email de confirmation et référence de réservation présents.
- ✅ Politique d'annulation appliquée côté API.
- 🟠 Renforcer les états d'erreur et le fallback du checkout.

## Étape 3 — Confort hôte

Objectif : donner à un hôte de quoi vraiment gérer son offre.

- ✅ Éditeur calendrier, validation admin, analytics de base et messagerie
  fonctionnelle présents.
- 🟠 Ajouter ADR/RevPAR, export et vue mobile dashboard.

## Étape 4 — Confiance et croissance

- ✅ 2FA et rate-limiting présents.
- 🟠 Rendre la vérification email obligatoire pour les actions sensibles.
- I18n EN (le modèle est prêt), devises multiples au checkout.
- Programme BestRewards vraiment récompensant (remises, wallet utilisable).
- SEO : `sitemap.xml`, `robots.txt`, `next/image`, `metadata` par page,
  balises OpenGraph.

## Étape 5 — Qualité et exploitation

- 🟠 Étendre les tests d'intégration API par ressource.
- ✅ Smoke test E2E Playwright public et protections de routes.
- 🟠 Ajouter le parcours E2E complet recherche → réservation → avis.
- Monitoring erreurs (Sentry ou équivalent).
- Backups PostgreSQL automatisés.
- Runbook incident dans `.ai/` (que faire si la DB est HS, si le paiement
  tombe, etc.).
