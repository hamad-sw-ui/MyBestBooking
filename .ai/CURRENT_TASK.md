# 🎯 TÂCHE EN COURS

## Identifiant

- **ID** : T-033
- **Titre** : Dashboards — filtres, sélection multiple, actions groupées, raccourcis clavier
- **Niveau** : **S**
- **Ouverte le** : 2026-08-21 (Session 12)
- **Statut** : **CORRIGÉ (VALIDÉ)**

## Contexte

Demande utilisateur :
> « Est-ce que selon vous les utilisateurs peuvent utiliser les
> dashboards en utilisant des raccourcis EN FAISANT DES FILTRES POUR
> LES RECHERCHES ET SELECTIONS POUR LES ELEMENTS DONNE NOUS VOUS FAIRE
> DES ACTION GROUPÉ ? Faites tous et n'arrêter que si tous est
> implémenté et testé avec succès »

Avant cette tâche, les 4 dashboards (users / properties / reviews /
bookings) rendaient toute la liste sans filtre, sans sélection multiple,
sans action groupée. Un admin devait suspendre 20 utilisateurs un à un.

## Livrables

### A. API bulk générique

`src/app/api/admin/bulk/route.ts` — endpoint POST admin-only.

Contrat :
```
POST /api/admin/bulk
{ entity: "users"|"properties"|"reviews"|"bookings",
  action: string, ids: string[] (1..100) }

→ { entity, action, requested, succeeded, skipped[], failed[] }
```

Actions par entité :
- **users** : `suspend` / `reactivate` / `anonymize` (RGPD hash email)
- **properties** : `approve` / `reject` / `suspend`
- **reviews** : `approve` / `hide` / `reject`
- **bookings** : `cancel` (respecte machine à états BUG-022)

Sécurité :
- 403 sans rôle admin
- Max 100 IDs par batch
- Admin ne peut pas s'auto-modifier
- Bulk suspend/anonymize refuse les autres admins (ne(role, "admin"))
- Chaque item traité en isolation → skipped/failed granulaire
- Audit log `bulk.action` avec metadata complète (ids, requested, succeeded)

### B. Composant `<BulkToolbar>` réutilisable

`src/components/bulk/bulk-toolbar.tsx` :
- Barre de recherche avec raccourci `/`
- Filtre statut dropdown
- Bandeau actions groupées (visible si sélection > 0)
- Confirmations métier (`window.confirm`)
- Feedback aria-live (succès/erreur)
- Raccourcis clavier globaux : `/`, `Ctrl+A`, `Ctrl+D`, `Escape`

### C. Manager par entité (composants clients)

- `src/components/bulk/users-manager.tsx` : filtres statut (active/suspended/verified) + rôle, checkboxes, 3 actions bulk
- `src/components/bulk/properties-manager.tsx` : filtres statut + type, checkboxes, 3 actions bulk (approve/reject/suspend)
- `src/components/bulk/reviews-manager.tsx` : filtre statut, checkboxes, 3 actions bulk (approve/hide/reject)
- `src/components/bulk/bookings-manager.tsx` : filtre statut + date check-in/check-out, checkboxes désactivées sur statuts terminaux, 1 action bulk (cancel)

### D. Pages dashboard shell refactorées

`src/app/dashboard/{users,properties,reviews,bookings}/page.tsx`
→ Server Component minimal qui délègue au `*Manager` client.

### E. Tests

- `src/app/api/admin/bulk/route.test.ts` : 6 tests (RBAC, payload,
  action invalide, id inexistant, > 100 ids, customer refusé)
- `scripts/dashboards_sim.py` : 37 contrôles E2E dédiés

### F. Nouveau utilitaire

`scripts/reset_test_db.mjs` : reset DB aux valeurs seed
(supprime properties test, bookings test, promos test, restore 2FA off,
wallet 25€, BR level 2, reviews approved, promo BIENVENUE10 active).
Nécessaire pour rejouer les 6 suites en séquence sans faux positifs.

## Preuves (§16)

- 🔨 `npm run typecheck` : 0 erreur
- 🧪 `npm run test` : **182/182 verts** (176 précédents + 6 nouveaux
  bulk)
- 🔨 `npm run ai:check` : 17 OK · 2 warn · 1 fail cosmétique R7
- ▶️ **6 suites en séquence · 440/440 assertions · 0 KO** :
  - smoke 91/91 ✅
  - surface 68/68 ✅
  - deep 81/81 ✅
  - xtreme 89/89 ✅
  - paranoid 74/74 ✅
  - **dashboards 37/37 ✅** (NEW)
- ▶️ E2E manuel bulk : create 3 users → suspend batch → reactivate batch
  → anonymize batch → DB vérifiée à chaque étape
- ▶️ Audit log : 17+ entrées `bulk.action` avec metadata complète

## Rapport associé

`.ai/REPORTS/simulation_dashboards_2026-08-21_session_12.md`

## Raccourcis clavier documentés

- `/` — Focus barre de recherche
- `Ctrl+A` — Sélectionner tous les items visibles (filtrés)
- `Ctrl+D` — Désélectionner tout
- `Escape` — Vider la sélection ou perdre le focus recherche
