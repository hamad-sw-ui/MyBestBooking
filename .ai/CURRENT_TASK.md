# 🎯 TÂCHE EN COURS

## Identifiant

- **ID** : T-022
- **Titre** : Câblage du mode maintenance
- **Niveau** : **S**
- **Ouverte le** : 2026-08-20 (Session 7, suite)
- **Statut** : **CORRIGÉ (VALIDÉ)**

## Contexte

T-021 a livré un paramètre `security.maintenanceMode` enregistrable par
un admin depuis `/dashboard/settings` — mais **aucun code ne le lisait**.
Cette tâche rend le paramètre effectif : quand il est activé, les
non-admins sont renvoyés sur une page `/maintenance` et les endpoints
API métier critiques répondent `503 Service Unavailable`. Les admins
gardent un accès complet pour pouvoir désactiver le mode.

## Livrables

1. **Module `src/lib/maintenance.ts`** :
   - `isMaintenanceActive()` lit `getSetting("security").maintenanceMode`.
   - `assertNotMaintenance(user)` throw `MaintenanceError` si actif et
     user non admin.
   - `maintenanceResponse()` réponse HTTP 503 + `Retry-After: 60`.
   - `shouldBypassMaintenance(pathname)` — whitelist déterministe
     anti-lockout admin (jamais bloquée : `/api/auth/*`, `/api/admin/*`,
     `/connexion`, `/inscription`, `/maintenance`, assets Next).
2. **`src/lib/maintenance.test.ts`** — 11 tests unitaires.
3. **Page `/maintenance`** — RSC, `noindex`, message français, bouton
   « Réessayer » + accès `/connexion` pour anonymes.
4. **Guards RSC** :
   - `src/app/page.tsx` — home hors du groupe (main) : guard ajouté.
   - `src/app/(main)/layout.tsx` — force-dynamic + guard.
   - `src/app/dashboard/layout.tsx` — non-admin → `/maintenance`.
5. **Guards API métier** (503 + `Retry-After`) :
   - `POST /api/bookings`
   - `PUT /api/bookings/[id]`
   - `POST /api/uploads`
   - `POST /api/reviews`
   - `GET /api/promotions/apply`
6. **Rapports** :
   - `REPORTS/analyse_impact_2026-08-20_maintenance_mode.md`
   - `REPORTS/analyse_conception_2026-08-20_maintenance_mode.md`

## Preuves (§16)

- 🔍 Impact §14 et conception §15.1 rédigés avant implémentation.
- 🔨 `npm run typecheck` ✅ 0 erreur.
- 🔨 `npm run build` ✅ succès (`/maintenance` listé).
- 🔨 `npm run lint` ✅ 0 error.
- 🧪 `npm test` : **134 passed / 134** (+11 tests
  `src/lib/maintenance.test.ts` : bypass whitelist, assertion selon
  rôle, code + retryAfter, isActive reflète settings).
- ▶️ Activer maintenance → customer `/` retourne HTML avec
  `NEXT_REDIRECT;replace;/maintenance;307` (navigateur suit
  automatiquement via meta refresh).
- ▶️ Anonyme `/` → même redirect.
- ▶️ Admin `/` → **aucun redirect** (comptage grep = 0).
- ▶️ Anonyme `/api/auth/login` → **200** (whitelist respectée).
- ▶️ Anonyme `/connexion` → **200** (whitelist).
- ▶️ Admin `/dashboard/settings` → **200** (peut désactiver).
- ▶️ Customer `POST /api/bookings` → **503** + `Retry-After: 60` +
  body `{"error":"Service momentanément en maintenance","code":"MAINTENANCE_MODE"}`.
- ▶️ Admin `POST /api/bookings` en maintenance → **201** (bypass admin).
- ▶️ Désactivation → customer récupère un booking `201` immédiatement,
  redirect disparaît après invalidation cache 60 s.
- ▶️ Cache : après TTL 60 s, tous les visiteurs voient à nouveau la
  plate-forme normale (grep NEXT_REDIRECT = 0).

## Non-régression

- Les 12 URL non modifiées (mode maintenance désactivé) répondent 200
  comme avant.
- Les 123 tests existants passent sans modification, plus les 11 nouveaux
  tests maintenance (**134 / 134**).
- La page `/maintenance` redirige vers `/` si l'admin est identifié
  ou si le mode a été désactivé, évitant les boucles.

## Impact sur le code

- **Nouveaux** : `src/lib/maintenance.ts`, `src/lib/maintenance.test.ts`,
  `src/app/maintenance/page.tsx`, 2 rapports.
- **Modifiés** : `src/app/page.tsx`, `src/app/(main)/layout.tsx`,
  `src/app/dashboard/layout.tsx`, 5 handlers API critiques.

## Étape suivante

Attente instructions utilisateur. Le paramètre `security.maintenanceMode`
est désormais complètement câblé. Reste au backlog : T-023 (modération
avis), T-024 (audit_log global), T-025 (templates emails éditables).
