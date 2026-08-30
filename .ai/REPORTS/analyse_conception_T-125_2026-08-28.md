# Analyse de conception T-125 (§15.1) — Correctifs 5e audit

- **Date** : 2026-08-28 · **Tâche** : T-125 (niveau S)
- Voir aussi `analyse_impact_T-125_2026-08-28.md` (§14) et
  `validation_T-125_2026-08-28.md` (preuves).

## Objectif
Livrer les 4 correctifs de l'audit fonctionnel n°5 **sans casser** les parcours
validés. Partis pris : réutiliser les transactions/verrous/settings existants,
valeurs par défaut qui préservent le comportement actuel.

## P1 — Modération des avis pilotée par réglage

- Nouveau réglage `reviews` : `{ requireModeration: boolean }`, **défaut `false`**
  (publication immédiate = comportement historique). Le back-office de
  modération (`/dashboard/reviews`, `reviews-manager`, `PATCH …/moderate`)
  existe déjà ; il n'était simplement jamais alimenté.
- `POST /api/reviews` lit `getSetting("reviews")` et choisit
  `status = requireModeration ? "pending" : "approved"`.
- Le GET reviews, pour un voyageur connecté non-admin/host, renvoie les avis
  `approved` **OU ses propres avis** (`or(eq(status,approved), eq(userId, user.id))`)
  → l'auteur voit son avis « en attente » sans fuite vers d'autres utilisateurs.
- L'agrégat de note (`recomputePropertyReviewAggregate`) ne compte que les
  `approved` : inchangé, donc un avis `pending` n'affecte pas la note.

## P2 — Bouclage du parrainage

- **Schéma** (`drizzle/0017_referral-loop.sql`, additif) :
  `users.referred_by uuid → users(id) ON DELETE SET NULL` et
  `users.referral_rewarded_at timestamp` (null = non versé → idempotence).
- **Lib `src/lib/referral.ts`** :
  - `generateReferralCode()` (alphabet sans ambiguïté, extraite de la route),
  - `normalizeReferralCode()` (trim + majuscules),
  - `resolveReferrerId(code)` → id parrain ou `null` (jamais d'exception :
    code vide/inconnu/supprimé → pas de parrain),
  - `assignReferralCode(userId)` (insertion retry sur collision),
  - `calculateReferralReward(referral)` pur → `{referrerCredit, refereeCredit}`,
    `0` si `enabled=false` ou montants nuls/défensifs.
- **Register** : `referralCode` optionnel dans le schéma Zod (max 32). Après
  création, `referredBy = await resolveReferrerId(...)` (non bloquant, englobé
  dans le flux), puis `assignReferralCode(newUser.id)` pour que tout compte ait
  immédiatement son code.
- **Inscription UI** : champ « Code de parrainage (facultatif) » pré-rempli
  depuis `?ref=` / `?referral=` (lecture `window.location.search` dans
  l'init du state, pas de Suspense additionnel).
- **Récompense** : dans `completeEligibleBookings` (cron), transaction existante
  avec verrous `FOR UPDATE` sur booking et user. Si le user a `referredBy` et
  `referralRewardedAt IS NULL` :
  - filleul : wallet += `refereeAmount` (en plus du cashback BestRewards),
  - parrain : ligne verrouillée (`FOR UPDATE`) puis wallet += `referrerAmount`,
  - `referralRewardedAt = now()` marqué **même si les montants sont 0** pour ne
    pas re-tenter.
  Réglages `bestrewards.referral = { enabled, referrerAmount:10, refereeAmount:5 }`
  (Zod ≥ 0, plafond 1000).
- **Carte parrainage** : texte aligné sur le comportement réel + lien
  `/inscription?ref=CODE`.

## P3 — Motif de suspension dans l'audit

- `PATCH /api/users/[id]/suspend` : déstructurer `reason` (déjà validé Zod
  max 500) et l'ajouter à `metadata` (`...(reason ? { reason } : {})`).

## P4 — Garde RSC de la page d'avis

- `src/app/(main)/mes-reservations/avis/[id]/page.tsx` devient un **Server
  Component** async :
  - `getCurrentUser()` → `redirect("/connexion")` si anonyme,
  - `isUuid(id)` → `notFound()` sinon,
  - chargement booking → `notFound()` si absent ou `userId !== user.id`,
  - `isReviewEligible(status, checkOut)` → `notFound()` si séjour non terminé,
  - rend `<ReviewForm bookingId requireModeration />`.
- Le formulaire (logique de soumission, sous-notes, type de voyageur) est extrait
  sans changement dans `src/components/reviews/review-form.tsx` (« use client »).
- Note honnête : `notFound()` produit un corps 404 avec statut HTTP 200 dans ce
  projet (Next dev **et** `next start`, identique à `/hebergement/<inexistant>`
  préexistant) ; l'API conserve ses 404/403/400. Il s'agit d'un comportement
  framework préexistant, pas d'une régression.

## Sécurité / finance

- Résolution du parrain 100 % côté serveur ; un code client ne peut pas forger
  `referredBy` (jamais accepté en tant qu'UUID, uniquement via résolution du code).
- Auto-parrainage impossible à l'inscription (le filleul n'existe pas encore).
- Double récompense exclue par `referral_rewarded_at` + verrous ligne.
- Montants validés par Zod et additions défensives (`Math.max(0, …)`).

## Tests

- `src/lib/referral.test.ts` (5 cas) : format/longueur/unicité des codes,
  normalisation, récompense active/désactivée/négative.
- `settings.test.ts` : clé `reviews` dans `getAllSettings`, défaut
  `requireModeration=false`, sous-objet `referral` dans le cas de validation Zod.
- Parcours E2E complets (voir rapport de validation).
