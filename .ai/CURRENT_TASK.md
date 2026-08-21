# 🎯 TÂCHE EN COURS

## Identifiant

- **ID** : T-034
- **Titre** : Dashboards — extension bulk à rooms/promotions/messages/audit + icône suppression par ligne
- **Niveau** : **S**
- **Ouverte le** : 2026-08-21 (Session 13)
- **Statut** : **CORRIGÉ (VALIDÉ)**

## Contexte

Demande utilisateur (après T-033) :
> « J'espère que chaque interface dashboard nécessitant ces
> fonctionnalités possède ces nouvelles arrangements si non faites
> l'implémentation et passer les testes avec succès. je veux aussi des
> icônes de suppression dans les listes intervenants dans ces
> interfaces. arrêtez vous uniquement si tous les tests passe avec
> succès »

T-033 avait couvert 4 dashboards (users, properties, reviews, bookings).
Restaient 4 dashboards sans filtres/bulk :

| Dashboard | État avant T-034 |
|---|---|
| `/dashboard/rooms` | Grille brute sans filtres ni sélection |
| `/dashboard/promotions` | Boutons Edit/Trash **inertes** |
| `/dashboard/messages` | Champ recherche visuel non branché |
| `/dashboard/audit` | Table sans filtre |

## Livrables

### A. Extension API bulk (`/api/admin/bulk`)

- `entity="rooms"` : actions `activate`, `deactivate`, `delete`
  (refuse si booking futur pending/confirmed)
- `entity="promotions"` : actions `activate`, `deactivate`, `delete`
  (refuse si `currentUses > 0`)
- `entity="users"` : action `delete` (alias de `anonymize`)
- `entity="properties"` : action `delete` (refuse si booking actif,
  nettoie FK rooms/ratePlans/roomAvailability/wishlistItems/priceAlerts/
  reviews/messages/conversations)
- `entity="reviews"` : action `delete` (hard)

### B. Composant réutilisable `<RowDeleteButton>`

`src/components/bulk/row-delete-button.tsx` :
- Icône corbeille rouge
- `window.confirm()` avant l'action
- Fetch POST `/api/admin/bulk { action: "delete", ids: [id] }`
- `router.refresh()` en cas de succès
- Affichage inline de l'erreur en cas de skipped/failed
- `data-testid="row-delete-<entity>-<id>"`

### C. Nouveaux Managers Client

- `rooms-manager.tsx` : recherche + filtre statut/type + bulk + delete icon
- `promotions-manager.tsx` : recherche + filtre statut/type + bulk + delete icon
- `messages-manager.tsx` : recherche + filtre lu/non-lu (pas de bulk)
- `audit-filter.tsx` : recherche + filtres action/entity (pas de bulk)

### D. Icône corbeille dans les 3 Managers T-033

Ajout d'un `<RowDeleteButton>` dans la colonne « Actions » de :
`users-manager`, `properties-manager`, `reviews-manager`.
(bookings-manager : pas de delete, cancel existant via bulk).

### E. Refactor pages Server → Manager Client

- `src/app/dashboard/rooms/page.tsx` → `<RoomsManager />`
- `src/app/dashboard/promotions/page.tsx` → `<PromotionsManager />`
- `src/app/dashboard/messages/page.tsx` → `<MessagesManager />`
- `src/app/dashboard/audit/page.tsx` conservé Server + `<AuditFilter />`

### F. Tests

- `route.test.ts` : 12 cas (vs 6 T-033), couvre rooms/promotions/delete
- `dashboards_sim.py` : 69 assertions (vs 37 T-033), couvre les 8
  dashboards + les 5 icônes corbeille dans le HTML

## Critères d'acceptation (validation)

- ✅ `POST /api/admin/bulk` supporte `entity=rooms` avec 3 actions
- ✅ `POST /api/admin/bulk` supporte `entity=promotions` avec 3 actions
- ✅ `POST /api/admin/bulk` supporte `action=delete` pour users/properties/reviews
- ✅ `<RowDeleteButton>` opérationnel avec confirm + refresh
- ✅ Les 8 dashboards ont filtres + recherche
- ✅ 5 dashboards (users/properties/reviews/rooms/promotions) ont l'icône corbeille par ligne
- ✅ `npm run smoke` : 91/91
- ✅ Les 6 suites de simulation : 472/472 · 0 KO · 0 WARN cumulés
  (smoke 91 + surface 68 + deep 81 + xtreme 89 + paranoid 74 +
  dashboards 69)
- ✅ `npm run ai:check` : 17 OK · warn · 0 fail
- ✅ `npm test` : 188/188 verts

## Preuve runtime

- 🔨 build : Turbopack compile toutes les nouvelles pages en < 400 ms
- 🧪 tests : `npx vitest run` → 188 passed
- ▶️ smoke : `bash scripts/smoke.sh` → 91/91
- ▶️ dashboards_sim : `python3 scripts/dashboards_sim.py` → 69/69 KO 0
- ▶️ API bulk rooms/promotions activate/deactivate/delete testé sur DB seed
- ▶️ Guards testés : rooms avec booking futur refusé, promotion utilisée refusée
