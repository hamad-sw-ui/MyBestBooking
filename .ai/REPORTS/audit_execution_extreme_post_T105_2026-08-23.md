# Audit extrême d’exécution — post T-105

**Date :** 2026-08-23
**Méthode :** inspection des 40 pages, 50 routes API, 55 routes build, smoke 91/91 et 215 tests.
**Objet :** défauts de séquence, de crash, de cohérence métier et de promesse utilisateur restant après les corrections précédentes.

## Synthèse

Les parcours de base sont désormais solides. Les défauts restants sont concentrés sur les **effets externes**, les **abandons de flux** et quelques interfaces qui promettent plus que leur backend. Les trois urgences sont : expiration de paiement pending, robustesse de l’outbox, et suppression des uploads attachés.

---

## Critiques / P1

### X-01 — Une réservation Stripe pending peut bloquer le stock indéfiniment

**Scénario** : le client ouvre Stripe Elements, abandonne ou ferme l’onglet après que `POST /api/bookings` a créé un booking `pending`.

**Constat** : les bookings `pending` comptent comme réservations non annulées dans la disponibilité. Aucun `paymentExpiresAt`, aucune tâche d’expiration et aucune annulation provider retardée n’existent.

**Impact** : un inventaire peut être bloqué par des paniers impayés ; la promotion est déjà consommée (`currentUses++`) au moment de la création.

**Solution sans régression** : ajouter `paymentExpiresAt`, créer l’intent après une courte hold ou conserver le booking pending avec expiration (ex. 15 min), cron idempotent qui annule l’intent Stripe, libère le stock et restaure promo/wallet si nécessaire. Afficher le délai dans le checkout.

### X-02 — Webhook Stripe reçu avant commit perdu définitivement

**Scénario** : Stripe envoie `payment_intent.succeeded` juste avant le commit local du booking.

**Constat** : le webhook renvoie actuellement HTTP 200 avec `booking_not_found`. Stripe n’effectue donc pas de retry et le booking peut rester pending alors que le paiement est réussi.

**Solution** : stocker les webhooks entrants dans une inbox avec id event Stripe unique, ou retourner 500/503 temporaire jusqu’à ce que le booking soit visible. Une inbox est préférable : elle traite ensuite les événements hors transaction et conserve l’audit.

### X-03 — Outbox : crash après claim = email bloqué en `sending`

**Scénario** : le processus se termine après passage `pending → sending`, avant succès ou catch.

**Constat** : `deliverPendingEmails()` ne relit que les rows `pending`. Un email marqué `sending` devient définitivement non retryable.

**Solution** : ajouter `claimedAt`, relancer les `sending` plus vieux qu’un lease (par exemple 5 min), limiter attempts, état `failed` final et métrique admin. Utiliser une idempotency key provider quand possible.

### X-04 — Suppression API upload incohérente avec les clés privées

**Scénario** : un utilisateur veut supprimer une pièce jointe non encore envoyée, dont la clé est `uploads/<prefix>-uuid.png`.

**Constat** : `DELETE /api/uploads` rejette la clé via `^[A-Za-z0-9._-]+$`, donc refuse `/`, alors que le contrôle suivant exige justement le préfixe `uploads/<id>-`.

**Impact** : le nettoyage manuel ne marche pas ; seuls le cron ou un accès direct DB peuvent supprimer le fichier.

**Solution** : valider strictement `^uploads/[A-Za-z0-9._-]+$`, puis refuser la suppression d’un upload dont `attachedAt` est renseigné. Ajouter tests upload privé : delete pending OK, delete attached 409.

### X-05 — Attachement message : liaison fichier/message non atomique

**Scénario** : message inséré puis échec avant `uploadObjects.attachedAt`.

**Constat** : la création message et l’update upload sont deux requêtes sans transaction. Le cron peut considérer le fichier orphelin et le supprimer alors que le message le référence.

**Solution** : transaction unique : lock upload pending appartenant à l’utilisateur, créer message, poser `attachedAt`, puis commit. Ajouter FK indirecte ou `messageId` dans `upload_objects` pour rendre l’invariant vérifiable.

---

## P1 — Transparence financière et confiance

### X-06 — Annulation sans devis affiché avant confirmation

Le bouton Annuler affiche seulement « des frais peuvent s’appliquer ». Le client ne voit ni frais, ni montant remboursé, ni statut before-action. Après annulation, `Mes réservations` n’affiche pas clairement `cancellationFee`, `refundAmount`, `refundStatus` ou `refundedAt`.

**Solution** : endpoint GET de devis annulation, modal détaillé, confirmation explicite, puis carte réservation montrant frais/remboursement/statut. Le calcul serveur actuel reste la source de vérité.

### X-07 — Avis annoncé “après vérification” mais publié immédiatement

Le formulaire écrit « Votre avis sera publié après vérification », alors que `POST /api/reviews` crée `status: approved` directement dès que le séjour est terminé.

**Solution** : soit créer en `pending` puis modération admin réelle, soit changer le texte en « Votre avis sera publié immédiatement car votre séjour est vérifié ». Ne pas garder les deux comportements contradictoires.

### X-08 — Messages email hors outbox

Les notifications de message et alertes prix appellent encore le mailer directement. Elles n’héritent pas du retry, de l’idempotence ni de la visibilité `email_outbox` ajoutés aux confirmations booking.

**Solution** : unifier tous les emails transactionnels dans l’outbox, avec event keys : message, price alert, cancellation, confirmation.

---

## P2 — Configuration, recherche et administration

### X-09 — Historique provider peut exposer un diagnostic trop détaillé

`provider_test_logs.message` enregistre actuellement le message d’exception du fournisseur. Certaines erreurs upstream peuvent contenir un endpoint, un identifiant de compte ou un extrait de réponse trop détaillé.

**Solution** : mapper les erreurs en codes stables (`AUTH_FAILED`, `NETWORK`, `BUCKET_DENIED`) et conserver la cause détaillée uniquement dans logs serveur sécurisés, jamais dans le dashboard.

### X-10 — S3 endpoint ambigu

L’UI accepte un champ endpoint libre. `S3Uploader` concatène `https://${endpoint}` : si l’admin saisit déjà `https://…`, l’URL devient invalide.

**Solution** : validation normalisée (hostname sans protocole) ou parser URL avec affichage du format attendu ; test connection doit afficher une erreur de validation locale avant l’appel externe.

### X-11 — Colonnes alertes de séjour non encore reliées

Le schéma contient maintenant `checkIn`, `checkOut`, `numAdults`, `numChildren` pour les alertes, mais l’API/UI ne les acceptent pas encore ; le cron continue à comparer le prix de base.

**Solution** : versionner le payload alert, transmettre dates/voyageurs depuis fiche/checkout, calculer via le moteur de devis et afficher « prix séjour » seulement après activation.

### X-12 — Pagination sans total ni borne finale

La recherche ajoute précédent/suivant mais ne calcule pas le total. Le bouton suivant est déduit de `results.length === 20` et peut mener à une page vide.

**Solution** : requête count avec exactement les mêmes filtres, total et lastPage ; tri secondaire par `properties.id` pour pagination stable.

### X-13 — Calendrier hôte affiche seulement les 90 premiers jours

Le composant dit pouvoir chunker les batchs, mais le rendu fait `dateList.slice(0, 90)`. Une plage de 180 jours ne montre ni n’édite la seconde moitié.

**Solution** : pagination de calendrier par tranches de 90 jours ou navigation mensuelle, avec sauvegarde des changements déjà chargés.

### X-14 — Rate plan archivable mais pas éditable

T-105 ajoute archive/réactivation. Les valeurs d’un plan actif ne peuvent toujours pas être modifiées dans l’UI ; le type est fixé au formulaire `flexible`.

**Solution** : formulaire d’édition, changement explicite de type, preview du prix, et avertissement que seules les réservations futures seront concernées grâce aux snapshots.

---

## P2 — Contenu et opérations

### X-15 — Support “24h/24” sans SLA ni ticketing

La messagerie support est un `mailto:`. Dire que l’équipe est disponible 24h/24 n’est pas vérifiable par le système.

**Solution** : retirer le SLA textuel, afficher les horaires réels, ou créer ticketing/support conversation avec statut et délai annoncé.

### X-16 — Facture légale et payout restent hors produit

CSV opérationnel correct, mais sans ledger fiscal, numérotation, TVA légale, avoir, payout ni rapprochement Stripe. Le texte est honnête, la fonction est néanmoins incomplète pour un hôte professionnel.

**Solution** : cadrage comptable/juridique avant toute “facture”, puis ledger append-only et exports par période.

---

## Plan de remédiation sans régression

1. **Paiement/outbox** : expiration pending, inbox webhook, lease outbox, devis annulation, tous emails outbox.
2. **Fichiers** : transaction message/upload, suppression attached interdite, validation S3 endpoint.
3. **Vérité UI** : statut review, SLA support, alertes prix, calendrier 90 jours.
4. **Administration** : édition rate plans, pagination count, ledger roadmap.

Chaque étape doit être additive, utiliser des migrations, préserver les bookings/messages existants et ajouter tests DB de crash/retry/abandon.
