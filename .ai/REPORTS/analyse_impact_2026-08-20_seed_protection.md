# Analyse d'impact — T-002 : protéger `POST /api/seed`

- **Date** : 2026-08-20 (Session 4)
- **Tâche** : T-002 (corrige BUG-002)
- **Niveau** : **C** (surface d'attaque exposée)
- **Auteur** : Arena Agent Mode
- **Référence** : `CODING_RULES.md` §14

---

## 1. Quoi

`POST /api/seed` est aujourd'hui accessible **sans aucune authentification**
(voir `src/app/api/seed/route.ts:169`). Le handler est idempotent (early-exit
si `users` non vide) mais peut être appelé n'importe quand par n'importe qui
avant que la première inscription ait eu lieu. En prod, cela permet à un
attaquant de créer les comptes de démo (dont un admin `admin@mybestbooking.com`
avec mot de passe **public dans le code** : `Admin123!`).

Deux verrous à ajouter :
1. **Refus en production** sauf si un `SEED_TOKEN` est fourni et validé.
2. **En dev**, autorisé sans token pour ne pas gêner l'onboarding.

## 2. Où

- `src/app/api/seed/route.ts` — ajouter une garde en tête du handler `POST`.
- `.env.example` — documenter `SEED_TOKEN` (optionnel, uniquement si on veut
  seed en prod à la main).
- `.ai/API.md`, `.ai/SECURITY.md`, `.ai/BUGS.md`, `.ai/DEV_ENVIRONMENT.md`.

## 3. Pourquoi

- BUG-002 est classé P1 dans `SECURITY.md`.
- La checklist `avant_release.md` refuse le déploiement tant que ce point
  n'est pas traité.
- Mot de passe admin en clair dans le code (`Admin123!`) est un multiplicateur
  d'impact.

## 4. Appelants

```bash
grep -rn "api/seed" .
```

- Documentation : `.ai/API.md`, `.ai/DEV_ENVIRONMENT.md`,
  `.ai/CHECKLISTS/avant_release.md`, `.ai/BUGS.md`, README.
- Aucun appelant côté code applicatif (`fetch('/api/seed')` n'apparaît
  nulle part dans `src/`). Le seul appelant est **l'humain via curl** au
  démarrage d'une nouvelle base.

Rayon d'impact : **runtime nul côté code, opérationnel léger** (dev seed
inchangé, prod exige `SEED_TOKEN`).

## 5. Contrat public

Contrat cassé volontairement : `POST /api/seed` sans header en prod
retournera désormais **404** (pas 401 — on cache l'existence de la route
à un attaquant non authentifié). En dev, aucun changement observable.

## 6. Migration

- Dev : rien à faire, comportement inchangé.
- CI : rien à faire.
- Prod : le déploiement initial n'a jamais eu lieu, donc pas de rotation
  nécessaire. Le jour où une prod existera, ne pas définir `SEED_TOKEN`
  (empêche même une exécution intentionnelle) ou le définir avec un
  token aléatoire fort et le stocker séparément.

## 7. Sécurité

Impact positif direct sur BUG-002. Trois points d'attention :

1. **Ne pas révéler l'existence de la route en prod** → 404, pas 401/403.
2. **Comparaison à temps constant** du token : `crypto.timingSafeEqual`
   pour éviter un timing attack.
3. **Ne pas loguer le token** ni la valeur attendue.

## 8. Test

- **Vitest** (double validation §13.5) : `src/app/api/seed/route.test.ts`
  qui appelle le handler `POST` exporté directement avec 4 scénarios
  (NODE_ENV=development sans token → OK, NODE_ENV=production sans token
  → 404, prod + mauvais token → 404, prod + bon token → OK ou 200).
- **▶️ Test manuel** : `curl -X POST http://localhost:3000/api/seed`
  en dev = 200 (déjà en cours).

## 9. Rollback

`git revert` — le seed redevient public. Aucun autre effet.
