# Impact — T-015 : endpoints mutations manquants

- **Date** : 2026-08-20 · **Niveau** : **S** · **Ref** : §14

## Quoi
6 nouveaux endpoints qui débloquent les boutons UI orphelins (R15) et
les 5 tables sans endpoint (R14).

| Endpoint | Table impactée | Rôle |
|---|---|---|
| `POST /api/conversations` | conversations | 🔒 user — crée un thread voyageur↔hôte lié à un booking |
| `POST /api/messages` | messages | 🔒 user — envoie un message dans une conversation autorisée |
| `POST /api/reviews/[id]/reply` | reviews | 🔒 host propriétaire — remplit `hostReply` + `hostReplyAt` |
| `POST /api/properties/[id]/validate` | properties | 🔒 admin — passe status `pending`→`active` avec `validatedAt/By` |
| `GET  /api/wishlists/shared/[token]` | wishlists | 🔓 public — lecture d'une wishlist `isPublic:true` par shareToken |
| `POST /api/promotions` `PATCH /api/promotions/[id]` `DELETE /api/promotions/[id]` `GET /api/promotions` | promotions | 🔒 admin |

## Sécurité
- Chaque endpoint vérifie auth + rôle + ownership avant d'écrire.
- `POST /api/messages` : vérifie que l'utilisateur est soit le voyageur
  soit le hôte de la conversation.
- `POST /api/properties/[id]/validate` : admin uniquement.
- `GET /api/wishlists/shared/[token]` : lecture seule, expose uniquement
  le nom + les properties associées (pas le userId propriétaire).

## Tests
- Tests d'intégration pour les 6 endpoints (via appel direct des
  handlers avec DB test).

## Rollback
`git revert` — endpoints disparaissent, tables inchangées.
