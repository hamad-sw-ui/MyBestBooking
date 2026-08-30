# Audit fonctionnel profond n°12 — 2026-08-28

> Vérification à l'**exécution réelle** (dev Turbopack port 3000, base PostgreSQL)
> sur les 3 rôles (admin, hôte, client) + anonyme. Méthode : code source ET
> comportement constaté font foi. Chaque problème est expliqué avec sa solution
> **additive, sans régression**. **Rapport préalable à toute implémentation.**

---

## Synthèse

| # | Élément | Gravité | Constat | Solution proposée |
|---|---------|---------|---------|-------------------|
| A1 | **Filtre de prix en recherche** | 🔴 Fonctionnel | La fourchette de prix compare `base_price` en **EUR** (devise chambre) alors que l'affichage est désormais en **XAF** (T-132). Placeholder « € ». Un visiteur FCFA saisissant « max 50 000 » (≈ 76 €) ne filtre rien. | Interpréter la saisie dans la devise d'affichage (XAF) et la **convertir en EUR** avant le filtrage ; libellé dynamique. |
| A2 | **Réservations `pending` impayées jamais expirées** | 🟠 Stock | Une réservation en attente de paiement Stripe pose `paymentExpiresAt = now + 15 min` et **bloque le stock**, mais aucun cron/processus n'annule les `pending` expirées → la chambre reste bloquée indéfiniment. | Cron de « sweep » qui annule les `pending` dont `paymentExpiresAt < now` (réutilise l'annulation existante ; garde 15 min intacte). |
| A3 | **« Contacter l'hôte » avant réservation indisponible** | 🟡 Fonction fantôme | L'API `POST /api/conversations` supporte **délibérément** une conversation voyageur sans réservation (clé `property:…:user:…`), mais aucun bouton ne l'expose sur la fiche ; le texte `/messages` dit « après une réservation ». | Bouton « Contacter l'hôte » sur la fiche (connecté) → crée/rouvre la conversation puis redirige vers `/messages/[id]`. |
| A4 | **Photo de profil (`avatarUrl`) sans saisie ni affichage** | ⚪ Code mort | Le champ existe en base et l'API `PATCH /api/users/me` l'accepte, mais aucun formulaire ne permet de le poser et aucune UI ne l'affiche. | Upload avatar (réutilise `/api/uploads`) ou champ URL dans le profil + affichage (initiale en repli). |

**Zones vérifiées SAINES à l'exécution cette session** (détails en fin) :
messagerie (isolation 403/404/400), cycle de vie propriété hôte (pending →
validation admin → visible), **anti-sur-réservation (409, 2 confirmées / 1
rejetée sur qty=2)**, recherche par disponibilité réelle aux dates, compte
invité + email d'activation (`guest_claim`), facture (RBAC propriétaire/hôte/
admin), alertes prix (liste/suppression), wallet transactionnel en EUR,
devises de paiement cohérentes au checkout.

---

## A1 🔴 — Le filtre de prix de la recherche s'applique en EUR alors que l'affichage est en XAF

### Problème
En T-132, la devise d'affichage par défaut est devenue le **Franc CFA** : les
cartes de recherche affichent le prix converti (ex. `89 € → 58 380 FCFA`).
Mais le **formulaire de filtre** reste câblé sur la devise de stockage :

- `src/app/(main)/recherche/page.tsx` construit le prédicat
  `r.base_price >= minPrice / <= maxPrice`.
- `base_price` est dans la devise de la chambre (**EUR** pour tout le seed).
- Les champs `<input name="minPrice"/maxPrice>` portent le placeholder **« € min / € max »**.

Un visiteur qui raisonne en FCFA (l'affichage lui montre des montants comme
`58 380 FCFA`) tape naturellement « max 50 000 ». Ce 50 000 est comparé
directement à `base_price` en euros : comme toutes les chambres coûtent moins
de 50 000 **€**, le filtre ne retire **aucun** résultat.

**Preuve d'exécution :**
- `GET /api/properties?maxPrice=50000` → **8 résultats** (filtre sans effet).
- `GET /api/properties?maxPrice=100` (100 € ≈ 65 600 FCFA) → **3 résultats**.
- Tous les prix affichés sont en FCFA : l'échelle de saisie (~50 000) ne
  correspond pas à l'échelle de comparaison (~100).

C'est une régression fonctionnelle introduite par le changement de devise par
défaut : le filtre devient silencieusement inopérant pour le marché cible.

### Solution (sans régression)
La page de recherche est un **composant serveur** ; la devise d'affichage est
résolue côté client par `useDisplayPreferences`. Deux options additives :

1. **Convertir la saisie côté filtrage (recommandé).** Le formulaire étant un
   `GET` classique, ajouter un champ caché `currency` (la devise d'affichage
   courante, lue par `useDisplayPreferences` via un petit composant client qui
   synchronise un `<input type="hidden" name="displayCurrency">`). Côté serveur,
   si `displayCurrency` est fourni et diffère de la devise de la chambre
   (EUR), convertir `minPrice`/`maxPrice` **vers l'EUR** avec
   `convertAmount(value, displayCurrency, "EUR")` **avant** de construire le
   prédicat de prix. Les comparaisons restent alors exactes dans la devise de
   stockage.
   - Taux figés indicatifs déjà utilisés pour l'affichage (même source
     `RATES_FROM_EUR`) → cohérence parfaite entre ce que l'utilisateur voit et
     ce que le filtre retient.
   - **Non-régression** : si `displayCurrency` est absent ou `EUR`, on garde le
     comportement actuel (`base_price = valeur saisie`).
2. **Libellé dynamique** : remplacer le placeholder statique `€` par la devise
   d'affichage (`FCFA`, `$`…) pour que l'échelle soit explicite.

Aucun changement sur les prix en base ni sur le paiement : uniquement la
traduction de la fourchette saisie dans la devise de comparaison.

---

## A2 🟠 — Les réservations `pending` impayées expirent en théorie mais jamais en pratique (stock bloqué)

### Problème
Quand une réservation est créée avec un paiement à confirmer (Stripe), le code
pose :
- `status = "pending"`, `paymentStatus = "pending"`,
- `paymentExpiresAt = now + 15 min` (`src/app/api/bookings/route.ts`).

Le contrôle de disponibilité (`FOR UPDATE`, vérifié sain) compte comme occupées
toutes les réservations **non `cancelled`** — donc les `pending`. C'est
voulu pendant les 15 minutes (éviter qu'un autre client prenne la chambre
pendant le paiement). **Mais** :

- Il n'existe qu'**un seul cron** : `/api/cron/price-alerts`.
- Aucun processus ne passe les `pending` dont `paymentExpiresAt` est dépassé à
  `cancelled`.
- Le webhook Stripe ne traite que les événements de paiement (`succeeded`,
  remboursements) ; un visiteur qui **abandonne** (ne paie jamais, ne déclenche
  aucun webhook) laisse une réservation `pending` pour toujours.

➡️ Après 15 minutes sans paiement, la chambre reste **indéfiniment
indisponible** à la vente pour ces dates, alors que la réservation n'aboutira
jamais. Le `paymentExpiresAt` est défini mais jamais exploité pour libérer.

### Solution (sans régression)
Ajouter un cron de **sweep des paiements expirés** (sur le modèle de
`/api/cron/price-alerts`, même protection par secret cron) :

```
toutes les N minutes :
  SELECT bookings WHERE status='pending'
    AND paymentStatus='pending'
    AND paymentExpiresAt IS NOT NULL
    AND paymentExpiresAt < now()
  FOR UPDATE
  → pour chacune :
      - annuler l'intention de paiement côté provider (déjà existant :
        provider.cancel(paymentIntentId), no-op/stub si déjà annulée),
      - passer status='cancelled' avec un motif du type "paiement expiré",
      - libérer le stock (automatique : le décompte ignore les 'cancelled'),
      - NE PAS toucher au wallet (aucun crédit n'a été débité sur un paiement
        non abouti — vérifié : le wallet n'est consommé qu'à la confirmation).
```

- **Garde anti-régression** : ne sélectionner que les `pending` **strictement
  expirées** ; les `confirmed`/`paid` et les `pending` de moins de 15 min ne
  sont pas touchées. La fenêtre de 15 minutes et la sérialisation `FOR UPDATE`
  restent intactes.
- Idempotent : un sweep qui ne trouve rien ne fait rien ; relançable sans
  risque.
- Alternative complémentaire (défense en profondeur, hors cron) : faire
  expirer « paresseusement » au moment du contrôle de disponibilité — mais le
  cron est le correctif propre et visible (il annule aussi l'intention Stripe).

---

## A3 🟡 — « Contacter l'hôte » avant réservation : back-end prêt, absent de l'interface

### Problème
`POST /api/conversations` gère explicitement deux modes :
- avec `bookingId` (conversation liée à une réservation),
- **sans `bookingId`** : un voyageur ouvre une filature sur une propriété
  (clé déterministe `property:<prop>:user:<voyageur>`, idempotente via
  `onConflictDoNothing`). Un hôte sans réservation reçoit une 400 (« doit
  sélectionner une réservation ») — le mode sans résa est donc **réservé au
  voyageur**, clairement voulu.

Or l'interface ne permet de démarrer une conversation que depuis
`BookingRowActions` (donc **après** une réservation). Sur la fiche hébergement,
il n'y a **aucun bouton** « Contacter l'hôte », et la page `/messages` affiche
*« Vos conversations avec les hébergeurs apparaîtront ici après une
réservation »* — ce qui est faux puisque l'API autorise le contact avant.

C'est le scénario très courant « question avant de réserver » (disponibilité,
accès, équipement) qui est inaccessible dans l'UI alors que tout le back-end
existe.

### Preuve d'exécution
`POST /api/conversations {propertyId}` en client → **201** ; l'hôte voit la
conversation dans `GET /api/conversations` et peut répondre (201) ; un tiers
non participant reçoit **403** en lecture et en écriture ; propriété
inexistante → **404** ; message vide → **400**.

### Solution (sans régression)
Ajouter sur la fiche hébergement (`hebergement/[slug]`), pour un visiteur
**connecté**, un bouton **« Contacter l'hôte »** (composant client) qui :
1. `POST /api/comversations { propertyId }` (crée/rouvre la filature,
   idempotent),
2. redirige vers `/messages/<id>` (le `MessageComposer` existe déjà).
- Visiteur non connecté → redirige vers `/connexion?next=…` (même pattern que
  le bouton favoris).
- L'hôte ne voit pas ce bouton sur sa propre propriété (il utiliserait le flux
  réservation côté dashboard).
- Corriger le texte de la page `/messages` vide pour ne plus dire « après une
  réservation » (ou mentionner « ou depuis une fiche hébergement »).

Aucune modification d'API : c'est une simple exposition d'une capacité déjà
sécurisée (les contrôles 401/403/404 sont en place).

---

## A4 ⚪ — `avatarUrl` : champ accepté par l'API mais jamais saisi ni affiché

### Problème
- La table `users` a une colonne `avatar_url`.
- `PATCH /api/users/me` valide et enregistre `avatarUrl` (URL, max 500).
- Mais `grep` de `avatarUrl` dans `src/components`/`src/app` → **aucune
  utilisation** : pas de champ d'upload/URL dans `profile-form.tsx`, et aucun
  composant n'affiche une photo de profil (ni dans le compte, ni dans la
  messagerie, où on ne montre que des initiales/texte).

C'est une fonctionnalité « branchée à moitié » : persistance OK, exposition
nulle.

### Solution (sans régression)
Deux options additives, au choix :
1. **Minimal** : un champ « URL de votre photo » dans le formulaire profil
   (PATCH `avatarUrl` déjà prêt) + affichage en tête de « Mon compte » et dans
   l'en-tête des messages, avec **repli sur les initiales** si vide/erreur de
   chargement.
2. **Complet** : upload d'image via l'API `/api/uploads` existante (qui
   applique déjà le magic-bytes sniffing), puis stockage de l'URL retournée.

Non-régression : tant qu'`avatarUrl` est `null`, on conserve l'affichage actuel
(initiales). Aucune migration.

---

## Zones vérifiées saines à l'exécution (session n°12)

- **Messagerie** : client ouvre une conversation sur une propriété (201), envoie
  (201) ; l'hôte la voit et répond (201) ; un admin non participant est refusé
  en lecture **et** en écriture (403 « Accès refusé ») ; propriété inexistante
  → 404 ; message vide → 400. Contrôle de participant côté serveur effectif.
- **Cycle de vie propriété hôte** : création → statut `pending` (invisible en
  recherche publique et en fiche anonyme 404) ; ajout de chambre (201 avec
  `roomType`/`bedConfiguration`/`basePrice>0`) ; validation admin
  `POST /api/properties/[id]/validate {action:"approve"}` → `active` puis
  visible en recherche ; un client ne peut pas valider (403).
- **Anti-sur-réservation** : 3 réservations simultanées (`Promise.all`) sur
  une chambre de quantité 2 aux mêmes dates → **2 × 201, 1 × 409 « Cette
  chambre n'est plus disponible pour ces dates »**. Le verrou `FOR UPDATE`
  fonctionne sous concurrence.
- **Recherche par disponibilité** : le prédicat SQL génère les nuits via
  `generate_series`, joint `room_availability`, exclut `stop_sell` et les
  chambres dont le `available_count` est insuffisant ; `min_stay` respecté à la
  date d'arrivée. Filtres (type, équipement, voyageurs, tri, prix) tous
  exposés dans le formulaire + pagination (20/page, « Précédent/Suivant »).
- **Réservation invitée** : compte créé avec `passwordHash = null`,
  `emailVerified = false` ; jeton `guest_claim` (24 h) émis et email
  d'activation vers `/activer-compte?token=…` ; le claim passe par
  `reset-password {claimGuest:true}` (vérifié aux sessions précédentes).
- **Facture** : `GET /api/bookings/[id]/invoice` autorise le propriétaire de la
  réservation, l'hôte de la propriété et l'admin ; 403 pour les autres ;
  mentions légales gérées (`buildInvoiceData`).
- **Avis** : lien « Laisser un avis » conditionné aux réservations
  `completed` ; POST avec anti-doublon (`FOR UPDATE` sur bookingId) et
  modération optionnelle selon les réglages. (L'absence de *modification* d'un
  avis publié est un choix V1 acceptable.)
- **Devises transactionnelles** : le tunnel `/reservation`, le wallet et les
  remboursements restent en EUR (devise chambre/passerelle) ; Stripe ne
  supportant pas le XAF, cette limite est correcte et affichée.

---

## Recommandation d'ordre

1. **A1** (filtre prix XAF) — correction rapide, impact direct sur le marché
   cible, risque faible (additif, repli EUR conservé).
2. **A2** (sweep des `pending` expirées) — fiabilité financière/stock, ajoute
   un cron calqué sur l'existant ; nécessite un test de scénario (réservation
   `pending` datée dans le passé → annulée par le sweep).
3. **A3** (contacter l'hôte) et **A4** (avatar) — expositions UI de capacités
   back-end déjà présentes, sans risque.
