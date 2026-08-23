# Analyse d’impact — T-102 : remédiation de l’audit runtime

- **Date** : 2026-08-23
- **Niveau** : **C — critique**
- **Justification** : disponibilité transactionnelle, capacité voyageurs, cycle de vie, avis vérifiés, paiement/remboursement, schéma PostgreSQL et données financières sont concernés.
- **Source** : `audit_execution_fonctionnel_2026-08-23.md`.

## Objet

Corriger les défauts observés à l’exécution sans retirer les parcours déjà fonctionnels : recherche, réservation mock de développement, comptes, dashboard, messages, favoris et alertes.

## §14 — analyse complète

### 1. Composants directement concernés

| Domaine | Fichiers observés | Modification prévue |
|---|---|---|
| Création réservation | `src/app/api/bookings/route.ts`, `src/app/(main)/reservation/page.tsx` | règles serveur centralisées, devis, capacité, stock journalier, paiement réellement représenté dans l’UI |
| Cycle de vie | `src/app/api/bookings/[id]/route.ts`, `src/app/api/reviews/route.ts` | droits de transition, avis seulement après séjour, remboursement |
| Disponibilité | `src/app/api/rooms/[id]/availability/route.ts`, `src/app/(main)/recherche/page.tsx`, `src/app/api/properties/route.ts` | stock par nuit et minimum de séjour cohérents |
| Fiche logement | `src/app/(main)/hebergement/[slug]/page.tsx` | URL checkout unifiée et conservation dates/voyageurs |
| Auth/proxy | `src/proxy.ts`, pages connexion/inscription | achat invité accessible ; reprise du `next` interne |
| Paiement | `src/lib/payment/*`, webhook Stripe | remboursement, mock explicitement dev, confirmation différée Stripe |
| Favoris/alertes | `src/app/api/wishlists/route.ts`, `wishlist-actions.tsx`, `price-alerts/*` | publier/partager une liste et job d’alerte idempotent |
| Messagerie | `booking-row-actions.tsx`, `conversations`, pages messages | ouvrir un fil hôte et rendre les pièces jointes/recherche visibles |
| Reporting/fidélité | pages billing/analytics/bestrewards, `users`, `bookings` | ne plus compter une annulation comme revenu ; fidélité à la clôture |
| DB | `src/db/schema.ts`, `drizzle/` | colonnes additives remboursement/fidélité/alerte pour sauvegarder un état idempotent |

### 2. Dépendances indirectes

- `src/app/api/webhooks/stripe/route.ts` doit confirmer une réservation et rester idempotent.
- `src/lib/settings.ts` fournit TVA, règles BestRewards et annulation : les nouveaux services doivent l’utiliser, jamais réintroduire de constantes UI.
- `src/lib/mail/*` est utilisé par réservation, annulation, messages et futur job d’alertes.
- `src/app/dashboard/{billing,analytics,page}.tsx` consomme les montants et statuts booking ; il faut préserver ses DTO tout en corrigeant les agrégats.
- `src/components/availability-calendar.tsx` doit rester compatible avec `availableCount`, `minStay`, `stopSell`.
- `src/app/api/admin/bulk/route.ts` doit continuer à pouvoir archiver/supprimer selon les FK existantes.

### 3. Écrans affectés

Voyageur : recherche, fiche hébergement, réservation, connexion, inscription, réservations, messages, favoris, BestRewards, compte.

Hôte : calendrier de disponibilité, messages, facturation, analytics, réservations.

Administrateur : réglages, analytics, facturation, audit et tâches cron protégées.

### 4. Services et tâches planifiées

- Nouveau point d’entrée cron de prix, protégé par `CRON_SECRET` hors développement et planifiable par `vercel.json`.
- Nouvelle routine de finalisation de séjours : elle peut être invoquée par le même cron afin que `completed` ne soit jamais manipulé par un voyageur.
- Aucun worker long-lived n’est introduit : les tâches sont idempotentes et peuvent être rappelées sans doubler alertes, cashback ou compteurs.

### 5. Contrats publics et compatibilité

- `POST /api/bookings` conserve son corps et sa réponse `booking`; il peut désormais renvoyer `payment.clientSecret`, `payment.requiresConfirmation` et des erreurs métier plus précises.
- Le checkout lit temporairement **les deux** conventions d’URL (`property`/`room` et `propertyId`/`roomId`) pour ne pas casser les liens déjà générés.
- `PUT /api/bookings/:id` devient plus strict : la seule mutation voyageur permise est l’annulation. C’est une correction de sécurité attendue ; les transitions hôte/admin restent explicitement testées.
- `POST /api/conversations`, `POST /api/price-alerts` et les endpoints favoris restent compatibles ; PATCH de wishlist et endpoints cron sont additifs.
- Les migrations n’ajoutent que des colonnes nullable ou avec défauts ; aucune donnée existante n’est supprimée ou renommée.

### 6. Tests existants observés

Commandes exécutées avant modification :

```bash
find src -type f -name '*.test.ts' -o -path 'tests/e2e/*.spec.ts' | sort
sed -n '1,340p' src/app/api/bookings/route.test.ts
npm run typecheck && npm run lint && npm test
```

Couverture existante : règles pures de disponibilité, annulation, promotions/paiement, auth, proxy, bulk/admin et smoke public. Elle ne couvre pas encore le stock quotidien positif inférieur à `rooms.quantity`, la capacité voyageurs, les droits de transition ou le flux Stripe navigateur.

### 7. Tests nouveaux obligatoires

1. Tests purs de règles de réservation : dates, stock par nuit, stop-sell, minStay, adultes/enfants/total.
2. Intégration DB : deux bookings sur stock journalier 1 ; intervalle adjacent ; concurrence ; rollback propre.
3. Tests cycle de vie : voyageur ne peut ni `completed` ni `no_show`, hôte ne clôture pas avant check-out, avis futur refusé.
4. Tests paiement : mock confirme ; Stripe pending ne peut pas être présenté comme payé ; remboursement mock appelle une fois le provider.
5. Tests favori public, conversation depuis réservation, pièce jointe rendue, recherche messages.
6. Test cron : alerte une seule fois pour le même prix, respecte préférence utilisateur, ne notifie pas une alerte inactive.
7. E2E : tous les CTA de réservation, invité, retour post-login et viewport mobile dès que Chromium est disponible.

### 8. Risques et parades

| Risque | Niveau | Parade |
|---|---|---|
| Bloquer involontairement des réservations historiques | Critique | règles seulement sur nouvelles créations ; migrations additives ; jeu DB de régression |
| Dédoubler un cashback/une alerte au retry cron | Critique | marqueurs persistés et transaction/idempotence |
| Transformer une annulation réussie en échec après capture | Critique | remboursement avant état terminal, états explicites, mock et Stripe testés isolément |
| Casser les liens reservation déjà publiés | Élevé | double lecture des paramètres pendant la migration |
| Utiliser des champs carte non conformes PCI | Critique | seuls Stripe Elements voient PAN/CVV ; aucun champ natif de carte côté app |
| Régression mobile / a11y | Moyen | boutons semantic, labels, tests de route et contrôle manuel responsive |
| Cron public | Élevé | secret obligatoire hors dev, réponse 401, plan Vercel sans secret dans Git |

### 9. Composants à revérifier à la fin

- création réservation mock et Stripe pending ;
- annulation, montant remboursé et dashboard après annulation ;
- disponibilité depuis recherche, fiche, checkout et API directe ;
- compte voyageur et BestRewards après séjour terminé ;
- pages favoris/messages, dashboard hôte et admin ;
- migrations sur base vide et base seedée ;
- typecheck, lint, tests unitaires, build, ai:check et smoke HTTP.

## Plan de non-régression

1. Introduire d’abord les fonctions pures et leurs tests, puis les appeler depuis l’API existante.
2. Garder les contrats JSON historiques et étendre, jamais remplacer sans compatibilité.
3. Appliquer la migration sur une DB locale seedée avant le test d’intégration.
4. Activer les détails Stripe seulement quand une clé publique est présente ; le mock reste le chemin de développement testé.
5. Ne marquer aucune correction VALIDÉE avant la chaîne complète et l’analyse post-correction.
