# ✅ Aide-mémoire — avant de mettre en prod

Non bloquant, mais fortement recommandé — un déploiement raté coûte cher.

## Sécurité

- [ ] `JWT_SECRET` défini en prod (chaîne aléatoire ≥ 32 caractères)
- [ ] `DATABASE_URL` pointe sur la bonne base (pas la dev)
- [ ] `POST /api/seed` protégée ou supprimée
- [ ] Cookie `session` bien `Secure` (implicite via `NODE_ENV=production`)
- [ ] Aucune clé/token committée dans le repo

## Base

- [ ] Migrations Drizzle appliquées sur la base cible
- [ ] Backup de la base pris avant le déploiement
- [ ] Utilisateur DB avec les bons droits (pas `postgres` en prod idéalement)

## Application

- [ ] `npm run build` réussit dans l'environnement de la CI
- [ ] Health check `/api/health` répond `{"ok":true}` après le déploiement
- [ ] Login + un parcours de réservation testés post-déploiement
- [ ] Rollback documenté (image précédente, snapshot DB)

## Communication

- [ ] Note de version rédigée si des utilisateurs sont impactés
- [ ] `DEVLOG.md` mis à jour avec la version déployée
