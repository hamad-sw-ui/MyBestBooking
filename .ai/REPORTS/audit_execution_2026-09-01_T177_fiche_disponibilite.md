# 🔍 Audit d'exécution — disponibilité réelle sur la fiche hébergement (T-177)

- **Date** : 2026-09-01
- **Méthode** : exécution réelle (PostgreSQL embarqué + dev :3000), campagne
  de réservations API réelles sur 01→04/12/2026 jusqu'à épuisement complet.
- **Périmètre de la passe** : parcours négatifs du moteur de réservation —
  surbooking, paiement reprise, messages d'erreur, état affiché AVANT le
  tunnel.

## 1. Éprouvé sain cette passe (aucune correction requise)

| Scénario exécuté | Verdict |
|---|---|
| 2 réservations chevauchantes sur même chambre | ✅ légitime : `quantity=6` — pas de surbooking |
| Épuisement réel : 6 résas confirmées | 7ᵉ/8ᵉ : **409 « Cette chambre n'est plus disponible pour ces dates »** — garde-fou présent, transactionnel (`FOR UPDATE`) |
| Reprise de paiement d'une résa déjà payée | ✅ 409 « Ce paiement ne peut plus être repris » |
| Validation des champs (nom <2 chars) | ✅ 400 explicite |
| Surbooking déjà impossible en base | ✅ aucune fuite inventaire |

→ Le **moteur de refus est exact**. Le problème est **exclusivement dans
l'affichage d'amont**.

## 2. Problème retenu — fiche muette sur une période épuisée

| Rendu fiche | Dates LIBRES | Dates ÉPUISÉES (6/6) |
|---|---|---|
| Chambre Standard + prix 118,67 €/nuit + **CTA « Réserver » actif** | ✅ | identique ✖ — l'échec n'arrive qu'au POST (409) |

**Cause racine** : `/hebergement/[slug]` ne lisait jamais `checkIn/checkOut`
pour l'occupation réelle — le CTA était permanent. Coût utilisateur : 3-4
clics + formulaire complet avant le refus, alors que l'info existe en base.

## 3. Solution livrée (zéro régression par construction)

- **`src/lib/room-remaining.ts`** (pur, 6 tests) :
  `stayDatesFromPropertyQuery()` (n'agit QUE sur un séjour valide), 
  `remainingRoomInventory()` (plancher 0, défaut quantity=1 cohérent avec
  `evaluateBookingRules`).
- **`/hebergement/[slug]/page.tsx`** : quand le séjour est valide, comptage
  `GROUP BY roomId` des réservations **non annulées** chevauchant le séjour
  — SQL **jumeau de la garde T-157** du POST (mêmes prédicats `ne cancelled
  / lt / gt`). Chambre à 0 → bouton « **Complet pour ces dates** »
  (désactivé) ; sinon rendu inchangé.
- +1 clé i18n `room.soldOut` FR/EN → catalogue **1421** (parité testée).
- **Sans dates** sur la fiche : comportement strictement historique.

## 4. Preuves runtime post-build

épuisé → « Complet pour ces dates » ×1 chambre (les 3 autres restent
réservables — inventaire propre) · dates libres → 4 CTA « Réserver » · sans
dates → 4 CTA, aucun badge · EN → « Sold out on these dates ».
