# Analyse d'impact — T-156 (audit n°28 : P1 annulation hôte, P2 identité/i18n/devise, P3 hygiène)

**Date :** 2026-08-30 · **Branche :** `arena/01a052ed-mybestbooking`
**Base :** `2cdb852` (T-155 livré) · **Niveau :** S — rapport + analyses
seuls, **aucun code implémenté** à ce stade.

## Ce qui changerait (après validation)

| Finding | Surface touchée | Impact attendu |
|---|---|---|
| **P1 — annulation par l'hôte** | `src/lib/booking-cancellation.ts`, `src/app/api/bookings/[id]/route.ts`, `…/cancellation/route.ts`, `booking-row-actions.tsx` | Le voyageur n'est **plus** pénalisé quand l'hôte/admin annule (fee 0, refund intégral, raisons/emails adaptés) ; bouton hôte « Annuler » redevient fonctionnel. **Cas voyageur strictement inchangé** (grille + frais identiques) |
| **P2 — identité connectée** | `src/app/api/bookings/route.ts`, `reservation/page.tsx` | Confirmations/reçus vers l'identité réelle du compte ; guest mode (anon + `isGuestBooking`) **inchangé** (contrat public intact) |
| **P2 — i18n vague 1** | `src/lib/ui-strings.ts`, fiche propriété, `help-center.tsx` | EN cohérent sur les écrans publics ; FR = texte actuel (fallback) ; aucune chaîne retirée |
| **P2 — devise recherche** | `search-page` formulaire, `search-price-filter.tsx` | Selecteur de devise public ; conversion serveur existante conservée ; défaut plateforme en dernier recours |
| **P3 — hygiène/patch/cohérence** | script `purge-sim-data.ts`, `api/admin/settings/[key]`, un test route | Purge optionnelle (`--dry-run`), PATCH partiel accepté, 400 cohérent |

## Blast radius & régressions contrôlées

- **Base de données** : **aucune migration** ; P1 ne touche que le calcul
  d'annulation (colonnes existantes, valeurs persistées différemment
  uniquement pour les annulations hôte/admin).
- **Contrats API publics** : aucun 2xx nouveau ; 403→200 sur le quote
  (hôte du bien, acteur légitime) ; le PUT annulation garde sa forme
  (le corps client est ignoré pour la raison si hôte/admin).
- **Numérique EUR** : voyageur → inchangé ; hôte/admin → montants de
  remboursement en cohérence avec la politique (0 vs grille).
- **UI** : textes/additifs, aucun retrait ; l'étape 2 de la réservation
  passe en lecture seule **uniquement pour les comptes connectés**.
- **Tests** : ajouts (actor cancel, quote host, auth booking identity,
  settings merge) ; aucun test existant supprimé — validation
  `tsc` + `vitest` + `run_all_sims.py` avant tout commit.

## Risques résiduels

- P1 : réintroduire un moyen pour un hôte d'annuler sans confirmation
  double — le dialogue hôte doit rester explicite (« remboursement
  intégral au voyageur »).
- P2 : le cas « réserver pour un proche » (si retenu) doit envoyer la
  confirmation aux deux destinataires **sans** exposer de données du
  compte au proche.
- i18n : garde-fou en warn (jamais fail) pour ne pas bloquer les cycles.
