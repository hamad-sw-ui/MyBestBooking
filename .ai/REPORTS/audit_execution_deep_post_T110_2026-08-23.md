# Audit d’exécution approfondi post T-110 — identité, exploitation et vérité produit

- **Date** : 2026-08-23
- **Méthode** : parcours source UI/API/DB, séquences concurrentes et cohérence
  des états persistants. Constats ouverts, non présentés comme corrigés.

## AUD-111-01 — « Rester connecté » promet 30 jours mais le JWT expire toujours à 7 jours (P1)

`createSession(userId, rememberMe)` écrit une session DB à 30 jours quand
`rememberMe=true`, mais `createToken()` impose `.setExpirationTime("7d")` sans
paramètre. Le proxy invalide le JWT après 7 jours, même si la session DB reste
valide jusqu’au 30e jour.

**Conséquence** : déconnexion surprise et état DB/JWT contradictoire.

**Solution** : calculer une durée unique, passée à la fois au JWT, à `sessions.expiresAt`
et au cookie. Le setting `sessionDays` doit soit devenir l’autorité avec bornes,
soit être retiré de l’UI. Tests à 7/30 jours et révocation obligatoire.

## AUD-111-02 — Suppression/anonymisation laisse le facteur TOTP pending en clair (P1)

`DELETE /api/users/me` et bulk anonymize effacent `twoFactorSecret` mais pas
`twoFactorPendingSecret`. Même anonymisé, un facteur provisoire demeure en DB.

**Solution** : effacer les deux champs dans toutes les anonymisations et
suppressions; T-111 doit simultanément chiffrer les secrets TOTP au repos avec
une clé dédiée et rotation versionnée.

## AUD-111-03 — Reporting host/admin non multi-devise et date métier ambiguë (P1)

Analytics additionne les montants de devises différentes et utilise la date de
création booking pour les revenus, tandis que l’occupation utilise les nuits.
Les avis non approuvés entrent aussi dans la note analytics. Le CSV expose une
devise par ligne mais n’est pas un ledger ni une facture.

**Solution** : agrégats par devise puis, seulement si requis, FX daté/audité;
définir si revenu = création, capture, séjour ou payout; n’inclure que paiements
finalisés et avis approved. Séparer explicitement opérationnel, fiscal et
payout.

## AUD-111-04 — Capacités/inventaire éditables sous engagements futurs (P1)

`PUT /api/rooms/[id]` accepte baisse de quantité/capacités sans comparer les
bookings confirmés/pending futurs. Availability peut aussi être réécrite sur des
dates passées et GET n’est pas borné.

**Solution** : verrou room, calculer l’occupation/futurs voyageurs, refuser la
baisse incompatible ou la planifier après le dernier séjour; borner/paginer
availability et journaliser les changements de stock/prix.

## AUD-111-05 — Promesses fidélité/referral/promo incohérentes avec le runtime (P1)

BestRewards public/Mon compte codent seuils, taux et cashback alors que le
backend lit des settings. Referral génère un code mais n’est consommé ni à
l’inscription ni au booking. Les anciens free_night sont désormais refusés mais
restent potentiellement listés comme promotions actives.

**Solution** : projection serveur des settings pour UI; referral idempotent avec
anti-auto-parrainage ou suppression du composant; migration/archivage des
free_night legacy. Aucun avantage ne doit être annoncé avant opération DB
traçable.

## AUD-111-06 — Conversations concurrentes et rétention données (P2)

Conversation fait select-then-insert sans contrainte unique. Deux onglets
peuvent ouvrir plusieurs fils. Booking/messages conservent PII après
anonymisation user sans politique de rétention explicite.

**Solution** : index unique transactionnel `(user, property, booking)` adapté
aux NULL + upsert; registre de rétention par type de donnée, jobs d’anonymisation
retardée et décision légale pour booking fiscal.

## AUD-111-07 — Actions/fonctions décoratives restantes (P2)

Les boutons cœur/partage de header property n’utilisent pas les services
wishlist/share existants. Des switches admin notifications/sécurité restent
interactifs mais non consommés. L’aide est informative/mailto, sans ticket,
priorité ou SLA.

**Solution** : brancher les composants existants, ou retirer les boutons;
remplacer les toggles non actifs par texte d’état; ticketing seulement avec
statut, auteur, historique, accès et délais réellement gérés.

## Priorité

1. **T-111 C/P1** : session JWT, TOTP chiffré/anonymisation, devise/date,
   capacités/inventory et settings runtime.
2. **T-112 S/P2** : referral/BestRewards, conversations, rétention, actions UI,
   support et E2E CI.

Chaque changement doit garder les snapshots, URLs et données historiques,
utiliser migrations additives et être validé en concurrence/rôle/temps.
