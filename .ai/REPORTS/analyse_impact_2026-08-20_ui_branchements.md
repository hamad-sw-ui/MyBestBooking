# Impact — T-016 : UI qui branche les endpoints T-015

- **Date** : 2026-08-20 (Session 6) · **Niveau** : **S** · **Ref** : §14

## 1. Quoi
Brancher côté UI ce que T-015 a livré côté API :

1. **Réponse hôte à un avis** (dashboard/reviews) — formulaire client
   `POST /api/reviews/[id]/reply`.
2. **Validation admin d'une property** (dashboard/properties list) —
   boutons approve/reject/suspend → `POST /api/properties/[id]/validate`.
3. **Envoi de message** (voyageur `/messages/[id]` + hôte
   `/dashboard/messages/[id]`) — nouvelle page détail conversation
   avec formulaire d'envoi et polling léger.
4. **Application d'un code promo** dans le tunnel `/reservation` — champ
   texte, appel `GET /api/promotions/apply?code=` (nouveau endpoint),
   affichage discount + total.
5. **Wishlist publique** — nouvelle page `/wishlists/share/[token]`
   qui appelle `GET /api/wishlists/shared/[token]`.
6. **Édition profil** (`/mon-compte`) — formulaire `PATCH /api/users/me`
   (nouveau endpoint) et changement de mot de passe
   `POST /api/auth/change-password` (nouveau).
7. **CRUD promotions** admin (`/dashboard/promotions`) — bouton "Créer",
   modal, POST/PATCH/DELETE.
8. **Suspend user** (admin) — bouton dans `/dashboard/users`,
   `PATCH /api/users/[id]/suspend` (nouveau).
9. **Annulation avec calcul frais** — appliquer `cancellationPolicy`
   dans PUT /api/bookings/[id] + email notif.

## 2. Où
- Nouvelles pages : `/wishlists/share/[token]/page.tsx`,
  `/messages/[id]/page.tsx`, `/dashboard/messages/[id]/page.tsx`,
  `/dashboard/promotions/new/page.tsx`.
- Nouveaux endpoints (mineurs) : `PATCH /api/users/me`,
  `POST /api/auth/change-password`, `PATCH /api/users/[id]/suspend`,
  `GET /api/promotions/apply?code=`.
- Composants client : `HostReplyForm`, `PropertyValidateActions`,
  `MessageComposer`, `PromoCodeInput`, `PromotionForm`.
- Modif : plusieurs pages dashboard (ajout d'actions), page reservation
  (ajout PromoCodeInput), page mon-compte (formulaires branchés),
  API bookings PUT (calcul cancellationFee).

## 3. Pourquoi
Débloque R15 (2 boutons orphelins → 0). Débloque PAR-004 (annulation
avec frais), PAR-005 (wishlist partagée), PAR-006 (messagerie complète),
PAR-010 (édition property déjà OK, upload T-014), PAR-012 (réponse
avis), PAR-020 (validation admin), PAR-021 (code promo au checkout),
PAR-022 (suspension user).

FEATURES.md ✅ passera de ~48 % à ~65 %.

## 4. Appelants
Tous les nouveaux endpoints sont appelés uniquement depuis les nouvelles
UI. Aucune régression sur l'existant.

## 5. Contrat public
Nouveaux endpoints, aucun changement des existants.

## 6. Migration
Aucune. Pas de schéma DB modifié.

## 7. Sécurité
- Chaque nouvel endpoint vérifie auth + rôle + ownership.
- `PATCH /api/users/me` refuse modification email/role/passwordHash.
- Change-password : vieux mdp requis + révocation des autres sessions.
- Suspend user : admin only, ne peut pas se suspendre soi-même.
- Promo apply : anti-brute force via rate-limit léger.

## 8. Test
- Vitest : test unitaire calcul cancellationFee (utilitaire pur).
- Vitest : test intégration promotions apply.
- Manuel ▶️ : parcours entier de chaque UI branchée.

## 9. Rollback
`git revert` — endpoints et UI disparaissent, aucun state persistant.
