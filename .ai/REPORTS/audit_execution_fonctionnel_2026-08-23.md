# Audit d’exécution — parcours, pages et éléments fonctionnels

**Date :** 2026-08-23
**Portée :** plateforme MyBestBooking à l’exécution, avec comptes de démonstration et PostgreSQL embarqué.
**Nature :** analyse et plan de correction ; aucune fonctionnalité métier n’a été modifiée dans cet audit.

## 1. Verdict

L’application est correctement structurée, plusieurs écrans chargent et les contrôles d’accès de base répondent. En revanche, elle **ne doit pas être présentée comme prête à traiter des réservations ou des paiements réels**. Le tunnel de réservation comporte des incohérences critiques entre l’interface, la disponibilité, le paiement et le cycle de vie d’une réservation.

Les problèmes les plus urgents sont :

1. une chambre peut être réservée au-delà du stock journalier, sous sa durée minimale, et au-delà de sa capacité voyageurs ;
2. un client peut faire passer lui-même une réservation future de `confirmed` à `completed`, puis déposer un avis « vérifié » ;
3. l’interface annonce un paiement et une confirmation alors qu’aucun paiement Stripe côté navigateur n’est réalisé ;
4. le principal CTA de la fiche hébergement mène vers un tunnel vide à cause de paramètres d’URL incompatibles ;
5. annulations, fidélité, facturation et statistiques ne reposent pas sur un véritable grand livre de paiement/remboursement.

Le correctif doit donc commencer par les **invariants serveur** et seulement ensuite améliorer les écrans. Corriger uniquement les boutons masquerait les symptômes sans empêcher les régressions métier.

---

## 2. Méthode et niveau de preuve

### Environnement exécuté

- `npm ci`, PostgreSQL embarqué, `npm run db:push`, puis `POST /api/seed` ;
- Next.js lancé en développement avec un `JWT_SECRET` local de test ;
- comptes seedés utilisés pour les rôles voyageur, hébergeur et administrateur ;
- données de test créées pendant les essais ensuite retirées de la base locale.

### Contrôles réussis

| Contrôle | Résultat |
|---|---:|
| `npm run typecheck` | ✅ succès |
| `npm run lint` | ✅ 0 erreur ; 16 avertissements (principalement `<img>` et directives ESLint inutiles) |
| `npm test` | ✅ 188/188 tests, 24 fichiers |
| Pages publiques testées HTTP | ✅ 12 pages en `200` |
| Pages voyageur protégées sans session | ✅ redirection `307` vers connexion |
| Pages voyageur avec session | ✅ `200` sur compte, réservations, favoris, messages, réservation valide |
| Dashboard hôte | ✅ `200` sur les 8 pages essentielles testées |
| Dashboard administrateur | ✅ `200` sur les 7 pages essentielles testées |

Les tests Playwright navigateur existants n’ont pas pu être rejoués dans ce sandbox : le téléchargement Chromium a été interrompu par une réinitialisation TLS du réseau. Il ne s’agit pas d’un échec applicatif. Les preuves ci-dessous combinent néanmoins appels HTTP réels, appels API authentifiés et lecture des flux réellement exécutés.

---

## 3. Anomalies critiques — à corriger avant une mise en production

### C-01 — Stock journalier et durée minimale ignorés : risque de sur-réservation

**Scénario observé**

Un hébergeur règle pour une chambre :

- stock journalier : **1 unité** les 10 et 11 novembre 2027 ;
- `minStay` : **3 nuits** ;
- `stopSell` : `false`.

Deux réservations indépendantes de **2 nuits** pour ces mêmes dates ont toutes deux reçu `201 Created` et le statut `confirmed`.

**Pourquoi cela arrive**

Dans `src/app/api/bookings/route.ts` :

- la transaction refuse seulement un jour `stopSell` ou avec `availableCount === 0` (lignes 344–359) ;
- la capacité est ensuite comparée à `rooms.quantity` (lignes 361–376), pas au stock journalier configuré par l’hôte ;
- `minStay` n’est jamais vérifié ;
- la recherche (`src/app/(main)/recherche/page.tsx`) et l’API de recherche utilisent la même approximation : elles considèrent le stock de chambre et `stopSell`, sans décrémenter/recalculer le stock par nuit.

**Impact**

- overbooking malgré un calendrier hôte configuré ;
- ventes sous la durée minimale ;
- perte de confiance, litiges et charge support ;
- l’écran hôte donne une impression de contrôle qui n’existe pas réellement.

**Correction sûre**

1. Créer un service serveur unique, par exemple `quoteAvailability(roomId, stay, guests, tx)`, utilisé par : recherche, fiche, devis de checkout et création de réservation.
2. Pour chaque nuit de l’intervalle semi-ouvert `[checkIn, checkOut)`, calculer :
   - capacité de base `rooms.quantity` lorsqu’il n’y a pas d’override ;
   - sinon `room_availability.availableCount` ;
   - unités déjà engagées sur cette nuit ;
   - fermeture `stopSell` ;
   - règle de durée minimale (à appliquer au jour d’arrivée ou à la règle métier documentée).
3. Garder le verrou `FOR UPDATE` sur `rooms`, mais valider ensuite le **minimum disponible sur toutes les nuits**, dans la même transaction.
4. Ne modifier ni le contrat de création de réservation ni les réservations historiques ; le comportement sans override doit conserver l’actuelle capacité `rooms.quantity`.

**Tests de non-régression requis**

- 1 unité par jour → premier achat accepté, second refusé ;
- quantité 3 sans override → 3 achats concurrents acceptés, 4e refusé ;
- `stopSell`, `availableCount=0`, changement de stock et intervalle adjacent ;
- séjour inférieur au `minStay` refusé, séjour à la limite accepté ;
- recherche, CTA de fiche et POST final donnent le même résultat.

---

### C-02 — La capacité voyageurs de la chambre n’est jamais imposée

**Scénario observé**

Une chambre de démonstration avec `maxOccupancy: 2`, `maxAdults: 2`, `maxChildren: 0` a accepté une demande de **6 adultes + 4 enfants** et a créé une réservation confirmée.

**Cause**

- le checkout propose systématiquement jusqu’à 6 adultes et 4 enfants (`src/app/(main)/reservation/page.tsx`, lignes 270–287) ;
- le schéma de `POST /api/bookings` n’impose que `numAdults >= 1` et `numChildren >= 0` ;
- après lecture de la chambre, aucune comparaison avec `maxOccupancy`, `maxAdults` et `maxChildren` n’est faite.

**Impact**

Une réservation facturée peut devenir physiquement impossible à honorer. La validation front-end ne serait de toute façon pas suffisante : l’API doit être l’autorité métier.

**Correction sûre**

- Ajouter une validation serveur après chargement de la chambre : adultes, enfants, total, et éventuellement une règle bébé/lit supplémentaire si elle existe ;
- faire dériver les options du formulaire depuis la chambre sélectionnée au lieu de valeurs fixes ;
- afficher une explication claire (« cette chambre accepte au maximum 2 personnes ») sans éliminer les autres chambres potentiellement compatibles.

**Tests requis** : limites exactes acceptées ; dépassement adulte/enfant/total refusé en API ; même résultat via les quatre entrées de réservation.

---

### C-03 — Un voyageur peut déclarer son séjour terminé et publier un avis vérifié avant son arrivée

**Scénario observé**

Avec un cookie voyageur, une réservation future `confirmed` a pu recevoir `PUT /api/bookings/:id { "status": "completed" }` et la réponse a confirmé le changement de statut.

**Cause**

`src/app/api/bookings/[id]/route.ts` vérifie seulement que l’appelant est propriétaire, hôte ou administrateur (lignes 119–129). La machine d’états valide ensuite la transition `confirmed → completed` sans imposer d’acteur ni de date (lignes 131–160).

Or `POST /api/reviews` :

- ne demande que le statut `completed` ;
- crée l’avis directement avec `isVerified: true` et `status: "approved"` (`src/app/api/reviews/route.ts`, lignes 135–174).

**Impact**

- avis fabriqués avant le séjour ;
- notes et classement du logement altérés ;
- atteinte directe à la promesse « avis vérifiés ».

**Correction sûre**

- Définir les droits de transition par rôle, pas seulement par état :
  - voyageur : seulement demander une annulation selon la politique ;
  - hôte : peut signaler no-show ou demander la clôture ;
  - système planifié : passe à `completed` seulement après `checkOut` ;
  - admin : exception explicite et journalisée.
- Autoriser l’avis seulement quand `checkOut` est passé **et** que la clôture est légitime.
- Créer les avis en `pending` si une modération est réellement attendue ; sinon retirer cette promesse et conserver un mécanisme anti-fraude cohérent.
- Ne pas casser l’actuel bouton « Annuler » : son contrat reste un `PUT status=cancelled`, mais les autres transitions seront refusées pour un voyageur.

---

### C-04 — Le paiement réel n’est pas branché au tunnel mais l’UI affirme l’inverse

**Scénario**

Le checkout affiche carte bancaire, PayPal, Apple Pay et paiement à l’hôtel. Il affiche ensuite : « C’est confirmé ! » et « Total payé » après tout `201` de `/api/bookings`.

**Causes précises**

- Les champs carte sont de simples `Input` sans état et ne sont jamais envoyés ni confirmés (`reservation/page.tsx`, lignes 439–447). C’est préférable pour la sécurité PCI, mais cela prouve qu’ils ne réalisent pas un paiement.
- Le choix `paymentMethod` n’est pas envoyé par le client ; l’API enregistre toujours `paymentMethod: "card"` (`api/bookings/route.ts`, ligne 421).
- Le serveur renvoie un `clientSecret` Stripe pour un intent en attente, mais l’interface ne l’utilise jamais avec Stripe.js/Payment Element.
- Avec Stripe, une réservation peut donc être `pending`, alors que le client reçoit quand même l’écran vert de confirmation ; les méthodes PayPal, Apple Pay et hôtel sont uniquement visuelles.
- Sans clés Stripe, le `MockPaymentProvider` déclare un paiement réussi immédiatement. Ce comportement est utile en développement, pas en production.

**Impact**

Risque de confirmation non payée, de conflit de réservation, d’affirmations de paiement trompeuses et de comptabilité incorrecte.

**Correction sûre**

1. Séparer les états : **devis**, **réservation en attente de paiement**, **paiement confirmé**, **échec/expiration**.
2. Pour la carte, intégrer le composant officiel du PSP (Stripe Payment Element ou équivalent) et ne jamais faire transiter PAN/CVV par l’application.
3. N’afficher « confirmé » qu’après webhook signé ou vérification serveur de l’intent. Sinon afficher « paiement en attente » avec reprise sécurisée.
4. N’afficher/activer une méthode que si son provider est réellement configuré ; implémenter séparément le paiement à l’hôtel avec ses propres règles.
5. Rendre le mock explicite et impossible en production (échec de configuration ou bannière de démo non ambiguë).

**Non-régression** : conserver l’API actuelle de réservation en compatibilité transitoire, ajouter des états/colonnes de paiement de manière additive et protéger le nouveau checkout sous feature flag jusqu’aux tests webhook.

---

### C-05 — Annulation sans remboursement, alors que les comptes restent « payés »

**Scénario**

L’action voyageur « Annuler » exécute directement `PUT /api/bookings/:id` avec `status: cancelled`. L’API calcule bien un `cancellationFee`, mais :

- ne crée aucun remboursement PSP ;
- ne modifie pas `paymentStatus: "paid"` ;
- ne crédite pas le wallet ;
- ne présente pas au voyageur le montant de frais/remboursement avant confirmation.

Les écrans de facturation sélectionnent les réservations `paymentStatus = paid`, ce qui inclut donc des réservations annulées (`src/app/dashboard/billing/page.tsx`, lignes 32–41). Les totaux sont faux dès qu’une annulation a lieu.

**Correction sûre**

- Ajouter un **devis d’annulation** en lecture seule : frais, montant à rembourser, canal et délais ;
- confirmer l’annulation dans une transaction idempotente ;
- déclencher ou enregistrer le remboursement PSP, avec états `refund_pending`, `refunded`, `refund_failed` ;
- alimenter facturation et revenus depuis un journal financier (capture, frais, remboursement), pas depuis le simple statut de réservation ;
- adapter la fidélité selon la politique d’acquisition (par exemple après séjour terminé, pas à l’achat).

---

## 4. Parcours inachevés ou incohérents

### P-01 — CTA « Voir les disponibilités » de la fiche : tunnel cassé

**Preuve d’exécution**

La fiche logement contient deux conventions différentes :

- les boutons par chambre produisent `/reservation?property=…&room=…` ;
- le CTA latéral « Voir les disponibilités » produit `/reservation?propertyId=…&roomId=…`.

Le checkout lit seulement `property` et `room` (`reservation/page.tsx`, lignes 42–44). Le CTA latéral a donc retourné la page : **« Informations de réservation manquantes »** lors de l’essai réel.

Les champs arrivée, départ et voyageurs du même bloc latéral n’ont ni état ni soumission ; leurs valeurs sont donc ignorées même après correction des paramètres.

**Solution**

- Centraliser la construction d’URL dans une fonction typée, par exemple `buildReservationUrl({ propertyId, roomId, checkIn, checkOut, adults, children })` ;
- choisir une seule convention (`property`/`room` ou `propertyId`/`roomId`) et accepter temporairement l’ancienne côté lecture pour les liens déjà diffusés ;
- transmettre les dates et voyageurs de la recherche à la fiche puis au checkout ;
- désactiver/guider le CTA si aucune chambre n’est disponible pour les dates demandées.

Ajouter un test E2E qui clique **chacun** des CTA de fiche et vérifie la préservation des paramètres.

### P-02 — Le « mode invité » est implémenté en API mais inaccessible dans le navigateur

L’API accepte bien une réservation sans session avec `isGuestBooking: true` (test réel : `201 Created`). Pourtant `src/proxy.ts` protège `/reservation/:path*` et redirige tout visiteur non connecté vers `/connexion`. Le composant checkout affiche donc une logique « mode invité » qui ne peut jamais être atteinte depuis l’UI.

**Décision produit nécessaire**

- soit le produit autorise réellement l’achat invité : retirer seulement `/reservation` du matcher proxy, s’appuyer sur la validation serveur déjà présente, et proposer connexion/création de compte facultatives ;
- soit le produit exige un compte : supprimer le mode invité de l’API et de l’interface afin de ne pas maintenir deux promesses contradictoires.

La première option préserve la fonctionnalité API existante et devrait être préférée si l’objectif commercial est de réduire l’abandon de panier.

### P-03 — Le prix présenté au checkout n’est pas un devis serveur fiable

Le client calcule localement `prix de base × nuits + 10 %` (`reservation/page.tsx`, lignes 76–86). Il ne reflète pas nécessairement : prix journalier override, règles de séjour, taux de taxe administrable, BestRewards, wallet ou promotion finalement acceptée par le serveur. Le récapitulatif masque aussi la ligne wallet lorsqu’aucun code promo n’est appliqué.

**Solution** : créer un endpoint de devis serveur réutilisant exactement le moteur de disponibilité et de tarification. Chaque modification de dates, voyageurs, promotion ou wallet recharge ce devis. La création de réservation doit recalculer le même devis dans sa transaction, jamais faire confiance au total navigateur.

### P-04 — Contacter l’hôte et messagerie interne : parcours non relié

Le modèle API de conversation existe, mais le voyageur n’a pas de point d’entrée qui crée/ouvre une conversation :

- le bouton « Contacter » de réservation est un `mailto:` ;
- `Mes réservations` lui passe systématiquement `hostContactEmail={null}` ; le fallback envoie donc vers le support, pas vers l’hôte (`booking-row-actions.tsx`, lignes 77–85) ;
- aucune action visible n’appelle `POST /api/conversations`.

De plus, une pièce jointe est uploadée et enregistrée dans `attachmentUrl`, mais les pages de conversation n’affichent que `message.content`, pas le lien/image attaché. La recherche de messages affichée dans la liste est également un simple champ sans filtre.

**Solution**

- remplacer « Contacter » par « Écrire à l’hôte » : créer/récupérer la conversation `(voyageur, propriété, réservation)` puis rediriger vers son fil ;
- conserver le mailto support uniquement pour le support ;
- afficher les pièces jointes avec un lien contrôlé, aperçu image et autorisation participant ;
- rendre le filtre de messages client réellement opérant ou le retirer.

### P-05 — Favoris partagés et alertes prix : données présentes, capacité utilisateur incomplète

- L’ajout par cœur crée automatiquement une liste privée `Mes favoris`.
- L’API sait créer une liste publique et une page publique existe.
- Mais il n’existe aucun écran pour créer une liste nommée, la rendre publique, générer/rotater/révoquer le jeton : le bouton Partager n’apparaît donc jamais pour la liste créée normalement.
- Les alertes enregistrent un seuil, mais aucun job/cron ne compare les prix et n’envoie d’email, alors que l’écran promet une notification « dès qu’une bonne affaire se présente ».

**Solution**

- ajouter une gestion de listes (création, visiblité, rotation/révocation du lien), avec un `PATCH` dédié qui vérifie la propriété de la liste ;
- conserver les endpoints `GET/POST/DELETE` actuels et ajouter le nouveau contrat de façon additive ;
- avant l’implémentation du job, renommer le feedback en « seuil enregistré » ; ensuite ajouter une tâche idempotente avec prix observé, date de dernière notification et préférence `priceAlertEnabled` réellement utilisée.

### P-06 — Réponse hôte à un avis enregistrée mais jamais visible sur la fiche

`POST /api/reviews/[id]/reply` stocke correctement `hostReply` et `hostReplyAt`. La fiche logement n’affiche cependant que les commentaires positif/négatif du voyageur : la réponse de l’hôte n’est jamais rendue.

**Solution** : afficher, sous l’avis concerné, un bloc daté « Réponse de l’hébergement », en ne montrant que les avis publiés. Ajouter le scénario hôte répond → visiteur voit la réponse.

### P-07 — Vérification d’email : promesse et contrôle ne concordent pas

La page de vérification annonce « Vous pouvez désormais réserver », mais la création de réservation n’impose pas `emailVerified`. Il faut choisir une règle métier :

- soit la vérification est requise (alors l’API doit refuser la réservation ou la confirmation, avec renvoi d’un lien) ;
- soit elle est informative (alors retirer la formulation qui la présente comme une condition de réservation).

---

## 5. Règles métier et informations de gestion incohérentes

### G-01 — BestRewards compte les achats au mauvais moment et promet des avantages non exécutés

- Les FAQ annoncent une réduction Level 1, mais le serveur n’accorde une remise qu’aux niveaux 2 et 3.
- Le compteur BestRewards est incrémenté juste après la création de réservation, y compris si le paiement échoue, si le séjour est annulé ou s’il n’a pas eu lieu (`api/bookings/route.ts`, lignes 448–468).
- Aucun code ne crédite le cashback Level 3 annoncé ni ne réalise les avantages hôtelier (petit-déjeuner, surclassement).

**Solution** : définir une source de vérité « événements de fidélité » : créditer après paiement confirmé puis, idéalement, après séjour effectué ; traiter annulation/remboursement explicitement ; rendre la FAQ depuis les réglages réellement appliqués. Masquer les avantages non implémentés au lieu de les vendre.

### G-02 — Facturation et analytics mélangent données réelles et données simulées

- `dashboard/billing` génère des factures en mémoire à partir des mois de réservation ; elles ne sont ni numérotées légalement, ni archivées, ni téléchargeables. Le code les qualifie explicitement de mock.
- Les sources de réservation sont fabriquées à 60 % web, 30 % mobile, 10 % partenaires (`dashboard/analytics/page.tsx`, lignes 133–138), sans donnée de source stockée.
- L’occupation est calculée depuis les réservations **créées** dans les 30 jours, pas depuis les nuits réellement occupées sur les 30 jours ; les tops peuvent inclure des réservations annulées.
- Les réservations annulées mais encore `paid` polluent les revenus/factures.

**Solution** :

1. nommer clairement ces blocs « aperçu estimatif » ou les masquer tant que les données n’existent pas ;
2. enregistrer une vraie origine de réservation à la création ;
3. calculer occupation et revenu par nuit de séjour, avec exclusion/traitement explicite des annulations et remboursements ;
4. générer les factures à partir d’un journal financier immuable, avec stockage et export serveur.

---

## 6. Défauts UX et dette fonctionnelle à planifier

| Priorité | Élément | Problème | Correction non destructive |
|---|---|---|---|
| P1 | Redirection après connexion/inscription | Le paramètre `next` posé par le proxy est ignoré : après connexion, le voyageur retourne à `/`, pas à sa page demandée. | Lire `next`, n’accepter que les chemins relatifs internes, puis fallback rôle actuel. |
| P1 | Navigation mobile authentifiée | Le menu mobile connecté ne contient ni compte, ni réservations, ni favoris, ni messages, ni déconnexion. | Réutiliser les actions du menu desktop dans le panneau mobile ; tests viewport mobile. |
| P1 | Recherche → fiche → chambre | Les dates/voyageurs de recherche ne sont pas conservés ; la fiche affiche des chambres sans disponibilité contextualisée. | Propager une requête de séjour typée et calculer la disponibilité par chambre côté serveur. |
| P2 | Recherche logement | Filtres UI limités, pas de tri/pagination, et filtres prix min/max évalués séparément sur des chambres possiblement différentes. | Unifier la recherche UI avec l’API, filtrer une même chambre dans la plage, ajouter pagination/total. |
| P2 | Devise | `PropertyCard` écrit `Dès €…` même si une chambre est dans une autre devise. | Porter la devise dans le DTO et utiliser `formatPrice`. |
| P2 | Performance visuelle | Plusieurs pages critiques utilisent `<img>` natif ; lint le signale. | Migrer progressivement vers `next/image`, en gardant les domaines déjà autorisés et tests LCP/affichage. |
| P2 | Pages dashboard mobile | Tableaux et gestion bulk ont peu de stratégie mobile. | Préserver le tableau desktop mais fournir des cartes/actions groupées sur petit écran. |

---

## 7. Plan de remédiation sans régression

### Phase 0 — Geler les promesses risquées

- Ne pas activer Stripe/PayPal réel avant C-01 à C-05.
- Remplacer les libellés trompeurs : « confirmé/payé », alertes email, factures et avantages BestRewards non livrés.
- Masquer les modes de paiement indisponibles plutôt que les laisser sélectionnables.

### Phase 1 — Intégrité de réservation (priorité absolue)

1. Extraire des services testables : `availability`, `pricingQuote`, `bookingTransition`.
2. Imposer stock journalier, durée minimale et capacité voyageurs dans la transaction serveur.
3. Restreindre les transitions par rôle/date et protéger les avis.
4. Ajouter une suite d’intégration DB avec concurrence sur une chambre.

**Critère de sortie** : aucun appel API, y compris via DevTools, ne peut créer une réservation impossible ni publier un avis avant séjour.

### Phase 2 — Paiement, annulation et comptabilité

1. Ajouter un modèle de transaction de paiement/remboursement de manière additive.
2. Brancher le PSP côté client/serveur et les webhooks signés.
3. Rendre confirmation, annulation, wallet et fidélité cohérents avec les événements financiers.
4. Corriger les agrégats dashboard pour utiliser ces événements.

**Critère de sortie** : le montant présenté est un devis serveur ; une réservation confirmée correspond à une capture vérifiée ; une annulation produit un résultat financier traçable.

### Phase 3 — Réparer les parcours visibles

1. Unifier les URL de checkout et débloquer/décider le mode invité.
2. Connecter messagerie, listes publiques, alertes et réponses aux avis.
3. Préserver les critères de recherche jusqu’à la chambre.
4. Réparer redirection post-auth et navigation mobile.

### Garde-fous de livraison

- ajouter des endpoints nouveaux avant de retirer les anciens ; tolérer temporairement les deux conventions d’URL de réservation ;
- migrations uniquement additives pour paiement, remboursement et fidélité ; backfill documenté ;
- feature flags pour le nouveau checkout et les notifications ;
- tests contractuels de réponse API pour éviter de casser les composants existants ;
- parcours E2E à exécuter en Chromium réel : visiteur, voyageur, invité, hôte, admin, paiement succès/échec, annulation, avis, messagerie et mobile ;
- conserver `typecheck`, lint, Vitest et le smoke HTTP au vert à chaque phase.

---

## 8. Conclusion

Le socle technique est exploitable : pages principales disponibles, authentification, protections de routes, schéma de base et de nombreux endpoints sont déjà en place. La priorité n’est pas d’ajouter des écrans supplémentaires ; elle est de rendre **vraies** les règles que les écrans promettent déjà.

Le chemin le plus sûr est : **disponibilité/capacité → cycle de vie/avis → paiement/annulation → UX des boutons et parcours → reporting/fidélité**. Cet ordre évite de casser ce qui fonctionne tout en supprimant d’abord les scénarios qui peuvent créer un dommage réel pour le voyageur, l’hôte ou la plateforme.
