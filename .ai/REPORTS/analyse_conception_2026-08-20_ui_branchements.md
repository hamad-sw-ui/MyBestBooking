# Conception — T-016

## Approche

Groupée : plutôt qu'une PR par UI, on livre un lot cohérent qui
transforme les endpoints T-015 en parcours utilisateurs vécus.

## Endpoints mineurs à ajouter (nécessaires aux UI)

### PATCH /api/users/me
Body Zod : `{ firstName?, lastName?, phone?, country?, language?, currency?, timezone? }`.
Interdit : `email`, `role`, `passwordHash`. Auth requise.

### POST /api/auth/change-password
Body : `{ oldPassword, newPassword }`. Vérifie oldPassword avec bcrypt.
Hash newPassword. Supprime toutes les autres sessions (garde la courante
en réémettant un token). Rate-limit par user.

### PATCH /api/users/[id]/suspend
Body : `{ suspended: boolean, reason? }`. Admin only. `suspended:true` →
`deletedAt = now`, `false` → `deletedAt = null`. Ne peut pas se
suspendre soi-même.

### GET /api/promotions/apply?code=&amount=
Public (rate-limit 30/h/IP). Retourne :
`{ ok:true, promotion:{code,type,value}, discount:Number, finalTotal:Number }`
ou `{ ok:false, error:"..." }`. Ne modifie rien en DB. La consommation
(`currentUses++`) se fait dans `POST /api/bookings` quand le code est
persisté.

## Composants UI

- `<HostReplyForm reviewId>` — dans dashboard/reviews/page.tsx
- `<PropertyValidateActions propertyId currentStatus>` — dans
  dashboard/properties/page.tsx
- `<MessageComposer conversationId onSent>` — dans les nouvelles pages
  détail conversation
- `<PromoCodeInput onApplied>` — dans reservation/page.tsx
- `<PromotionForm mode="create"|"edit" promotion?>` — dans
  dashboard/promotions/new/page.tsx (modal ou page dédiée)

## Nouvelles pages

- `/wishlists/share/[token]/page.tsx` — RSC public
- `/messages/[id]/page.tsx` — RSC + composant client MessageComposer
- `/dashboard/messages/[id]/page.tsx` — idem côté hôte

## Cancellation policy

Table de calcul :
```
policy         | jours avant checkIn | frais
---------------|---------------------|------
free           | any                 | 0 %
flexible       | ≥ 1                 | 0 %
               | 0                   | 100 %
moderate       | ≥ 5                 | 0 %
               | 1-4                 | 50 %
               | 0                   | 100 %
strict         | ≥ 30                | 0 %
               | 7-29                | 50 %
               | 0-6                 | 100 %
non_refundable | any                 | 100 %
```
Fonction pure `computeCancellationFee(policy, total, daysUntilCheckIn)`.

## Application promo dans POST /api/bookings

Body accepte `promoCode?: string`. Server-side :
1. Récupère promotion par code.
2. Vérifie active + non expirée + `currentUses < maxUses`.
3. Vérifie `total >= minBookingAmount`.
4. Calcule discount selon type/value/maxDiscount.
5. Insère avec `discount` calculé et `total` ajusté.
6. Incrémente `promotions.currentUses` atomiquement.

## Plan

1. 3 endpoints mineurs (users, change-password, suspend, promo apply).
2. Utilitaire `computeCancellationFee` + tests.
3. Modif POST /api/bookings pour accepter promoCode.
4. Modif PUT /api/bookings/[id] pour calculer cancellationFee.
5. 4 composants client.
6. 3 nouvelles pages.
7. Modifs pages existantes.
8. Tests.
9. Commit.
