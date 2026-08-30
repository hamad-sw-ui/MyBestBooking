# Addendum d’audit d’exécution — approfondissement post T-107

- **Date** : 2026-08-23
- **Objet** : compléter `audit_execution_deep_post_T107_2026-08-23.md` par des séquences UI → API → DB supplémentaires.
- **Statut** : constats ouverts, aucune correction n’est prétendue dans ce document.

## Méthode et limites de preuve

Base PostgreSQL embarquée fraîche, migrations `0000…0013`, seed, serveur Next local et requêtes HTTP. Les assertions ci-dessous distinguent ce qui est **reproduit** de l’inspection statique. Aucun provider Stripe/Resend/S3 réel ni navigateur Chromium n’a été utilisé.

---

## AUD-108-18 — La page recherche sérialise à nouveau les données privées et peut vendre une combinaison de chambres impossible

**Parcours reproduit** : visiteur anonyme → `/recherche?city=AuditSplit&guests=4&maxPrice=100`.

### Preuve d’exécution

Une fixture active contient :

| Chambre | Capacité | Prix |
|---|---:|---:|
| Grande chère | 4 | 500 EUR |
| Petite économique | 1 | 50 EUR |

Aucune chambre ne satisfait à la fois `guests=4` et `maxPrice=100`. Pourtant
la property est rendue par `/recherche`. Le HTML/RSC public contient aussi :

```text
hostId=<uuid>
commissionRate="15.00"
validatedBy=null
```

### Cause technique

`src/app/(main)/recherche/page.tsx` a trois défauts combinés :

1. `guests`, prix et disponibilité sont portés par des `EXISTS` indépendants :
   chaque critère peut être satisfait par une **autre** room;
2. la carte utilise `MIN(rooms.basePrice)` de toutes les rooms, et peut donc
   afficher le prix de la petite chambre incompatible;
3. la Server Component passe `properties` complet au Client Component
   `PropertyCard` (`Property` Drizzle), qui sérialise les champs privés dans le
   Flight payload même si l’endpoint `/api/properties` les masque.

### Conséquence

C’est simultanément une fuite métier P0 et une promesse tarifaire/fonctionnelle
fausse : le voyageur clique sur 50 EUR pour quatre personnes et obtient un refus
ou un prix 500 EUR au checkout.

### Correction sans régression

- définir un DTO `PublicPropertyCard` minimal et le construire dans **toutes**
  les pages RSC publiques; ne jamais exporter `typeof properties.$inferSelect`
  vers un Client Component public;
- produire un unique prédicat room pour capacité, prix et dates (ou une CTE de
  rooms éligibles), puis agréger seulement ces rooms;
- garder les liens, filtres et tri actuels, mais afficher `minEligiblePrice` et
  une mention « pour les critères sélectionnés »;
- ajouter un test rendu RSC/HTTP qui interdit `hostId`, `commissionRate` et
  `validatedBy`, et un test de fixture deux rooms opposées.

---

## AUD-108-19 — Le checkout invité crée un compte non revendicable avant que la réservation ne soit validée

**Parcours reproduit** : visiteur sans cookie → checkout invité valide, puis
checkout invité avec property inexistante.

### Preuve d’exécution

1. `POST /api/bookings { isGuestBooking: true }` valide retourne `201`, crée un
   user sans password et **n’émet aucun `Set-Cookie`**.
2. Le CTA « Voir mes réservations » renvoie ensuite vers `/connexion` (`307`).
3. `POST /api/auth/register` avec ce même email retourne `400 Un compte existe
   déjà avec cet email`.
4. Une demande invitée vers une property UUID inexistante retourne bien `400
   Hébergement non disponible`, mais le même email est désormais également
   refusé à l’inscription : le compte a été créé avant la validation de la
   property/room/règles.

Un reset mot de passe manuel pourrait être demandé par le voyageur, mais aucun
parcours de confirmation ne l’explique ni ne lui fournit le lien de claim.

### Conséquence

Orphelins de comptes, friction après paiement, impossibilité de réserver une
seconde fois sous le même email sans connaître un mot de passe jamais choisi,
et possibilité de remplir `users` avec des emails invalides via des demandes
refusées. Le rate-limit par nouvel `user.id` devient contournable.

### Correction sans régression

- valider property, room, dates, règles et limite IP **avant** toute création
  de compte invité;
- créer le profil invité dans la transaction de booking seulement après que le
  hold est accepté; traiter proprement la course sur email unique;
- créer un token de revendication court, hashé, à usage unique (réutilisation
  additive de `verification_tokens` avec un purpose dédié ou nouvelle table),
  envoyé dans le mail de confirmation : définition de mot de passe + session +
  accès aux réservations;
- si le produit veut une session immédiate, la créer explicitement comme
  session invité et l’expliquer dans l’UI; ne pas exposer un token brut dans
  une URL de réservation;
- ajouter les scénarios : invalid booking → aucun user, guest réussi → claim,
  second booking même email après claim, concurrence email et rate-limit IP.

---

## AUD-108-20 — Effacer un avis via bulk laisse `averageRating` et `totalReviews` périmés

**Parcours reproduit** : admin → bulk delete d’un avis approuvé.

### Preuve d’exécution

Fixture : property `average_rating=4.0`, `total_reviews=1`, une review approuvée
à 4.0. Après `POST /api/admin/bulk { entity:"reviews", action:"delete" }` :

```text
reviews approuvés réels = 0
properties.average_rating = 4.0
properties.total_reviews = 1
```

Le correctif T-107 supprime bien les votes, mais `bulkReviews(delete)` ne
réutilise pas le recalcul du handler de modération/création.

### Conséquence

Les cartes property, les tris par popularité/notation et les tableaux admin
montrent une note inexistante. C’est une incohérence de données persistante,
non corrigée par un refresh.

### Correction sans régression

Extraire `recomputePropertyReviewAggregate(tx, propertyId)` et l’appeler après
chaque création, modération, suppression bulk et purge property, dans la même
transaction. Le helper doit retourner `0` / `0.0` quand aucun avis approuvé ne
reste. Ajouter un test DB de delete avec vote et agrégat.

---

## AUD-108-21 — Le parseur webhook Stripe ne gère pas la rotation de signature ni une allowlist d’événements

**Constat par inspection** : `StripePaymentProvider.verifyWebhook()` réduit les
paires `Stripe-Signature` dans un objet : plusieurs `v1=` deviennent une seule
valeur, la dernière. Stripe peut envoyer plusieurs signatures pendant une
rotation de secret. De plus, tout événement avec `data.object.id` qui n’est pas
un `refund.*` est traité comme paiement; un type non prévu peut donc remplir
l’inbox avec un état `pending` inutilisable.

### Conséquence

Une rotation Stripe peut rejeter un webhook pourtant authentique, tandis que
les événements hors contrat encombrent `payment_event_inbox` et compliquent les
reprises/supports.

### Correction sans régression

Conserver tous les `v1` et accepter si l’un est égal au HMAC calculé à temps
constant; autoriser explicitement seulement les types payment/refund réellement
consommés; journaliser/ignorer proprement les types inconnus sans les insérer.
Ajouter vecteurs de test multi-signatures, type non autorisé et replay.

---

## AUD-108-22 — Une alerte prix mise à jour hérite de son état de notification d’un ancien séjour

**Constat par inspection** : `price_alerts` impose une unicité
`(user_id, property_id)`. `POST /api/price-alerts` remplace dates, voyageurs,
seuil et devise mais conserve `lastNotifiedPrice`/`lastNotifiedAt`.

### Conséquence

Un voyageur qui change le séjour suivi peut ne recevoir aucune première alerte :
la règle de déduplication compare le nouveau prix à celui du **séjour précédent**.
Inversement, la page favoris ne rend pas explicitement le contexte qui est
écrasé.

### Correction sans régression

Court terme sûr : si seuil/devise/dates/voyageurs changent, remettre les deux
champs `lastNotified*` à `null` et afficher « alerte remplacée ». Moyen terme :
remplacer l’unicité par un identifiant de contexte/version, permettre plusieurs
alertes volontairement nommées et migrer les alertes historiques vers une
valeur legacy. Toute option doit conserver les alertes existantes sans doublon.

---

## AUD-108-23 — Le récapitulatif checkout est présenté comme un total alors qu’il ne quote pas le serveur

**Constat par inspection** : `/reservation` calcule le nombre de nuits avec le
fuseau navigateur, le prix de base room et une TVA fixe à 10 %. Il ignore prix
journalier, stop-sell, BestRewards serveur et l’état réel du promo/wallet. La
réponse `POST /api/bookings` reste autoritaire, mais l’écran affiche « Total »
et « tout inclus » avant cette autorité.

### Conséquence

Écart prix/UX et abandon : le voyageur peut voir un total différent de celui
prélevé ou un tarif affiché pour une date bloquée. Le code serveur est protégé,
mais la promesse interface est trop forte.

### Correction sans régression

À court terme, renommer en « estimation avant vérification » et lier le texte
au fuseau de l’hébergement. À moyen terme, exposer un endpoint de quote serveur
sans effet de bord, réutilisant `evaluateBookingRules`, puis afficher son
explication/prix/expiration. Au commit booking, recalculer malgré tout et
retourner un conflit explicite si le quote a expiré : aucun montant navigateur
ne devient une autorité.

---

## AUD-108-24 — Les intervalles de dates restent non bornés dans les parcours publics et hôte

**Constat par inspection** : `stayNights()` et la recherche SQL par
`generate_series` n’imposent pas de durée maximale. Le calendrier hôte accepte
un GET arbitrairement long et crée un tableau de toutes les dates en mémoire,
même si l’affichage est paginé par 90.

### Conséquence

Un range de plusieurs années peut créer des requêtes SQL coûteuses, une réponse
availability volumineuse et des calculs de prix inutiles. Le risque est plus
fort dans le navigateur mobile et sur une base avec historique volumineux.

### Correction sans régression

Fixer une borne métier explicite (par défaut 365 nuits, configurable plus tard),
valider côté UI/API/recherche/booking/alertes; paginer l’API availability avec
curseur ou fenêtres 90 jours. Les séjours long terme existants doivent rester
consultables; seulement les nouvelles requêtes hors borne reçoivent une erreur
métier explicite.

---

## Priorisation complémentaire

| Priorité | Regroupement recommandé | Raisons |
|---|---|---|
| **P0 / T-108** | AUD-108-01…06 + **18** | données privées dans endpoints et Flight public, publication, finance, 2FA |
| **P1 / T-109** | 08…12 + **19…23** | argent, claim invité, cohérence agrégats, emails, paiement et promesses UI |
| **P2 / T-110** | 13…17 + **24** | intégrité opérationnelle, performance, dette UX/CI |

## Garde-fous communs de remédiation

1. Introduire des helpers domaine communs plutôt que cloner la logique dans les
   routes bulk/individuelles/cron.
2. Ne jamais changer les snapshots booking, références, URLs legacy ou les
   secrets provider existants pendant les corrections.
3. Préférer migration additive + backfill transactionnel + métrique de lignes
   affectées à une réécriture destructive.
4. Ajouter un test négatif pour chaque frontière publique et un scénario runtime
   par correction financière.
5. Garder le mock délimité dev/test et ne déclarer aucun provider réel validé
   sans credentials test.
