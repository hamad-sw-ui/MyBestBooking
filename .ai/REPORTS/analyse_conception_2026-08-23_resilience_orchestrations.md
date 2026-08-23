# Conception — T-107 : orchestration fiable des paiements et opérations différées

## Décisions de conception

### 1. Booking puis intent, jamais le PSP sous transaction

La transaction de réservation valide capacité/prix/promo/wallet, insère une réservation `pending` expirant dans quinze minutes puis relâche les verrous. L’intent est créé après commit avec une clé d’idempotence dérivée de la référence booking. Une mise à jour conditionnelle rattache l’intent au booking. Un cron reprend les bookings pending sans intent avant leur expiration avec la même clé.

Cela remplace l’appel réseau qui prolongeait le verrou sur `rooms` et `users`. En cas de crash après l’acceptation PSP, l’appel répété est sémantiquement le même chez Stripe ; en cas d’échec, le TTL libère le stock/avantages.

### 2. Succès tardif : compensation, pas résurrection

L’inbox ne réactive jamais un booking annulé. Un événement `succeeded` sur un booking annulé passe le paiement à `paid`, initialise un remboursement au montant réellement remboursable et déclenche un appel PSP hors transaction. La clé `late-capture-refund:<booking>` rend la compensation rejouable. Le cron retente les remboursements `pending`; un webhook de refund reste l’autorité de clôture quand il existe.

### 3. Exactly-once pragmatique pour email

Le lease DB garantit un seul worker logique. Pour le dernier saut réseau, l’outbox transmet `eventKey` comme clé d’idempotence : en-tête `Idempotency-Key` Resend et nom déterministe du mailer Console. Le message id fournisseur est tracé dans l’outbox. Une panne après acceptation peut donc être rejouée sans nouvel email chez un fournisseur qui honore cette clé.

### 4. Quote alerte partagé

Un service serveur quote une chambre en appliquant `evaluateBookingRules` et les prix journaliers/stock/bookings. Le cron utilise ce service lorsqu’une alerte contient dates + voyageurs; sans contexte, il conserve le comportement historique "à partir de". La copie UI annonce explicitement le mode choisi.

### 5. UI complètes et déterministes

- recherche : `COUNT(*)`, total de pages et `properties.id` comme tie-breaker ;
- calendrier : pagination de vue par tranches de 90, sauvegarde de toutes les modifications réellement éditées ;
- rate plans : création et édition des champs applicables, aperçu du prix de base, archivage inchangé ;
- votes : suppression explicite et FK cascade de secours.

### 6. Rotation de clé AES-GCM

Le coffre lit d’abord `CREDENTIALS_ENCRYPTION_KEY`, puis optionnellement `CREDENTIALS_ENCRYPTION_KEY_PREVIOUS`. Un endpoint admin explicite réchiffre toutes les valeurs DB avec la clé primaire, après déchiffrement complet. Il ne retourne jamais les secrets, journalise seulement les compteurs et permet de retirer la clé précédente après succès.

## Alternatives rejetées

| Option | Rejet |
|---|---|
| créer l’intent avant transaction | prix/promo/wallet peuvent changer entre quote et lock, et l’intent serait souvent orphelin |
| conserver l’appel PSP sous transaction | principale cause de contention identifiée |
| confirmer un booking expiré si paiement tardif | revient à vendre un inventaire déjà relâché |
| marquer l’email sent avant le provider | perte silencieuse possible |
| simulation de rotation dans l’UI | action décorative et dangereuse sans keyring réel |
| page de calendrier limitée sans navigation | fonctionnalité annoncée mais inexécutable |

## Compatibilité

Les colonnes nouvelles sont nullable ou à défaut sûr. Les bookings historiques n’ayant pas `benefitsReleasedAt` ne sont libérés qu’au cours d’une nouvelle transition pending→cancelled. Les alertes sans contexte continuent de calculer le meilleur prix de base. Les anciens rate plans aux types libres restent éditables. Les variables provider existantes restent le fallback.
