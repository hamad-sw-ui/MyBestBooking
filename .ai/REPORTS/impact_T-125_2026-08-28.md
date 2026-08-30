# T-125 — Analyse d'impact (§14) : correctifs de l'audit fonctionnel n°5

- **Date** : 2026-08-28
- **Tâche** : T-125 (niveau **S** structurelant — contient 1 migration légère et des comportements finance/avis ; conçue §15.1, débat multi-rôles §15.2 ci-dessous)
- **Origine** : `REPORTS/audit_fonctionnel_profond5_2026-08-28.md` (P1–P4)
- **Principe directeur** : aucun comportement sain ne doit régresser. Tout changement visible est dérivé d'un réglage ou d'un code existant, avec valeur par défaut qui **préserve le comportement actuel** sauf quand le comportement actuel est précisément le bug.

---

## 1. Périmètre retenu

| Ref | Intitulé | Décision | Niveau |
|-----|----------|----------|--------|
| **P1** | Les avis nouveaux sont `approved` en dur → l'écran de modération ne reçoit jamais rien | Corrigé via un **réglage admin** `reviews.requireModeration` (défaut **`false`** = comportement actuel conservé ; l'admin peut activer la file de modération qui existe déjà) | L |
| **P2** | Parrainage non bouclé (code généré mais jamais consommé) | Bouclage complet **minimal et sûr** : colonne `referredBy`, champ à l'inscription (form + URL `?ref=`), résolution à l'enregistrement, récompense au moment du **séjour terminé** (cron de complétion), idempotente et configurable | S |
| **P3** | Le motif de suspension n'est pas tracé dans l'audit | Ajout de `reason` dans `metadata` (champ déjà validé) | T |
| **P4** | `/mes-reservations/avis/[id]` répond 200 pour tout UUID | Garde RSC : `notFound()` si réservation absente / non propriétaire / non éligible, sinon rend du formulaire | L |

---

## 2. Les 9 questions d'analyse d'impact (§14)

### Q1 — Quels fichiers/écrans sont touchés ?
- `src/lib/settings.ts` : nouveau réglage `reviews.requireModeration` (bool défaut `false`) + réglages `bestrewards.referral` (montants/activation).
- `src/db/schema.ts` : `users.referredBy` (uuid nullable, auto-référence) + `users.referralRewardedAt` (timestamp nullable, idempotence) + `users.referralCode` généré à l'inscription.
- Migration `drizzle/0017_*.sql`.
- `src/app/api/auth/register/route.ts` : accepte `referralCode` optionnel, résout le parrain, génère le code du filleul.
- `src/app/(auth)/inscription/page.tsx` : champ « Code de parrainage (optionnel) », pré-remplissage `?ref=`.
- `src/app/api/reviews/route.ts` (POST) : statut `pending` si `requireModeration` sinon `approved`.
- `src/app/api/cron/price-alerts/route.ts` (`completeEligibleBookings`) : récompense parrain/filleul idempotente à la complétion du séjour.
- `src/app/api/users/[id]/suspend/route.ts` : `reason` dans l'audit.
- `src/app/(main)/mes-reservations/avis/[id]/page.tsx` : devient RSC qui charge la réservation + rend le formulaire client.
- `src/components/referral-card.tsx` : message aligné sur la récompense réelle.
- Tests ciblés + docs `.ai`.

### Q2 — Quels contrats d'API changent ?
- `POST /api/auth/register` : **ajout** d'un champ optionnel `referralCode`. Aucun champ existant modifié → rétrocompatible. Un code invalide est **ignoré silencieusement** (n'empêche jamais l'inscription).
- `POST /api/reviews` : le statut initial peut être `pending` **uniquement si l'admin active** le réglage ; sinon `approved` (identique à aujourd'hui).
- Aucune clé de réponse modifiée.

### Q3 — Quelles données migrent ? Risque de perte ?
- Migration **additive** : 2 colonnes nullable + aucune colonne supprimée/renommée. Aucune perte.
- Les avis existants restent `approved` (le réglage par défaut ne change pas leur statut).
- Les utilisateurs existants gardent `referredBy = null` (pas d'effet rétroactif) et leur `referralCode` déjà généré.

### Q4 — Quels parcours utilisateur sont affectés (3 rôles + anonyme) ?
- **Anonyme** : page d'inscription montre un champ optionnel ; lien `?ref=CODE` pré-rempli.
- **Customer/filleul** : inscription avec code → parrain lié ; à son 1er séjour terminé, crédit wallet (si réglage activé). Peut laisser un avis : si modération active, son avis affiche « en attente de modération » ; sinon comportement actuel.
- **Customer/parrain** : crédit wallet idempotent quand le filleul termine son séjour.
- **Host** : inchangé (le parrainage est un mécanisme client ; un host peut parrainer mais le déclencheur reste la complétion de séjour).
- **Admin** : nouveau réglage de modération + récompenses de parrainage dans les settings (panneau existant) ; la file « En attente » se remplit quand la modération est activée.

### Q5 — Quels composants critiques (finance, sécurité, Room) ?
- **Finance (wallet)** : le crédit de parrainage touche `walletBalance`. Il est exécuté **dans la transaction de complétion** (déjà `FOR UPDATE` sur le booking et le user), **idempotent** (garde `referralRewardedAt IS NULL`), **plafonné par les montants de réglage**, et **désactivable** (défaut : on choisit des montants raisonnables mais feature actée par réglage). Pas de double paiement possible.
- **Sécurité** : `referredBy` est résolu côté serveur (jamais fait confiance à un id client), un utilisateur ne peut pas se parrainer lui-même, et un code invalide ne bloque pas l'inscription. La garde RSC de la page d'avis ne fait que restreindre l'affichage (l'API garde ses vérifications 404/403/400).

### Q6 — Quels tests existent déjà et couvrent ces zones ?
- Reviews : tests modération/listing existants ; on ajoute un test du statut initial selon réglage.
- Cron/loyalty : `src/lib/loyalty.test.ts`, tests cron ; on ajoute un test ciblé de la récompense de parrainage (fonction pure) pour ne pas dépendre de la BDD.
- Register : on ajoute un test d'acceptation/ignorance du `referralCode` (fonction de résolution pure).
- Suspendre : test existant de l'audit ; on vérifie la présence de `reason`.

### Q7 — Quels effets de bord hors code (emails, cron, settings) ?
- Le cron de complétion fait un peu plus de travail (crédit parrain) : uniquement pour les bookings dont le user a un `referredBy` non encore récompensé ; quelques lignes conditionnelles, pas de surcoût pour la majorité.
- Pas de nouvel email (hors périmètre pour rester minimal ; la récompense est visible sur le wallet).

### Q8 — Quels risques de régression et comment les neutraliser ?
- **Régression avis** : si on forçait `pending` pour tous, les avis clients disparaîtraient du public. → Neutralisé par le réglage **défaut `false`** (comportement actuel) ; la modération reste un choix admin explicite.
- **Régression inscription** : une erreur dans la résolution du parrain pourrait bloquer les inscriptions. → La résolution est isolée dans un `try/catch` : tout échec (code absent/invalid/auto-parrainage) → on inscrit quand même sans parrain.
- **Double récompense** : neutralisée par `referralRewardedAt` + vérification dans la transaction `FOR UPDATE`.
- **Wallet négatif/gonflé** : montants positifs validés par le schéma de réglage, addition plafonnée au type decimal(10,2).
- **Page avis** : la transformation en RSC utilise les mêmes règles (`isReviewEligible`, propriété de la résa) ; le formulaire client reste identique.

### Q9 — Comment valider (§13) ?
- 🔨 `npm run typecheck` · `npm run lint` (0 erreur, warnings préexistants) · `npm run build`.
- 🧪 `npm test` (tous les tests existants verts + nouveaux tests).
- ▶️ `npm run smoke` (≥ 40 assertions HTTP) ; puis exécution manuelle des 4 parcours (inscription avec `?ref=`, suspension avec motif, page avis UUID invalide, bascule modération).
- 🧭 `npm run ai:check` (garde-fous R1–R20).
- Migration appliquée sur la base locale.

---

## 3. Conception (§15.1)

### P1 — Modération pilotée par réglage (défaut = comportement actuel)
- `settings.ts` : ajout dans le schéma `reviews` (nouvelle clé) :
  `reviews = { requireModeration: boolean (default false) }`.
- POST reviews : `status = (await getSetting("reviews")).requireModeration ? "pending" : "approved"`.
- Quand `pending`, l'agrégat de note ne change pas (la fonction ne compte que les `approved`) → déjà correct.
- Prévoir que le client puisse voir le statut de son propre avis : le GET reviews, pour un **user connecté non-admin/host**, filtre `approved` ; on ajoute **sans élargir la fuite** la visibilité de ses propres avis `pending/hidden/rejected` (condition `OR userId = user.id`). C'est nécessaire pour que le client sache que son avis est « en attente » (sinon silence). Cela n'expose que ses propres avis.

### P2 — Bouclage parrainage minimal et sûr
- **Schéma** :
  - `users.referredBy uuid references users(id)` (nullable).
  - `users.referralRewardedAt timestamp` (nullable) : horodatage de la récompense déjà versée pour ce filleul → idempotence.
  - `referralCode` est **généré à l'inscription** pour tout nouveau compte (aujourd'hui généré au premier GET) — code extrait dans une fonction partagée `src/lib/referral.ts`.
- **Lib `src/lib/referral.ts`** (pures + accès) :
  - `generateReferralCode()` (déplacée depuis la route).
  - `resolveReferrer(codeRaw, newUserId, email)` : normalise, cherche le user par `referralCode`, refuse si parrain = nouvel utilisateur (impossible à l'inscription) ou parrain supprimé ; renvoie l'id parrain ou `null`. Ne lève jamais (erreur → null).
  - `calculateReferralReward(settings, ...)` : fonction pure renvoyant `{ referrerCredit, refereeCredit }` d'après les réglages (0 si désactivé).
- **Réglages `bestrewards.referral`** : `{ enabled: boolean (default true), referrerAmount: number (default 10), refereeAmount: number (default 5) }` en EUR (unités du wallet). Validation ≥ 0.
- **Register** : après création du user, dans la même logique non-bloquante, résoudre `referralCode` → `referredBy` ; générer le `referralCode` du filleul. Le code fourni est `uppercase().trim()`.
- **Inscription UI** : champ texte optionnel « Code de parrainage » ; valeur initiale depuis `searchParams.ref` (ou `?ref=`).
- **Déclencheur récompense** : dans `completeEligibleBookings` (cron), quand un booking passe à `completed` pour un user ayant `referredBy` non null et `referralRewardedAt` null :
  - crédite le **parrain** de `referrerAmount` (wallet) ;
  - crédite le **filleul** de `refereeAmount` (wallet, en plus de son cashback BestRewards) ;
  - marque `referralRewardedAt = now()` sur le filleul.
  - Le tout dans la transaction existante (verrous `FOR UPDATE` sur parrain et filleul), seulement si `enabled`.
- **Carte parrainage** : texte aligné sur les montants réels (lus via le réglage bestrewards ou message générique).

### P3 — Audit de suspension
`metadata: { targetEmail, ...(reason ? { reason } : {}) }`.

### P4 — Garde RSC page avis
- Transformer `avis/[id]/page.tsx` en Server Component qui :
  - exige un utilisateur connecté (sinon redirection `/connexion`),
  - charge la réservation `[id]` ; si absente ou `userId !== user.id` → `notFound()`,
  - si `!isReviewEligible(booking.status, booking.checkOut)` → `notFound()` (ou message « avis disponible après le séjour »),
  - rend `<ReviewForm bookingId={...} />` (composant client extrait, logique de soumission inchangée).

---

## 4. Débat multi-rôles (§15.2)

- **Architecture** : réutiliser la transaction de complétion existante plutôt qu'un nouveau cron → moins de surface, même garantie d'idempotence.
- **Next.js/React** : P4 = RSC + composant client enfant (pattern déjà utilisé dans le repo) ; l'usage de `useParams`/`useRouter` reste dans le client.
- **PostgreSQL/Drizzle** : migration additive nullable, sûre ; `referredBy` auto-référence sans `ON DELETE` agressif (un parrain supprimé → `referredBy` orphelin géré par la jointure qui peut renvoyer null → pas de crash). On choisit `ON DELETE SET NULL` pour la propreté.
- **Sécurité** : résolution serveur, auto-parrainage impossible, code invalide non bloquant, élargissement GET reviews limité à ses propres avis.
- **Finance/QA** : récompense idempotente, dans les verrous existants, montants validés et désactivables ; tests purs pour les calculs.
- **UX** : le défaut de modération reste `false` (aucune surprise en production) ; l'admin peut l'activer. Le parrainage devient réellement utilisable.

---

## 5. Plan de validation et rollback
- Validation §13 complète (typecheck, lint, test, build, smoke, ai:check) + exécution manuelle des 4 parcours.
- Rollback : révert du commit de code ; la migration additive peut rester (colonnes nullable inoffensives) ou être neutralisée par réglage `requireModeration=false` / `referral.enabled=false`.
