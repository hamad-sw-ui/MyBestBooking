# 🧠 Conception — T-023 Modération d'avis admin

- **Date** : 2026-08-20 (Session 7, suite)
- **Auteur** : Arena Agent Mode
- **Statut** : conception validée avant implémentation

## Problème

Voir `analyse_impact_2026-08-20_moderation_reviews.md`. La colonne
`reviews.status` existe mais n'est jamais mise à jour après création :
un admin ne peut ni approuver un avis mis en attente, ni masquer un
contenu inapproprié.

## Options considérées

### Option A — endpoint dédié `PATCH /api/reviews/[id]/moderate` — **retenue**

- ➕ symétrique avec `/api/users/[id]/suspend` et
  `/api/properties/[id]/validate` (patrons établis dans le projet).
- ➕ URL explicite, autorisation évidente à auditer.
- ➕ recalcul `averageRating` centralisé dans le handler.

Choix : **Option A**.

### Option B — étendre `PATCH /api/reviews/[id]` avec un champ status

- ➖ ce endpoint n'existe pas ; le créer maintenant risque d'ouvrir
  la porte à des modifications non-modération (ex : voyageur qui
  changerait sa propre note).
- ➖ moins clair pour l'audit.

→ Écartée.

### Option C — colonne booléenne `is_hidden`

- ➖ perd la nuance `pending` (workflow futur : file de modération
  automatisée basée sur signalements) et `rejected` (traçabilité).

→ Écartée.

## Architecture retenue

```
Admin clique "Masquer" ─▶ PATCH /api/reviews/:id/moderate {status:"hidden"}
                              │
                              │ (auth admin + Zod + rate-limit 60/min)
                              ▼
                     transaction :
                       1. UPDATE reviews SET status=$1, updated_at=NOW()
                       2. UPDATE properties SET
                            average_rating = (SELECT AVG(overall_rating) ...
                                              WHERE status='approved'),
                            total_reviews  = (SELECT COUNT(*) ...
                                              WHERE status='approved')
                       (même sous-requête que POST /api/reviews T-007)
                              │
                              ▼
                       JSON { review: { id, status } }
                              │
                              ▼
                     router.refresh() côté client → RSC recharge
```

### Recalcul atomique

Reprend **exactement** le pattern de `POST /api/reviews` (T-007) :

```sql
UPDATE properties SET
  average_rating = COALESCE((
    SELECT ROUND(AVG(overall_rating)::numeric, 1)
    FROM reviews
    WHERE property_id = properties.id AND status = 'approved'
  ), 0),
  total_reviews = COALESCE((
    SELECT COUNT(*)::int FROM reviews
    WHERE property_id = properties.id AND status = 'approved'
  ), 0)
WHERE properties.id = $propertyId;
```

Encapsulée dans une **transaction** pour éviter toute fenêtre où le
statut est changé mais la moyenne pas encore recalculée.

### UI

`<ReviewModerateActions>` : 3 boutons contextuels (afficher/masquer
selon le statut courant), confirmation navigateur, `router.refresh()`
après succès. Badge de statut à côté du titre de l'avis.

## Plan de migration

1. Endpoint + test intégration DB-backed.
2. Composant client.
3. Insertion dans `/dashboard/reviews/page.tsx` (côté admin seulement).
4. Manuel ▶️ des 4 scénarios.
5. Docs `.ai/`.

Aucune migration DB, aucun script de rattrapage.

## Débat multi-rôles §15.2

Non requis à ce niveau S (consensus entre rôles Architecte,
Sécurité, DB — reprend des patterns existants).
