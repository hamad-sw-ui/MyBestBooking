# Audit fonctionnel profond n°5 — scénarios d'exécution « zones peu explorées »

- **Date** : 2026-08-28
- **Branche** : `arena/01a042cf-mybestbooking` (HEAD `46b2ca8`)
- **Méthode** : exécution réelle contre l'application (Next 16.2.6 + Postgres), 3 rôles connectés (customer / host / admin) + appels anonymes. Base seedée (8 propriétés).
- **Périmètre** : parcours réservation complet, wallet & promos, création hôte (bien + chambre), messagerie, 2FA bout-en-bout, parrainage, alertes prix + cron, inscriptions (host / invité), avis & modération, actions admin, rendu des pages.

> Conformité §16 (preuves honnêtes) : tous les constats ci-dessous ont été produits par des appels HTTP réellement exécutés ou par lecture du code de production. Les comportements sains sont listés en fin de rapport pour ne pas y toucher.

---

## Synthèse des problèmes trouvés

| # | Sévérité | Zone | Problème |
|---|----------|------|----------|
| **P1** | 🟠 Moyenne | **Avis / modération** | Les avis sont créés `approved` en dur alors qu'un écran de modération « En attente » existe → le back-office de modération ne reçoit jamais rien. |
| **P2** | 🟠 Moyenne | **Parrainage** | Le code de parrainage est généré et affiché, mais n'est **jamais consommé** : pas de champ à l'inscription, pas de lien parrain/filleul, pas de crédit wallet. Feature présentée mais non fonctionnelle. |
| **P3** | 🟡 Basse | **Audit log** | La suspension d'utilisateur n'enregistre pas le **motif** (`reason`) saisi par l'admin dans la trace d'audit. |
| **P4** | 🟡 Basse | **Page avis** | `/mes-reservations/avis/[id]` renvoie 200 pour n'importe quel UUID (formulaire client) ; l'erreur n'apparaît qu'à la soumission. |

Aucune régression introduite : **aucun code de production n'a été modifié** dans cet audit (phase d'investigation). Les solutions proposées ci-dessous sont des correctifs ciblés à appliquer séparément, avec la validation §13 complète.

---

## P1 — Les avis clients contournent la modération (🟠)

### Preuve
1. Création d'un avis sur une réservation `completed` passée :
   `POST /api/reviews {"bookingId":"<résa terminée>","overallRating":9,...}` → **201**.
2. En base immédiatement : `reviews.status = 'approved'` (et non `pending`).
3. L'admin interroge `GET /api/reviews?status=pending` → **0 avis en attente**, alors qu'un avis vient d'être créé.

### Cause racine
`src/app/api/reviews/route.ts` (~ligne 124), l'insertion code le statut en dur :
```ts
const [review] = await tx.insert(reviews).values({
  ...
  isVerified: true,
  status: "approved",   // ← écrase le défaut SQL "pending"
}).returning();
```
Le schéma Drizzle porte déjà `status varchar ... default("pending")` (`src/db/schema.ts`), mais le code l'outrepasse.

### Incohérence fonctionnelle
Un écran de modération complet existe et attend des avis `pending` :
- `src/components/bulk/reviews-manager.tsx` : onglets « En attente / Approuvés / Masqués / Rejetés » + **compteur « En attente »** (lignes 105, 145, 167).
- `src/components/admin/review-moderate-actions.tsx` et la route `PATCH /api/reviews/[id]/moderate` (approuver / masquer / rejeter, tracée dans l'audit).

Comme tout avis est directement `approved`, **le compteur « En attente » reste éternellement à 0** et l'écran de modération ne reçoit jamais rien à traiter. Le travail de modération (et son audit `review.moderate`) est donc mort.

### Solution proposée (sans casser l'existant)
Deux options cohérentes, à choisir métier :

- **Option A (modération a posteriori, recommandée pour une marketplace de confiance)** : retirer `status: "approved"` de l'insert pour retomber sur le défaut `pending`. Les avis passent par l'écran de modération. Les avis déjà `approved` (seed) restent affichés.
  → Vérifier que la récupération publique (`GET /api/reviews` anonyme → `status='approved'`) masque bien les `pending` (c'est déjà le cas, ligne 63).
- **Option B (publication immédiate assumée)** : si la modération est volontairement post-publication, alors il faut assumer le choix dans l'UI : masquer ou reformuler l'onglet « En attente » et ne pas laisser croire à une file de modération.

Dans les deux cas, le défaut SQL `pending` et le code doivent raconter la même histoire. Aucun impact sur le calcul de l'agrégat (`recomputePropertyReviewAggregate` ne compte que les `approved`) : en option A, l'agrégat ne bougera qu'après approbation — comportement attendu.

---

## P2 — Le programme de parrainage est une coquille vide (🟠)

### Preuve
1. `GET /api/users/me/referral` (connecté customer) → **200 `{ "code": "4WHABQ4M" }`** : le code est bien généré.
2. `src/components/referral-card.tsx` l'affiche dans « Mon compte » avec un bouton « Copier » et le texte : *« À chaque nouvelle réservation effectuée avec votre code, vous et votre filleul recevrez des avantages BestRewards »*.
3. Mais :
   - `grep referralCode` sur tout `src/` ne renvoie que la route qui **génère/affiche** le code (`src/app/api/users/me/referral/route.ts`). **Aucun code ne le lit.**
   - Le formulaire d'inscription `src/app/(auth)/inscription/page.tsx` n'a **aucun champ** « code de parrainage » et le POST ne l'envoie pas.
   - La route `src/app/api/auth/register/route.ts` n'accepte aucun paramètre de parrainage (`grep referral` → rien).
   - Il n'existe **pas de colonne `referredBy` / `referred_by`** dans `src/db/schema.ts` (seulement `referralCode` sur le user).
   - Aucune logique ne crédite le wallet du parrain (ni du filleul).

### Conséquence
Le client voit un code et la promesse d'avantages, mais le code n'est saisissable nulle part : **le parrainage ne peut jamais aboutir**. C'est une fonctionnalité annoncée et non livrée (risque de confusion / déception utilisateur, voire problème de conformité d'affichage d'une récompasse inaccessible).

### Solution proposée
C'est une **évolution fonctionnelle**, pas un simple bug. Deux façons de résorber l'écart :

- **Soit livrer le bouclage minimal** :
  1. Migration : ajouter `users.referredBy` (uuid → users.id, nullable).
  2. `register` : accepter `referralCode` optionnel ; résoudre le parrain (user dont `referralCode = code`), refuser si parrain = nouvel utilisateur ; enregistrer `referredBy`.
  3. Ajouter un champ « Code de parrainage (optionnel) » dans le formulaire d'inscription (et pré-remplir depuis `?ref=CODE` dans l'URL).
  4. Décider du déclencheur de récompense (à la 1re réservation confirmée du filleul, pas à l'inscription) et créditer les wallets parrain/filleul dans la transaction de réservation, avec trace d'audit.
- **Soit masquer la promesse** tant que la feature n'est pas livrée : retirer `ReferralCard` (ou la passer en « bientôt disponible ») pour ne pas annoncer un avantage inutilisable.

À aligner avec le texte déjà présent dans la carte (« à activer en prod… seuils définis dans le panneau d'administration ») : aujourd'hui ces seuils ne sont branchés sur rien.

---

## P3 — Le motif de suspension n'est pas tracé dans l'audit (🟡)

### Preuve
- `PATCH /api/users/[id]/suspend {"suspended":true,"reason":"test audit"}` → 200, la suspension fonctionne (l'utilisateur suspendu reçoit 401, ses sessions sont révoquées).
- L'entrée d'audit `user.suspend` est bien écrite, mais sa `metadata` ne contient que `{ targetEmail }` :
  `src/app/api/users/[id]/suspend/route.ts` (~ligne 59)
  ```ts
  metadata: { targetEmail: updated.email },   // ← "reason" parsé mais jamais journalisé
  ```
  Le champ `reason` est accepté par le schéma Zod (`reason: z.string().max(500).optional()`) puis **ignoré**.

### Conséquence
Pour une action disciplinaire (suspension d'un compte), la justification demandée à l'admin n'est pas conservée. En cas de litige RGPD / support, l'audit montre « qui a suspendu qui » mais pas « pourquoi ».

### Solution proposée (correctif trivial et sans risque)
Inclure le motif dans la metadata d'audit :
```ts
metadata: { targetEmail: updated.email, ...(data.reason ? { reason: data.reason } : {}) },
```
Le champ est déjà validé (max 500), donc aucun risque d'injection / taille. Aucun impact sur la logique de suspension.

---

## P4 — La page d'avis s'affiche pour n'importe quelle réservation (🟡)

### Preuve
- `GET /mes-reservations/avis/00000000-0000-0000-0000-000000000000` (connecté customer) → **200** (le formulaire s'affiche).
- Ce n'est **pas une faille de sécurité** : la soumission `POST /api/reviews` applique bien les garde-fous (404 réservation inconnue, 403 si pas le propriétaire, 400 si séjour non terminé, 400 si doublon). Aucune donnée n'est exposée par la page (composant client sans chargement serveur).

### Conséquence
Uniquement un problème d'UX : un utilisateur qui suit un lien brûlé/copié voit un formulaire d'avis valide puis une erreur au moment d'envoyer.

### Solution proposée
Option simple et sans risque : transformer la page en Server Component (ou ajouter un chargement RSC) qui :
- charge la réservation `[id]`,
- renvoie `notFound()` si elle n'existe pas / n'appartient pas à l'utilisateur / n'est pas éligible,
- sinon rend le formulaire client existant en lui passant les données.
Les règles d'éligibilité sont déjà centralisées dans `isReviewEligible(...)` (`src/lib`), réutilisable côté serveur.

---

## Comportements vérifiés SAINS (ne pas toucher)

Ces parcours ont été exercés en réel et fonctionnent correctement :

- **Réservation** : dates passées / check-out ≤ check-in / 0 nuit → 400 ; `numAdults` > capacité → 409 ; email invalide → 400 ; `roomId` d'une autre chambre → 400.
- **Inventaire** : surbooking (6e résa sur qté 5) → 409 ; chevauchement partiel → 409 ; nuits adjacentes (check-out = check-in suivant) → acceptées. Stop-sell par date (`count=0`) bloque la résa ; surcharge de prix par date bien appliquée au total.
- **Rate plans** : création `POST /api/rooms/[id]/rate-plans` → 201 et application à la réservation.
- **Promos** : `BIENVENUE10` appliquée (10% plafonné), code inconnu → 404, code négatif/invalide → 400, expiration vérifiée via `isPromoUsable` (date du jour vs `validUntil`), incrément `currentUses` en transaction.
- **Wallet** : `useWalletCredits` plafonné au total, chaîné après promo et BestRewards, solde débité en transaction (`walletBalance` recalculé) et `walletCreditsUsed` tracé sur la réservation.
- **Alertes prix** : le champ API est **`maxPrice`** (pas `targetPrice`) ; `maxPrice` négatif → 400 ; idempotence propriété+user ; l'email d'alerte est bien envoyé par le cron (`alertEmailDelivery.sent:1`). Le cron `GET /api/cron/price-alerts` → 200 et il est **protégé en production** par `CRON_SECRET` (ouvert en dev uniquement, `NODE_ENV`).
- **2FA bout-en-bout** : `setup` → secret TOTP ; `verify` avec un code TOTP valide (généré avec `speakeasy`, la même lib que le serveur) → `{enabled:true}` ; connexion sans code → **401 `twoFactorRequired`** et aucun cookie de session posé ; connexion avec `totpCode` valide → 200 ; code invalide → 401 ; `disable` avec mot de passe + code → 200. Compte de test remis à l'état initial.
- **Inscriptions** : nouvel **host** → 200, accès `/dashboard` autorisé, création de propriété rattachée à son `hostId`, création de chambre conforme ; **isolation hôte** : un autre host qui `PUT` la propriété → **403 « Non autorisé »**.
- **Checkout invité** : `isGuestBooking` sans session → 201 (profil invité créé seulement après toutes les validations métier) ; **anti-détournement** : s'inscrire avec l'email d'un invité ayant déjà réservé → **400 « Un compte existe déjà »** (l'invité passe par le flux de réclamation, pas par register).
- **Messagerie** : conversation idempotente par clé `property:<id>:user:<id>` ; islation (un tiers/admin lit une conversation qui n'est pas la sienne → 403) ; compteurs non-lus corrects (`unreadByUser`/`unreadByHost`) ; **reset des non-lus à l'ouverture** de la conversation côté RSC (vérifié : `unreadByUser` 1 → 0). Forme de réponse `{conversation, property}` identique pour les deux rôles.
- **Avis — règles d'éligibilité** (malgré P1) : réservation non trouvée → 404, pas le propriétaire → 403, séjour non terminé → 400 « après un séjour terminé », double avis → 400 « déjà laissé un avis ».
- **Admin** : routes `audit`, `providers`, `settings`, `bulk` fonctionnelles ; **contrôle d'accès** : customer sur route admin → 403 ; host sur pages admin (`/dashboard/users`, `/dashboard/audit`) → 307 redirection ; audit tracé sur suspend/reactivate/providers/settings/bulk/moderate.
- **Wishlist** : ajout item (avec `wishlistId`) → 201 ; passage en public → génération `shareToken` ; accès anonyme via `/api/wishlists/shared/[token]` → liste + items exposés sans fuite du `userId`.
- **Rendu des pages** (3 rôles) : toutes les pages client (`/mon-compte`, `/messages`, `/mes-reservations`, `/mes-favoris`, `/bestrewards`, `/reservation`, `/recherche`) et les pages dashboard/admin renvoient 200 pour le bon rôle.
- **Rate-limit** : `POST /api/bookings` plafonné à 10/heure par utilisateur (et par IP pour les invités), avec 429 propre — comportement attendu (déclenché pendant l'audit pour cause de volume de tests).

---

## Données de test

Toutes les données créées pendant l'audit ont été supprimées (réservations `MBB-2026-*` de test et 2027, réservation passée `MBB-2026-PAST01` + son avis, overrides de disponibilité chambre des 24-25/12, rate plan de test, alerte prix, propriété/villa et chambre du host de test, utilisateurs de test `newhost@`/`guest.invite@`/`sam.guest@`, conversation de test, item wishlist + liste repassée privée). Le wallet du customer est remis à `25.00`, le 2FA désactivé, et l'agrégat d'avis de la propriété seed recalculé à l'identique (`total_reviews=3`, `average_rating=8.9`, conforme à `ROUND(AVG,1)`).

Aucun code de production modifié durant cet audit.
