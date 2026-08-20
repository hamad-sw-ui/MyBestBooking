# 📊 Analyse d'impact — T-022 Câblage du mode maintenance

- **Date** : 2026-08-20 (Session 7, suite)
- **Tâche** : T-022 — Câblage du mode maintenance
- **Niveau** : **S** (nouvelle page publique, helper serveur, guards
  dans 2 layouts et 5 routes API critiques, aucune migration DB)
- **Auteur** : Arena Agent Mode

## §14 — 9 questions obligatoires

### 1. Quoi

Rendre effectif le paramètre `security.maintenanceMode` livré par T-021 :
tant qu'il est vrai, tout utilisateur non-admin est renvoyé sur une
page `/maintenance` (RSC) et les endpoints API métier critiques
répondent `503 Service Unavailable` avec un header `Retry-After`.

Les admins conservent un accès complet (dashboard + routes admin +
`/api/admin/settings/*` pour pouvoir désactiver le mode). Les
endpoints `/api/auth/*` restent joignables pour ne pas empêcher un
admin de se connecter.

### 2. Où

Nouveaux fichiers :

- `src/lib/maintenance.ts` — helpers :
  - `isMaintenanceActive()` (lit `getSetting("security").maintenanceMode`).
  - `assertNotMaintenance(user)` — throw `MaintenanceError` si actif et
    user non admin. Utilisé dans les routes API métier.
  - `shouldBypassMaintenance(pathname)` — whitelist déterministe des
    chemins toujours ouverts (auth, admin, assets, /maintenance, /connexion).
- `src/lib/maintenance.test.ts` — tests unitaires (bypass, non-admin
  bloqué, admin autorisé, cache invalidé).
- `src/app/maintenance/page.tsx` — page publique de maintenance
  (RSC, `noindex`).

Fichiers modifiés :

- `src/app/(main)/layout.tsx` — si maintenance actif et user non
  admin → `redirect("/maintenance")`.
- `src/app/dashboard/layout.tsx` — idem sauf pour admin.
- `src/app/api/bookings/route.ts` (`POST`), `[id]/route.ts` (`PUT`) —
  guard `assertNotMaintenance` en tête.
- `src/app/api/uploads/route.ts` (`POST`) — idem.
- `src/app/api/reviews/route.ts` (`POST`), `promotions/apply/route.ts`
  (`GET`) — idem.
- `.ai/REPORTS/analyse_impact_2026-08-20_maintenance_mode.md` — ce
  document.
- `.ai/REPORTS/analyse_conception_2026-08-20_maintenance_mode.md` —
  §15.1.

### 3. Pourquoi

Sans ce câblage, le paramètre `maintenanceMode` livré par T-021 ne
produit **aucun effet**. Le framework §16 interdit d'afficher un
booléen « prêt » qui ne fait rien : c'est un mensonge produit.

Valeur : permettre à un admin de fermer temporairement la plateforme
(déploiement critique, incident) en un seul clic depuis
`/dashboard/settings`, sans manipulation d'infra.

### 4. Appelants

- `getSetting("security")` : nouveau caller, une fonction pure lue
  depuis `src/lib/settings.ts` (déjà cache 60 s).
- `src/app/(main)/layout.tsx` : layout racine de toutes les pages
  publiques + zones protégées (mon-compte, mes-reservations, etc.).
- `src/app/dashboard/layout.tsx` : layout racine du dashboard host/admin.
- Routes API critiques : `POST /api/bookings`, `PUT /api/bookings/[id]`,
  `POST /api/uploads`, `POST /api/reviews`, `GET /api/promotions/apply`.
  Grep : `grep -rn "export async function POST\|export async function PUT"
  src/app/api/`.

### 5. Contrat public

- **Nouvelle** page `/maintenance` — additive.
- **Aucune** signature d'API ne change. Les endpoints touchés
  **peuvent** répondre 503 en plus des statuts existants — c'est un
  ajout de statut, compatible avec tous les clients HTTP.
- Le paramètre `security.maintenanceMode` existait déjà (T-021) ; seule
  sa lecture est nouvelle.

### 6. Migration

Aucune. Défaut = `maintenanceMode: false` → comportement d'origine
identique. Aucun backfill.

### 7. Sécurité

- **Anti-lockout admin** : la whitelist `shouldBypassMaintenance`
  inclut `/api/auth/*`, `/api/admin/*`, `/connexion`, `/maintenance`,
  `/_next/*`, `/favicon.ico`, `/robots.txt`, `/sitemap.xml`. Elle est
  **déterministe** (aucune lecture DB), donc l'admin peut **toujours**
  se connecter et désactiver le mode.
- **Défense en profondeur** : le guard tourne côté serveur (RSC ou
  handler API). Le proxy edge n'a **pas** été modifié car il ne peut
  pas lire la DB (contrainte edge, ADR-005).
- Pas de nouvelle surface d'attaque : le mode est un simple booléen
  lu, aucun secret ni PII traversé.
- Le paramètre est déjà protégé en écriture (T-021 §14.7 : role admin
  + Zod + rate-limit 30/min).

### 8. Test

Unitaires (`src/lib/maintenance.test.ts`) :

- `shouldBypassMaintenance` retourne `true` pour `/api/auth/login`,
  `/api/admin/settings`, `/maintenance`, `/connexion`, `/_next/x`,
  `/favicon.ico`.
- `shouldBypassMaintenance` retourne `false` pour `/`, `/recherche`,
  `/api/bookings`, `/dashboard/bookings`.
- `assertNotMaintenance` : ne throw pas si `maintenanceMode=false`
  (peu importe le rôle), throw `MaintenanceError` si `true` +
  `role!=='admin'`, ne throw pas si `true` + `role==='admin'`.

Manuel ▶️ :

1. Login admin → activer `security.maintenanceMode`.
2. Tenter d'accéder à `/` en tant qu'invité → redirection
   `/maintenance` avec un message clair.
3. Tenter `POST /api/bookings` en tant que customer → **503** avec
   header `Retry-After`.
4. Login admin → `/dashboard/settings` accessible, permet de
   désactiver.
5. Désactiver → toute la plate-forme reprend son comportement normal.

### 9. Rollback

- `git revert` du commit T-022 → les guards disparaissent, le
  paramètre redevient inerte. Aucune donnée à nettoyer.
- Rollback partiel possible : commenter un seul guard sans casser
  les autres (chaque appel est indépendant).
