# ⛔ Checklist BLOQUANTE — avant une mise en production

**Requise pour tout déploiement en production**, quel que soit le niveau de
la tâche. Un release qui ne passe pas cette checklist est **refusé** et
doit être rollback.

## Sécurité (§4) — 🔴 bloquants absolus

- [ ] `JWT_SECRET` défini en prod, ≥ 32 caractères aléatoires
      (`openssl rand -hex 32`)
- [ ] Le fallback hard-codé de `JWT_SECRET` a été retiré du code
      (BUG-001) — sinon, refus du release
- [ ] `POST /api/seed` **supprimée ou protégée** derrière
      `NODE_ENV !== 'production'` + token admin (BUG-002)
- [ ] Cookie `session` bien `Secure` en prod (implicite via `NODE_ENV=production`)
- [ ] Aucune clé/token committée — audit `git log -p | grep -Ei 'secret|password|token|key'`
- [ ] Headers de sécurité configurés dans `next.config.ts`
      (`Strict-Transport-Security`, `X-Content-Type-Options`,
      `X-Frame-Options`, `Referrer-Policy`)

## Base de données

- [ ] **Sauvegarde** de la base cible prise **avant** le déploiement,
  horodatée, stockée hors du serveur applicatif
- [ ] La sauvegarde a été **testée** par une restauration à blanc dans les
  30 derniers jours (▶️)
- [ ] Migrations Drizzle appliquées : `npx drizzle-kit migrate` (ou plan de
  migration validé)
- [ ] Utilisateur DB de prod a **le minimum** de droits (pas `postgres`
  superuser)
- [ ] Pool `pg` correctement dimensionné pour la charge attendue

## Application

- [ ] `npm run typecheck` sur l'image finale (🔨)
- [ ] `npm run lint` sur l'image finale (🔨)
- [ ] `npm run build` réussit dans l'environnement CI (🔨)
- [ ] `npm test` passe (🧪) — dès qu'il existe
- [ ] Playwright smoke test passe contre un env de staging (▶️)
- [ ] Health check `/api/health` répond `{"ok":true}` en staging
- [ ] Un parcours **login → recherche → réservation** testé manuellement en
  staging (▶️)

## Env & config

- [ ] Toutes les variables d'env requises sont définies en prod
      (`DATABASE_URL`, `JWT_SECRET`, `NEXT_PUBLIC_APP_URL`, `NODE_ENV=production`)
- [ ] Aucune variable de dev fuit en prod (`SEED_ENABLED`, `DEBUG`, etc.)

## Observabilité

- [ ] Les erreurs 5xx sont remontées (Sentry ou équivalent) — ou l'absence
  est explicitement acceptée
- [ ] Les logs applicatifs sont collectés
- [ ] Un tableau de bord minimal existe (taux d'erreur, latence,
  santé DB)

## Rollback

- [ ] Image/build précédent(e) toujours accessible pour rollback immédiat
- [ ] Procédure de rollback documentée et testée dans les 30 derniers jours
- [ ] Personne d'astreinte identifiée et notifiée du release

## Communication

- [ ] Note de version rédigée (changements visibles pour les utilisateurs,
  breaking changes éventuels)
- [ ] `STATE.md` mis à jour avec la version déployée et le SHA du build
- [ ] `PROGRESS.md` a une entrée « Release YYYY-MM-DD »
- [ ] `TRACEABILITY.md` : tous les items inclus dans le release ont un tag
  ▶️/🧪 attestant qu'ils ont été validés en staging

---

**Rappel** : un release en dehors de cette checklist est **de la roulette**.
Le framework existe pour éviter d'apprendre en prod ce qu'on aurait pu
apprendre en staging.
