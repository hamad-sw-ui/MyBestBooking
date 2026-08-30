# Audit fonctionnel profond n°22 — T-147 — 2026-08-30

**Demande :** analyse profonde, à l'exécution, des scénarios/éléments
inachevés ou mal pensés (pages, boutons, flux), avec explication du problème
et solution **sans régression**.

Méthode : exécution réelle (DEV 3000 puis **PROD `next start` 3009**), 3 rôles
(client/hôte/admin) + anonyme. Environnement restauré (re-clone → reset
`58197c6`, install, PG 55432, db:push, seed). Données de test créées puis
nettoyées (utilisateurs de test **anonymisés** selon la convention de
suppression du projet, réservations 2028, surcharges calendaires, alerte,
conversation orpheline supprimées ; wallet client démo remis à 25,00 €).

---

## 1. Défaut corrigé (sans régression)

### 🔨 Messages d'erreur Zod en anglais sur les routes 2FA

**Fichiers :** `src/app/api/auth/2fa/{setup,verify,disable}/route.ts`.

**Problème constaté à l'exécution.** Quand un champ requis manque ou est du
mauvais type, ces trois routes renvoyaient le message Zod **anglais brut** :

```
POST /api/auth/2fa/setup   {}                         → 400 {"error":"Invalid input: expected string, received undefined"}
POST /api/auth/2fa/verify  {}                         → idem
POST /api/auth/2fa/disable {}                         → idem
```

Cause : le bloc `catch` faisait `error.issues[0]?.message ?? "Payload invalide"`.
Pour une contrainte de type/présence (message par défaut de Zod), ce texte est
en anglais (« Invalid input: expected string… »), alors que les contraintes
métier (`z.string().min(1, "Mot de passe requis")`, regex 6 chiffres, etc.)
sont déjà en français. C'est exactement l'incohérence que T-140 avait corrigée
sur les routes admin.

**Correctif (additif, homogène avec T-140) :** remplacer le message brut par
`frenchZodMessage(error)` (déjà présent dans `src/lib/http.ts`), qui conserve
les messages français personnalisés et traduit les messages Zod par défaut.
Import ajouté dans les 3 fichiers.

**Preuves à l'exécution (après correctif) :**
```
setup   {} → 400 {"error":"Valeur invalide ou manquante"}
verify  {} → 400 {"error":"Valeur invalide ou manquante"}
disable {} → 400 {"error":"Valeur invalide ou manquante"}
```
Les autres messages restent corrects : mauvais mot de passe → 401
« Mot de passe incorrect » ; mauvais code TOTP → 400 « Code invalide » ;
2FA non initialisée → 400 « 2FA non initialisée ». Le flux complet 2FA
(setup avec mot de passe → code TOTP valide → activation → login avec
`totaupCode` → désactivation avec mot de passe + code) fonctionne de bout en
bout.

**Validation :** `tsc` 0 · `eslint` 0 · `vitest` **288/288** · `smoke`
**94/94** · `build` ✓ (60 pages) · `ai:check` 19 OK / 1 warn.

---

## 2. Points vérifiés et jugés SAINS (scénarios profonds)

| Domaine | Scénario testé | Résultat |
|---|---|---|
| **Surbooking** | Chambre Supérieure (quantité 2) réservée 2× aux mêmes dates → OK ; 3ᵉ réservation → **refusée** « Cette chambre n'est plus disponible » | ✅ |
| **Nuits adjacentes** | Résa 12-14 nov (départ d'une autre = arrivée le 12) **autorisée** ; résa 11-13 qui chevauche une nuit pleine **refusée** | ✅ (logique de chevauchement demi-ouvert correcte) |
| **Propriété suspendue** | invisible dans la liste ; fiche 404 ; **réservation bloquée** 400 « Hébergement non disponible » | ✅ |
| **Wallet BestRewards** | `useWalletCredits:true` débite le wallet (25 → 0 €), plafonné au total ; un montant `walletCreditsUsed` arbitraire est **ignoré** (l'API n'accepte qu'un booléen, applique le solde plafonné) | ✅ |
| **Codes promo** | `GET /api/promotions/apply?code=&amount=` : code valide → remise calculée (BIENVENUE10 → 20 € de remise sur 200) ; code inconnu → 404 ; montant invalide → 400 | ✅ |
| **2FA (TOTP)** | setup exige le mot de passe (mauvais → 401) ; verify avec code valide active ; login sans code → 401 `twoFactorRequired:true` ; login avec `totpCode` → 200 ; disable exige mot de passe + code ; mauvais code → 401 | ✅ (sauf l'i18n corrigée §1) |
| **Parrainage** | inscription filleul avec code parrain → `referredBy` renseigné ; à la fin du séjour (cron) le filleul reçoit 5 € et le parrain 10 €, une seule fois (`referralRewardedAt`, idempotent, transactions avec verrous) | ✅ |
| **Sécurité cron/seed** | seed en **prod** exige `SEED_TOKEN` (sinon **404** pour ne pas révéler l'existence) ; cron en **prod** exige `Authorization: Bearer CRON_SECRET` (anonyme/admin/mauvais → **401**). En **dev**, l'auth est volontairement désactivée (`NODE_ENV !== "production"` → accès libre) pour faciliter l'exécution locale | ✅ (voir §3 remarque) |
| **Annulation** | devis (GET) : flexible à 842 jours → 0 € de frais, remboursement total ; annulation effective (PUT) → statut `cancelled`, `refundStatus:refunded`, montant total remboursé, avantages libérés ; **double** annulation → **409** « ne peut plus être annulée » ; annulation par un **autre** client → **403** | ✅ |
| **Disponibilité calendaire** | hôte met `availableCount:0` sur 2 jours → la réservation sur ces dates est **refusée** ; la garde propriétaire renvoie **403** à un non-propriétaire (client) | ✅ |
| **Messagerie** | `POST /api/conversations` crée/rouvre la conversation (le bouton contact redirige ensuite vers `/messages/[id]` où l'on rédige) ; `POST /api/messages` enregistre le message, met à jour `lastMessageAt` + `unreadByHost` ; message vide → 400 ; envoi par un **tiers non-participant** → **403** | ✅ |
| **Alertes de prix** | création (`maxPrice` numérique) → 201 ; doublon même seuil → idempotent (réponse identique, pas de doublon en base) ; seuil modifié → mise à jour ; seuil **négatif** → 400 « Valeur trop petite » | ✅ |
| **Page d'aide** | `/aide` rend 200 en anonyme | ✅ |

**Conclusion :** aucun scénario de réservation/paiement/fidélité/sécurité
cassé. Le seul correctif de code de cet audit est l'i18n des erreurs 2FA (§1).

---

## 3. Remarques (non bloquantes, aucune action requise sans décision)

1. **Cron en dev ouvert sans authentification.** Par construction
   (`authorized()` renvoie `true` si `NODE_ENV !== "production"`),
   `/api/cron/price-alerts` est appelable à blanc en local/dev. C'est
   **volontaire** (clôture de réservations, crédits fidélité/parrainage,
   nettoyages pendant les tests) et **sécurisé en production** (Bearer
   `CRON_SECRET`, vérifié en `next start` : 401 sans le bon en-tête). À garder
   en tête : il faut que `CRON_SECRET` soit réellement défini en production.

2. **`vercel.json` planifie le cron sans en-tête d'autorisation.** La
   planification Vercel appelle `/api/cron/price-alerts` en GET sans en-tête
   `Authorization` ; si `CRON_SECRET` est défini (recommandé), il faudra soit
   utiliser la variable d'en-tête supportée par Vercel Cron, soit laisser le
   cron public (les tâches sont idempotentes et à effets limités). Aucun
   impact local.

3. **En production sans clés Stripe**, l'étape de « reprise des paiements »
   du cron lève une erreur (« Le paiement production exige les clés Stripe »)
   qui fait répondre 500 pour l'ensemble du cron (les autres étapes —
   clôture, fidélité, alertes — ne sont pas atteintes). C'est lié à la
   **dette Stripe déjà connue/différée** (T-145) : dès que les clés sont
   configurées, cette étape devient opérationnelle. On pourrait, plus tard,
   isoler chaque étape dans un `try/catch` pour qu'une panique Stripe
   n'empêche pas la clôture des séjours — **suggestion** non urgente, non
   appliquée ici pour ne pas toucher au cycle de paiement sans clés réelles.
