# Analyse d'impact — T-001 : JWT_SECRET obligatoire au démarrage

- **Date** : 2026-08-20 (Session 4)
- **Tâche** : T-001 (corrige BUG-001)
- **Niveau** : **C** (sécurité auth)
- **Auteur** : Arena Agent Mode
- **Référence** : `CODING_RULES.md` §14 (9 questions)

---

## 1. Quoi

Suppression du fallback hard-codé `"mybestbooking-secret-key-2025"` dans
`src/lib/auth.ts:9`. Remplacement par un `throw` explicite si
`process.env.JWT_SECRET` est absent au chargement du module.

## 2. Où

Un seul fichier de code touché : **`src/lib/auth.ts`** (lignes 7-11).

Fichiers de doc/config touchés : `SECURITY.md`, `DEV_ENVIRONMENT.md`,
`BUGS.md`, `TRACEABILITY.md`, `STATE.md`, `PROGRESS.md`, `.env.example` (créé).

## 3. Pourquoi

BUG-001 : le fallback est un secret **publiquement lisible** sur GitHub.
Si `JWT_SECRET` n'est pas défini en production (oubli d'env var,
mauvaise configuration Vercel/Docker), n'importe quel visiteur du dépôt
peut :

1. calculer le HMAC-SHA256 d'un JWT `{ userId: "<uuid-admin>" }` ;
2. le passer dans le cookie `session` ;
3. voir `getSession()` vérifier le JWT avec succès (signature correcte)
   → seule protection restante : la ligne `sessions` en base doit exister.

**Chaîne d'exploitation complète** requiert aussi une entrée `sessions`
valide → l'attaque est **partielle** en pratique, mais devient totale si
`POST /api/auth/register` a été appelé une fois (le token retourné est
alors persisté). Combinée avec BUG-002 (seed public), l'exploitation est
triviale : seed → forge JWT avec un userId admin connu → utilisation.

## 4. Appelants

```bash
grep -rn "JWT_SECRET\|verifyToken\|createToken\|getSession\|getCurrentUser" src
```

Résultat :

- **`src/lib/auth.ts`** définit `JWT_SECRET`, `createToken`,
  `verifyToken`, `createSession`, `getSession`, `getCurrentUser`,
  `logout`, `requireAuth`, `hashPassword`, `verifyPassword`.
- **Appelants de `getCurrentUser`** :
  - `src/app/(main)/layout.tsx` (RSC)
  - `src/app/dashboard/layout.tsx` (RSC + `redirect()`)
  - `src/app/page.tsx` (RSC)
  - `src/app/api/auth/me/route.ts`
  - `src/app/api/properties/route.ts` (POST)
  - `src/app/api/bookings/route.ts` (GET, POST)
  - `src/app/api/wishlists/route.ts` (GET, POST)
  - `src/app/api/rooms/route.ts` (POST)
  - `src/app/api/reviews/route.ts` (POST)
- **Appelants de `createSession`** : `login`, `register` handlers.
- **Appelants de `getSession`** : uniquement `getCurrentUser` (dans le
  même fichier).

Le module `auth.ts` est chargé au démarrage par **tout** ce qui touche à
l'authentification. Un `throw` au chargement fait échouer le démarrage
du serveur — c'est **voulu** (fail-fast).

## 5. Contrat public

- Aucun changement dans la signature des fonctions exportées.
- Le contrat implicite « le serveur démarre même sans `JWT_SECRET` »
  **est cassé volontairement**. C'est le but.
- Aucun changement du schéma DB, du contrat d'API, ni des types
  exportés.

## 6. Migration

- **Développement** : `JWT_SECRET` est déjà dans `.env.local` (créé
  Session 3). Rien à faire.
- **CI** : dès qu'une CI existera, elle devra définir `JWT_SECRET` en
  variable d'env. Documenté dans `DEV_ENVIRONMENT.md` et `.env.example`.
- **Production** : lors du prochain déploiement, l'ops doit garantir que
  `JWT_SECRET` (≥ 32 octets aléatoires, ex : `openssl rand -hex 32`) est
  défini. Sinon le serveur refuse de booter → détecté immédiatement.
- **Sessions actives** : le fallback aurait normalement produit des JWT
  signés avec la même clé publique. Aucune session prod n'a jamais été
  émise (projet en pré-production). Aucune rotation de secret nécessaire.

## 7. Sécurité

Impact **positif** direct :

- Élimine la surface d'attaque « forge de JWT avec clé publique ».
- Rend une mauvaise configuration prod **visible** (le serveur ne
  démarre pas) plutôt que **silencieuse** (le serveur démarre mais avec
  un secret compromis).

Aucune nouvelle surface d'attaque introduite. Le message d'erreur ne
révèle rien de sensible (« JWT_SECRET is required »).

Point d'attention : le message d'erreur pointe sur `.ai/SECURITY.md`.
Cela révèle l'existence de `.ai/` — non sensible (ce dossier est
public), mais à noter.

## 8. Test

Comment vérifier que ça marche :

- **Test unitaire (§13.5 double validation)** : nouveau fichier
  `src/lib/auth.test.ts` avec 2 cas :
  1. `JWT_SECRET` défini → hash + verify d'un mot de passe fonctionne
     et un token créé peut être vérifié.
  2. `JWT_SECRET` absent → l'import du module (via un helper
     `resetModules` de Vitest) throw avec le message attendu.

- **Test manuel ▶️** :
  ```bash
  # Cas nominal
  JWT_SECRET=x npm run build     # OK
  # Cas échec attendu
  unset JWT_SECRET && npm run build   # doit échouer explicitement
  ```

Comment vérifier que rien n'est cassé :

- `npm run typecheck` → 0 erreur.
- `npm run build` → OK (avec `.env.local`).
- `npm test` → 17 tests existants + 2 nouveaux passent.
- Curl `/api/health`, `/api/auth/register`, `/api/auth/login`,
  `/api/auth/me` → comportement inchangé.

## 9. Rollback

- `git revert <commit>` restaure le fallback. Aucun effet de bord
  (schéma DB inchangé, aucune session prod émise avec la nouvelle logique).
- Effort de rollback : **< 30 secondes**.
- Impact utilisateur d'un rollback : nul en prod (BUG-001 revient, mais
  ne concerne que la surface d'attaque théorique).

---

## Conclusion

Changement de **impact runtime local, à impact sécurité fort positif**.
Le seul risque opérationnel réel : oublier de définir `JWT_SECRET` en
prod → boot échoue → downtime au déploiement. Ce risque est **voulu**
(fail-fast) et mitigé par la documentation `.env.example` +
`DEV_ENVIRONMENT.md` + checklist `avant_release.md`.
