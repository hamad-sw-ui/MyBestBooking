# Analyse de conception — T-206 — Implémentation des remarques de l'audit fonctionnel profond n°31

**Date** : 2026-09-10  
**Niveau** : C — Critique

---

## 1. Objectif

Implémenter les remarques T-206 sans régression : aligner devis et création booking, sécuriser le cycle de vie paiement/fidélité, rendre la publication d'un bien impossible sans hôte approuvé, appliquer réellement le mode maintenance aux mutations, renforcer la robustesse API, aligner recherche/API, améliorer l'UX capacité/messagerie/compte et remettre les harnais QA au contrat actuel.

---

## 2. Problème actuel

L'audit n°31 a montré que plusieurs invariants existent seulement dans certains écrans ou endpoints :

- le devis checkout et `POST /api/bookings` ne produisent pas toujours les mêmes remises ;
- les transitions booking ignorent l'état de paiement ;
- le gate d'approbation hôte est appliqué par `/validate`, mais pas par le `PUT` générique ;
- le mode maintenance protège le chargement des pages, mais pas toutes les mutations API ;
- quelques routes laissent Postgres transformer des UUID invalides en 500 ;
- `/recherche` et `/api/properties` ont divergé ;
- certains boutons/listes restent fonctionnels mais mal pensés (enfants fiche, conversations vides, facture unpaid, suppression compte avec obligations).

Contraintes : pas de migration DB, pas de rupture des contrats JSON existants, conserver T-205 (paiement manuel par défaut, online explicite, quote serveur, wallet, disponibilité réelle, modération, wishlists actives).

---

## 3. Solutions possibles

### Solution A — Correctifs locaux par route

**Principe** : corriger chaque route/composant au plus près du bug.

- Avantages : rapide, faible refactor, peu de surface modifiée.
- Inconvénients : duplication persistante, risque que les divergences reviennent.
- Complexité : faible à moyenne.
- Performance : inchangée.
- Sécurité : améliore les guards mais sans invariant central.
- Maintenabilité : moyenne.

### Solution B — Helpers ciblés et centralisation progressive

**Principe** : créer/renforcer quelques helpers partagés là où le risque de divergence est fort (`future-stay`, `maintenance`, gate active, règles paiement), mais éviter un refactor complet du catalogue ou du booking engine dans ce lot.

- Avantages : équilibre sécurité/temps, limite les régressions, rend les invariants réutilisables.
- Inconvénients : il restera une dette de refactor complet du moteur catalogue si le produit grandit.
- Complexité : moyenne.
- Performance : inchangée ou améliorée (moins de résultats incohérents, pas de gros N+1 ajouté).
- Sécurité : bonne, guards côté serveur.
- Maintenabilité : bonne.

### Solution C — Refactor complet moteur booking/catalogue

**Principe** : extraire un domaine complet `booking-pricing` + `catalog-search`, remplacer les routes par des services partagés, ajouter transactions et tests exhaustifs.

- Avantages : architecture la plus propre à long terme.
- Inconvénients : diff volumineux sur du code T-205 non commit, risque de casser des chemins validés, durée élevée.
- Complexité : élevée.
- Performance : potentiellement meilleure, mais nécessite optimisation SQL.
- Sécurité : excellente si terminé.
- Maintenabilité : excellente après stabilisation, risquée pendant la transition.

---

## 4. Solution retenue

**Solution B — Helpers ciblés et centralisation progressive.**

Raisons :

- le lot est critique mais doit rester livrable et validable ;
- les invariants les plus dangereux seront centralisés (dates futures, gate hôte, paiement avant completion, maintenance) ;
- les contrats T-205 ne seront pas réécrits ;
- les tests ciblés couvriront les cas révélés par l'audit.

---

## 5. Risques

| Risque | Niveau | Mitigation |
|---|---|---|
| Changement de montants booking | Critique | Tests chiffrés quote/POST, ordre de calcul T-205 conservé. |
| Blocage à tort du paiement manuel | Élevé | Autoriser `pending→confirmed` si booking manuel (`paymentIntentId=null`), exiger `markPaidOffline` avant completion. |
| Maintenance trop stricte | Moyen | Bypass admin via `assertNotMaintenance(user)`, auth/admin/cron/webhook non bloqués. |
| Recherche moins permissive | Moyen | Dates passées seulement : le checkout les refusait déjà. |
| Tests serveur-live lents | Moyen | Lancer ciblés d'abord, puis suite complète et simulations. |
| Diffs T-205 mélangés | Moyen | Ne pas reset/checkout, modifications additives uniquement. |

---

## 6. Compatibilité

- **API** : champs existants conservés ; erreurs renforcées (400/409/503) seulement sur demandes invalides ou dangereuses.
- **Données** : aucune migration ; pas de suppression de données existantes.
- **Utilisateurs** : parcours normal de recherche/réservation maintenu ; messages d'erreur plus explicites.
- **Paiement** : paiement manuel par défaut conservé ; online explicite conservé ; completion exige paiement constaté.
- **Performance** : pas de refactor global coûteux ; API catalogue corrige quelques divergences sans casser pagination.

---

## 7. Plan de développement

1. Mettre à jour docs `.ai` (impact/conception/débat) avant code.
2. Corriger F1/F12 dans `POST /api/bookings` : pas de BR invité, discount cumulatif, promo `FOR UPDATE`.
3. Corriger F2 dans `PUT /api/bookings/[id]` + `booking-lifecycle` : conditions paiement pour confirmation/completion.
4. Corriger F3 : gate `requireApprovedHost` dans `PUT /api/properties/[id]` si `status='active'`.
5. Corriger F4/F5 : maintenance et UUID sur routes ciblées.
6. Corriger F6/F7/F8 : dates futures partagées, min dates UI, API catalogue alignée, enfants bornés.
7. Corriger F9/F10/F11 : listes messages sans fils vides + nav admin, obligations avant suppression, document unpaid non facturé.
8. Corriger F13 : `scripts/simulate.py`, `scripts/deep_sim.py`.
9. Ajouter/adapter tests ciblés.
10. Lancer validations complètes.
11. Produire analyse post-correction + validation.

---

## 8. Plan de retour arrière

- Chaque changement est localisé et réversible par fichier.
- Pas de migration : rollback = revert des fichiers modifiés.
- Si une validation complète échoue sur une zone non liée, conserver les correctifs sûrs et documenter l'échec environnemental seulement s'il est prouvé.
- Si le moteur catalogue API introduit une divergence inattendue, revenir au comportement page SSR validé et limiter l'API à la validation stricte des paramètres.
