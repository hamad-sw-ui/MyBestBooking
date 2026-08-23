# Audit d’exécution post-providers — scénarios incomplets ou mal conçus

**Date :** 2026-08-23
**Contexte :** audit après T-102 (réservation) et T-103 (coffre Stripe/Resend/S3).
**Nature :** analyse ; aucun correctif supplémentaire n’est appliqué par ce rapport.

## 1. Réponse directe : cohérence après configuration provider

### Ce qui est désormais cohérent

| Provider | Chemin réel après sauvegarde admin | Preuve |
|---|---|---|
| Stripe secret/webhook | `getPaymentProvider()` résout le coffre DB puis les env et crée/annule/rembourse les Payment Intents. | 🧪 factory paiement + 🔍 appelants booking, annulation, webhook |
| Stripe publique | le checkout récupère seulement `publishableKey` via `GET /api/providers/stripe`; le navigateur ne reçoit jamais `sk_*`/`whsec_*`. | ▶️ endpoint testé avec override DB, clé publique seule retournée |
| Resend | `getMailer()` résout le coffre DB puis les env ; les routes auth, booking, messages et cron l’attendent. | 🧪 override DB → `ResendMailer` sélectionné |
| S3/R2 | `getUploader()` résout le coffre DB puis les env ; `/api/uploads` attend la factory. | 🔍 code de factory et handler upload |

La configuration est donc **architecturalement branchée** : elle n’est pas décorative. Les variables d’environnement restent un fallback de récupération.

### Ce qui ne peut pas être garanti sans test fournisseur

Une configuration « enregistrée » ne prouve pas que les valeurs sont valides chez Stripe, Resend ou le fournisseur S3. L’interface ne lance pas encore de test réseau contrôlé (création Stripe test intent, envoi mail de test, upload temporaire S3). Il faut donc effectuer un test fournisseur après saisie réelle, en environnement test, avant production.

---

## 2. Méthode d’audit

- PostgreSQL embarqué, migrations et seed exécutés ;
- comptes admin/hôte/voyageur de démonstration ;
- smoke HTTP complet : **91/91** ;
- Vitest avec DB et serveur : **211/211** ;
- build production et typecheck réussis ;
- appels réels admin providers : RBAC 403, écriture chiffrée, métadonnées sans fuite, suppression/fallback, endpoint Stripe public ;
- inspection des parcours restants et des endpoints sans consommateur UI direct.

Playwright navigateur reste indisponible dans le sandbox (Chromium non téléchargeable). Les constats UI sont donc basés sur le rendu HTTP, les composants clients et les appels API ; ils doivent être complétés par une exécution Chromium en CI.

---

## 3. Défauts prioritaires

### A-01 — Stripe confirme la DB mais n’envoie pas les emails de confirmation

**Scénario** : une réservation Stripe commence `pending`. Le webhook `payment_intent.succeeded` passe le booking en `confirmed`/`paid`.

**Problème** : les emails voyageur et hôte ne sont envoyés que dans `POST /api/bookings` pour le provider mock immédiatement réussi. Le webhook ne déclenche aucun mail. En paiement Stripe réel, le voyageur peut être débité et confirmé sans email transactionnel.

**Sources** : `src/app/api/bookings/route.ts` ; `src/app/api/webhooks/stripe/route.ts`.

**Solution sans régression** : extraire `sendBookingConfirmation(booking)` dans un service idempotent, appelé par le mock après insertion et par le webhook après transition `pending → confirmed`. Ajouter `confirmationEmailSentAt` ou une table d’événements pour empêcher un double email aux retries webhook.

**Priorité** : P1 avant activation Stripe production.

### A-02 — Les remboursements Stripe asynchrones ne sont pas réconciliés

**Scénario** : un remboursement peut retourner `pending` chez le PSP.

**Problème** : `refundStatus` est enregistré, mais le webhook ne traite que les événements Payment Intent. Il ne traite pas `refund.updated`/`charge.refunded`; un remboursement pending peut rester indéfiniment pending dans le dashboard.

**Solution** : étendre le provider/webhook à un événement de remboursement, associer un `refundId` persisté et mettre à jour `refundStatus`, `refundedAt`, reporting et notification. Prévoir une tâche de réconciliation provider pour les états anciens.

**Priorité** : P1 financier.

### A-03 — Les pièces jointes messages sont publiquement accessibles

**Scénario** : une pièce jointe est envoyée dans un message privé voyageur/hôte.

**Problème** : l’upload local sert dans `public/uploads/`; S3 est également conçu avec ACL `public-read`. L’URL est aléatoire mais ne requiert pas d’être participant à la conversation. Afficher le lien dans le fil ne crée pas un contrôle d’accès.

**Sources** : `src/app/api/uploads/route.ts`, `src/lib/storage/local.ts`, `src/lib/storage/s3.ts`, `MessageAttachment`.

**Solution** : utiliser un stockage privé ; stocker le `key` plutôt qu’une URL publique ; fournir `GET /api/messages/attachments/[id]` qui vérifie la participation avant de délivrer un lien signé court. Conserver les images publiques de property dans un espace distinct.

**Priorité** : P1 confidentialité/RGPD.

### A-04 — La suppression S3 ne peut pas supprimer les clés générées

**Scénario** : un upload S3 génère une clé `uploads/<uuid>.png`.

**Problème** : `S3Uploader.remove()` refuse toute clé contenant `/` avec la regex `^[A-Za-z0-9._-]+$`. Les clés générées par `put()` contiennent nécessairement `uploads/`. La suppression S3 retourne donc `false` avant même l’appel réseau.

**Solution** : valider des segments sûrs, par exemple `^uploads/[A-Za-z0-9._-]+$`, et vérifier que la clé commence par le préfixe autorisé de l’utilisateur. Ajouter un test `put key → remove key` avec fetch mocké.

**Priorité** : P1 stockage/coût/RGPD.

### A-05 — Rate plans et avantages réservables ne sont pas connectés au checkout

**Scénario** : l’hôte peut créer un rate plan comportant petit-déjeuner, politique d’annulation ou remise.

**Problème** : les endpoints `GET/POST /api/rooms/[id]/rate-plans` existent, mais aucune fiche, recherche ou réservation ne sélectionne/applique un rate plan. Le booking utilise uniquement `rooms.basePrice`; le petit-déjeuner et la politique affichée sont donc parfois des promesses sans effet.

**Solution** : ajouter un choix de rate plan par chambre, propager son identifiant au devis et au booking, figer les conditions/prix au moment de l’achat, puis l’afficher dans confirmation, annulation et dashboard. Ne pas présenter ces avantages avant ce raccordement.

**Priorité** : P1 si rate plans sont montrés aux hôtes comme fonctionnalité active ; sinon P2 avec libellé « préparation ».

---

## 4. Parcours fonctionnels inachevés

### B-01 — Providers : absence de « tester la connexion »

L’admin voit « Configuré » si les champs requis existent. Cela ne vérifie ni validité Stripe, ni domaine Resend, ni permissions/bucket S3.

**Solution** : boutons de test séparés, jamais automatiques :

- Stripe : créer puis annuler un Payment Intent test sans montant réel ;
- Resend : envoyer un email test au seul administrateur connecté ;
- S3 : put/delete d’un objet temporaire privé ;
- afficher un résultat non sensible (HTTP, date, diagnostic court) ;
- journaliser l’action sans logger les secrets.

### B-02 — Recherche prix min/max sémantiquement ambiguë

Dans `/recherche`, les bornes min et max sont validées par deux `EXISTS` indépendants. Une property peut donc passer parce qu’une chambre est au-dessus du minimum et une autre sous le maximum, sans qu’aucune chambre ne soit réellement dans la plage demandée.

**Solution** : une seule sous-requête `EXISTS` imposant simultanément les deux bornes à une même chambre, et ajouter des tests avec deux chambres de prix opposés.

### B-03 — Filtres métier API non exposés à l’utilisateur

L’API properties connaît équipements, voyageurs, proximité, tri et disponibilité. L’UI de recherche n’expose qu’une partie de ces filtres et ne fournit ni pagination utilisateur, ni comptage total stable.

**Solution** : un panneau « filtres avancés » progressif, URL partageable, tri stable, pagination SQL et tests de conservation des critères vers la fiche/checkout.

### B-04 — Bouton « utile » d’avis livré en API seulement

`POST /api/reviews/[id]/helpful` existe, mais aucun bouton visible de fiche avis ne l’appelle. La fonction ne peut pas être utilisée par un voyageur normal.

**Solution** : bouton « Utile » dans la fiche, état optimiste borné, feedback après limite rate-limit et test voyageur connecté/non connecté.

### B-05 — Édition complète de chambre et rate plans absentes de l’interface

Les APIs room PUT et rate plans existent mais le dashboard route principalement vers calendrier/stock. L’hôte ne dispose pas d’un flux clair pour modifier capacité, lits, équipements, prix de base ou plans.

**Solution** : page d’édition room, onglet plans tarifaires et avertissement d’impact sur futurs séjours. Les changements ne doivent jamais réécrire le snapshot d’une réservation existante.

### B-06 — BestRewards présente encore des avantages non exécutables

Cashback et remises sont maintenant calculés, mais les textes marketing promettent aussi petit-déjeuner offert et surclassement. Aucun modèle de réservation, inventaire ou workflow hôte n’enregistre/applique ces avantages.

**Solution** : soit retirer/qualifier ces promesses (« selon disponibilité, à confirmer »), soit stocker les perks attribués par booking et les rendre à l’hôte dans le détail de réservation.

### B-07 — Factures, exports et versements restent des informations non opérationnelles

Le dashboard indique honnêtement que facture légale et calendrier de versement ne sont pas automatisés. Toutefois, un hôte ne peut ni télécharger un export comptable, ni vérifier un payout réel.

**Solution** : ledger financier immuable, export CSV d’abord, puis factures/payouts seulement avec règles fiscales, numérotation et prestataire comptable définis.

### B-08 — Alertes prix : seuil global, pas un prix de séjour daté

Le cron compare le prix minimal actif de base des chambres. Il ne tient pas compte des dates du voyageur, de l’override daily, du stock réel de ses dates ni des changements de devise.

**Solution** : enrichir une alerte avec dates/voyageurs/devise, réutiliser le moteur de devis, notifier le premier prix réellement réservable. Garder le comportement actuel mais le nommer « alerte prix de base » jusqu’à cette évolution.

---

## 5. Plan de correction sans régression

### Phase 1 — Sécurité et argent

1. pièces jointes privées/signed URLs ;
2. suppression S3 corrigée ;
3. webhook confirmation email idempotent ;
4. réconciliation refund Stripe.

### Phase 2 — Cohérence de réservation

1. rate plan sélectionné et snapshot booking ;
2. filtres prix unifiés ;
3. perks BestRewards réellement attribués ou promesses retirées.

### Phase 3 — Produit hôte/voyageur

1. test-connection provider ;
2. rate plan/room UI ;
3. helpful reviews ;
4. pagination/filtres recherche ;
5. ledger/export facturation.

### Garde-fous

- migrations additives ;
- aucun secret dans les logs, tests ou rapports ;
- tests unitaires crypto/provider, tests DB pour booking/rate plan, tests E2E navigateur dès que Chromium est disponible ;
- feature flags pour les changements financiers ;
- contrats JSON existants maintenus jusqu’à migration complète.

## Conclusion

Le coffre provider est utilisable et correctement raccordé aux integrations existantes. Il améliore la capacité de configuration, mais ne remplace pas un test de connexion réel ni une validation fournisseur. Les défauts restants les plus urgents touchent désormais les post-actions financières Stripe, la confidentialité des pièces jointes et l’écart entre rate plans/promesses marketing et le checkout réel.
