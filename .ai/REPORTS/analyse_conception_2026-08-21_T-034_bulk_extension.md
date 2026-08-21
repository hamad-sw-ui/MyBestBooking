# 🧱 Analyse de conception — T-034 (Session 13)

## Objectifs de conception

1. **Rétro-compatibilité totale** : le contrat de POST /api/admin/bulk
   ne change pas de forme (`{ entity, action, requested, succeeded,
   skipped[], failed[] }`). L'`entity` union type gagne 2 valeurs et
   chaque entité peut accepter de nouvelles actions.
2. **Uniformité UX** : les 8 dashboards partagent tous une expérience
   cohérente — champ de recherche (`/`), select statut, badges nombre,
   raccourcis clavier.
3. **Safety-first** : les hard deletes doivent refuser proprement toute
   suppression qui casserait un état métier (booking actif, promotion
   utilisée, admin qui se supprime lui-même).
4. **Réutilisation** : l'icône corbeille par ligne doit être un
   composant unique branché sur l'API bulk (une seule source de vérité).

## Choix techniques

### A. Une seule route API bulk (pas 5 routes DELETE spécialisées)

**Alternative rejetée** : ajouter DELETE `/api/{entity}/[id]` sur
chaque entité manquante. Trop de duplication (RBAC, audit, gestion
d'erreur). Le composant `RowDeleteButton` devrait aussi router
différemment selon l'entité.

**Choix retenu** : conserver `POST /api/admin/bulk` comme point
d'entrée unique. Le RowDeleteButton envoie un batch de 1 élément.
Avantages :
- **RBAC unique** : `admin` requis, une seule vérification à maintenir
- **Audit unique** : chaque delete est loggé comme `bulk.action` avec
  `metadata.operation = "delete"` et `metadata.requested = 1`
- **Idempotence facile** : si l'id n'existe plus, la réponse est
  `skipped` avec raison lisible (pas 404 → erreur pénible côté UI)

### B. Delete = hard sur reviews/properties/rooms/promotions, alias
    anonymize sur users

Les entités où le hard delete a du sens fonctionnel :
- **reviews** : un avis rejeté peut être supprimé (garde le status
  `rejected` inutile en base)
- **properties** : brouillons non validés à nettoyer
- **rooms** : erreur de saisie sur une chambre sans booking
- **promotions** : brouillon de code jamais utilisé

Les entités où le hard delete est **interdit** par RGPD ou intégrité :
- **users** : delete = anonymize (BUG-025). Le user reste dans
  la base pour préserver l'historique bookings/reviews, mais son
  email/nom sont effacés.
- **bookings** : jamais delete — utiliser l'action `cancel` qui garde
  l'historique et respecte la machine à états (BUG-022).

### C. Guards de sécurité pré-delete

| Entité | Refus |
|---|---|
| users | id == adminId (self) → skipped |
| users | role == admin → skipped (protège autres admins) |
| properties | any booking pending/confirmed → skipped |
| rooms | any booking futur (checkOut ≥ today, status ∈ {pending, confirmed}) → skipped |
| promotions | currentUses > 0 → skipped |
| reviews | pas de guard (hard delete OK) |

### D. Nettoyage FK avant hard delete property

Property a beaucoup de FK enfants. Ordre du nettoyage :
1. `roomAvailability` (via rooms)
2. `ratePlans` (via rooms)
3. `rooms`
4. `wishlistItems` (propertyId)
5. `priceAlerts` (propertyId)
6. `reviews` (propertyId)
7. `messages` (via conversations)
8. `conversations` (propertyId)
9. `properties` (final)

**Bookings** sont conservés (statut terminaux) — l'historique
financier ne doit pas disparaître avec la property. La FK
`bookings.propertyId` est nullable en pratique (mais SET NULL n'est
pas configuré → on garde le lien orphelin, la property reste
récupérable via les backups).

### E. Composant RowDeleteButton

Design :
```tsx
<RowDeleteButton
  entity="users"
  id={u.id}
  label="l'utilisateur alice@x.com"
  disabled={isSelf}
/>
```

- Confirm natif avec le `label` humain
- Fetch POST vers `/api/admin/bulk`
- Refresh la page en cas de succès
- Affiche l'erreur (max 180px, aria-alert) si skipped/failed
- `data-testid="row-delete-<entity>-<id>"` pour E2E

### F. Managers Client vs pages Server

Pattern uniforme (déjà établi T-033) :
- `page.tsx` (Server Component) : fait la query DB + map vers un type
  serializable + rend `<Manager rows={...} />`
- `manager.tsx` (Client Component) : filtres useState + rendu

Bénéfice : pas de round-trip serveur pour filtrer la vue, tout est
en mémoire client. Cohérent avec T-033.

## Ce qui n'est PAS fait (hors périmètre T-034)

- Pagination server-side (les datasets restent < 100 lignes dev)
- Export CSV des résultats filtrés (backlog)
- Undo groupé (backlog)
- Navigation j/k dans le tableau (backlog)

## Points de vigilance

1. **BulkToolbar type entity** : le TypeScript force la valeur parmi
   `users | properties | reviews | bookings | rooms | promotions`.
   Ajouter une nouvelle entité = 1 seule ligne à modifier.
2. **routes-map DELETE** : le composant delete existant sur
   `/dashboard/rooms/[id]/route.ts` (soft-delete par `isActive=false`)
   n'est pas modifié. Le RowDeleteButton passe par `/api/admin/bulk`
   qui, lui, fait un hard delete. Deux voies coexistent, chacune avec
   sa sémantique claire (soft = désactiver via UI Cathédrale ; hard =
   corbeille admin bulk).
3. **admin/audit page force-dynamic** : maintenu, car le contenu peut
   changer à chaque refresh (bulk actions loggent de nouvelles entries).

## ADR référencé

Aucun ADR nouveau requis. L'extension respecte les patterns établis
par ADR-004 (client/server split) et ADR-005 (audit log).
