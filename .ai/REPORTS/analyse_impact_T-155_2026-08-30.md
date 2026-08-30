# Analyse d'impact — T-155 (audit n°27, remédiation des 9 KO du runner unifié)

**Date :** 2026-08-30 · **Branche :** `arena/01a052ed-mybestbooking`
**Base :** `546f09d` (docs audit n°26) · **Niveau :** S (2 modifications
produit ponctuelles + harnais)

## Changements

1. **`src/app/api/bookings/route.ts`** — code promo inconnu : nouvelle
   `PromoCodeNotFoundError` + catch dédié → **400** (avant : catch
   `BookingRuleError` → 409).
2. **`src/app/(main)/recherche/page.tsx`** — filtre `?amenity=` : `OR
   EXISTS (SELECT 1 FROM rooms …)` en plus du match `properties.amenities`.
3. **Gharnais** — `scripts/{smoke.sh,simulate.py,paranoid_sim.py,deep_sim.py,xtreme_sim.py,run_all_sims.py}`
   (resynchronisation des contrats + robustesse timeouts/retry).

## Blast radius

| Surface | Impact | Justification |
|---|---|---|
| `POST /api/bookings` | Statut d'erreur d'un **seul** cas (code promo inconnu) : 409 → 400 ; message identique | Ajout d'une classe d'erreur dédiée, catch avant celui des conflits d'état ; les autres règles (expiré, épuisé, conditions, wallet) restent **409** |
| `GET /recherche?amenity=` | Élargit le match aux chambres ; résultats **supérieurs ou égaux** pour chaque amenity | Sémantique « la propriété propose cet équipement » inchangée ; `pool` (amenity propriété) : mêmes résultats avant/après ; l'éligibilité finale et les bornes de prix restent calculées sur les chambres éligibles |
| Contrats API publics | **Aucun** changement de statut 2xx, de schéma de réponse ni de champ | Ajout(s) strictement additif(s)/comportement d'erreur seul |
| Base de données | **Aucune migration** | Aucune colonne/table touchée |
| Numérique EUR | **Inchangé** | Pas de calcul modifié ; seul le statut d'échec d'un code inexistant change, et le filtre amenities n'affecte pas les montants |
| UI | Aucun changement de composant | Recherche : plus de résultats correctement affichés (tv/minibar), formulaire inchangé |

## Risques résiduels

- **Rate-limit booking en mémoire (10/h)** : documenté ; le runner
  redémarre Next entre les simulations (harness, pas produit).
- **Requête `OR EXISTS`** : index `rooms(property_id)` déjà présent (FK) ;
  surcharge négligeable au volume actuel ; pas de changement de plan pour
  les autres filtres.

## Régressions vérifiées

- 🔨 `tsc --noEmit` : 0 erreur.
- 🧪 vitest : **372/372** (52 fichiers).
- ▶️ `run_all_sims.py` : **396 OK · 3 WARN · 0 KO** (smoke 94 · surface 68 ·
  deep 80 · xtreme 83 · paranoid 71).
- ▶️ curl : promo `NOPE277` → 400 ; `?amenity=tv|minibar` → 8 propriétés ;
  `?amenity=zzz` → 0 ; `?amenity=pool` inchangé.

## Rollback

- Produit : revert des 2 hunks (`git revert 5261ea8` sur les fichiers
  `src/…` uniquement) — aucun impact de données, aucune migration à
  inverser.
- Harnais : retour aux scripts d'origine sans impact serveur.
