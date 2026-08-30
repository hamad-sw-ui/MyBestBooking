# 📊 Analyse d'impact — T-034 (Session 13)

## Contexte

Extension de T-033 (dashboards bulk). L'utilisateur a exigé après
livraison T-033 :

> « J'espère que chaque interface dashboard nécessitant ces
> fonctionnalités possède ces nouvelles arrangements si non faites
> l'implémentation et passer les testes avec succès. je veux aussi des
> icônes de suppression dans les listes intervenants dans ces
> interfaces. arrêtez vous uniquement si tous les tests passe avec
> succès »

T-033 avait couvert 4/8 dashboards (users, properties, reviews, bookings).
Restaient 4 dashboards sans filtres/bulk :

| Dashboard | État avant T-034 |
|---|---|
| `/dashboard/rooms` | Grille brute sans filtres, ni sélection, ni suppression |
| `/dashboard/promotions` | Table avec boutons Edit/Trash **inertes** (aucun handler) |
| `/dashboard/messages` | Champ recherche visuel non branché |
| `/dashboard/audit` | Table sans filtre par action ni acteur |

## Impact du changement

### Niveau : **S** (extension progressive sans rupture d'API)

- Nouveaux endpoints : **0**
- API modifiée : `POST /api/admin/bulk` — ajout de 2 entités
  (`rooms`, `promotions`) + action `delete` sur users/properties/reviews.
  **Contrat rétro-compatible** (même schéma de réponse).
- Nouvelles pages : **0** (refactor de pages existantes)
- Nouvelles migrations DB : **0**
- Nouveaux composants : **5**
  - `RowDeleteButton` (icône corbeille)
  - `RoomsManager`, `PromotionsManager`, `MessagesManager`, `AuditFilter`
- Pages refactorées : **4** (rooms, promotions, messages, audit → shells server → Manager client)
- Managers étendus : **3** (users, properties, reviews → +RowDeleteButton)

### Risques

| Risque | Mitigation |
|---|---|
| **Hard delete de property casse l'intégrité FK** | Refus si booking actif (pending/confirmed) + nettoyage cascade explicite (rooms, ratePlans, roomAvailability, wishlistItems, priceAlerts, reviews, conversations, messages) |
| **Hard delete de room supprime l'historique** | Refus si booking futur (checkOut >= aujourd'hui) + statut pending/confirmed |
| **Hard delete de promotion perd la comptabilité** | Refus si `currentUses > 0` → l'admin est invité à désactiver plutôt |
| **Icône corbeille cliquée par erreur** | `window.confirm()` natif avec description humaine du sujet |
| **Bulk delete users == hard delete ?** | Non : alias vers `anonymize` (RGPD BUG-025) — l'utilisateur reste visible mais anonymisé |

### Contre-effets

- `RowDeleteButton` déclenche `router.refresh()` en cas de succès →
  la page recharge ses données Server Component.
- Le composant expose `data-testid="row-delete-<entity>-<id>"` pour
  faciliter les tests E2E.
- Les Managers désactivent la case à cocher si l'admin tente de
  se sélectionner lui-même ou un autre admin (users).

## Coût

| Item | Effort |
|---|---|
| Extension route `/api/admin/bulk` | +200 LOC (bulkRooms + bulkPromotions + action delete par entité) |
| `RowDeleteButton` | +115 LOC |
| `RoomsManager` | +305 LOC (grille cards + filtres + bulk) |
| `PromotionsManager` | +345 LOC (table + filtres + bulk) |
| `MessagesManager` | +240 LOC (recherche + filtre lu/non-lu) |
| `AuditFilter` | +230 LOC (recherche + filtres action/entity) |
| Tests unitaires bulk étendus | +6 cas (12 total pour la route bulk) |
| `dashboards_sim.py` étendu | +50 lignes (12bis + 12ter + 12quater) |

## Preuve runtime

- `POST /api/admin/bulk` avec `entity=rooms/promotions` sur DB seed :
  activate/deactivate/delete → 200 avec succeeded=N
- Refus delete room avec booking futur : 200 skipped avec raison
- Refus delete promotion avec `currentUses > 0` : 200 skipped avec raison
- 4 pages dashboard répondent 200 avec présence des filtres
  (Rechercher, Filtrer, Toutes) dans le HTML
- 5 pages avec icône corbeille contiennent `row-delete-<entity>` dans
  le HTML
- Simulation dashboards : **69 assertions OK sur 69** (vs 37/37 pour T-033)
- Cumul 6 suites : **472/472** (vs 440/440 avant T-034)
