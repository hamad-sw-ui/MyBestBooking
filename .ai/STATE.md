# 🧠 ÉTAT DU PROJET (STATE)

## 📌 Identification

- **Projet** : MyBestBooking
- **Branche actuelle** : `arena/01a042cf-mybestbooking`
- **HEAD de base** : `46b2ca8`
- **PR ouverte** : #2 sur `arena/01a042cf-mybestbooking` (commit de code/garde-fous/tests validé).
- **HEAD Git** : T-127 sur `arena/01a042cf-mybestbooking`
  (commit de code `82bb283`). Le hash exact du HEAD courant est
  **à mettre à jour en fin de session** : un commit de doc ne peut pas contenir
  son propre hash, et R7 le tolère explicitement (mode toléré, 0 fail).
  Le workflow `.github/workflows/ci.yml` (T-113) reste hors suivi git de ces
  push car le jeton GitHub App n'a pas la permission `workflows`.
- **Version Framework** : AI-DOS 3.0.1
- **Dernière tâche validée** : T-127 (7e audit fonctionnel profond) —
  corrections **additives** robustesse, aucune migration :
  **P1** `POST /api/price-alerts` et `POST /api/wishlists` (ajout) vérifient
  l'existence de la propriété cible avant insertion → **404** propre au lieu
  d'un 500 par violation FK ; **P2** l'upload des **pièces jointes de
  messagerie** (`/api/uploads`) applique `sniffImageMime` (T-126) : rejet 400
  d'un non-image déguisé, MIME réel stocké ; **P3** l'export CSV de facturation
  accepte des filtres `from`/`to` validés (400 si incohérents), export complet
  par défaut. Nombreuses zones confirmées saines (réservation, rate-plans,
  messagerie, 2FA, wishlist partagée, settings, navigation).
  Validation : typecheck/lint 0, tests **251/251**, smoke **94/94**, preuves
  d'exécution P1/P2/P3 — 2026-08-28.
  Avant : T-126 (6e audit) —
  durcissements **additifs** de validation, aucune migration :
  **P1** promotions refusées à 400 si pourcentage > 100 (type `percentage`) ou
  `validUntil <= validFrom` (`.refine()` Zod POST + garde PATCH + garde
  formulaire ; le calcul reste défensif `Math.min`) ; **P2** double vote
  « utile » renvoie **409 Conflict** (vérif d'existence avant rate-limit) au
  lieu de 429, le 429 restant au spam ; **P3** upload d'image vérifie les
  **magic bytes** via `src/lib/storage/sniff.ts` (rejet 400 d'un fichier non
  image déguisé). Réponse à l'audit : la **commission hôte** (taux par
  propriété `commission_rate`, défaut 15 %, admin-only) est un mécanisme
  distinct des promotions ; elle est calculée sur le montant **après** remises,
  donc la plateforme absorbe les remises marketing.
  Validation : typecheck/lint 0 erreur, tests **251/251** (+6 sniff),
  smoke **94/94**, preuves d'exécution P1/P2/P3 — 2026-08-28.
  Avant : T-125 (5e audit) —
  modération des avis pilotée par réglage `reviews.requireModeration` (défaut
  `false` = publication immédiate historique) ; **bouclage du parrainage**
  (migration additive `0017` : `users.referred_by` + `referral_rewarded_at`,
  `referralCode` au register + `?ref=` à l'inscription, récompense idempotente
  au séjour terminé via cron, réglable `bestrewards.referral`) ; motif de
  suspension tracé dans l'audit ; page d'avis en RSC avec garde `notFound()`.
  Tests **245/245**, smoke **94/94**, ai:check **20/20** — 2026-08-28.
  Avant : T-122/T-123/T-124 (4e audit) — validation UUID des routes API
  dynamiques (400 au lieu de 500), garde de rôle `/dashboard/*` au
  plein-chargement via rôle embarqué dans le JWT + proxy edge, pages RSC par
  `[id]` en 404 propre ; migration `0016` (sessions.token → text) — 2026-08-27.
  Avant : T-121 (robustesse GET /api/properties), T-120 (robustesse API
  JSON→400), T-119, T-116, T-117, T-112/113/114/115.

## Preuves session 2026-08-27 (T-122/T-123/T-124)

- 🔨 `tsc --noEmit` 0 erreur (vérifié après rebase) · `build` production OK ·
  `lint` 0 erreur (15 warnings préexistants).
- 🧪 `vitest` : **240/240** (37 fichiers) — dont **11 cas proxy rôles**
  (customer→`/`, host admin-only→`/dashboard`, admin→200, token legacy
  toléré) et **6 cas `isUuid`**.
- ▶️ vérifié en **build de production** (`next start` :3100) ET en dev :
  - T-123 (G2) : customer sur tout `/dashboard/*` → **307 vers `/`** ; host
    sur `/dashboard/{users,settings,audit,promotions,promotions/new}` →
    **307 vers `/dashboard`** ; host sur pages hôte (properties, rooms,
    bookings, reviews, messages, analytics, billing) → **200** ; admin → 200
    partout ; anonyme → 307 `/connexion`. Customer garde ses pages voyageur
    (`/mon-compte`, `/mes-reservations`, `/mes-favoris`, `/messages`,
    `/recherche`) → 200.
  - T-122 (G1) : `/api/{rooms,properties,bookings}/abc` (+sous-routes,
    attachments, price-alerts, promotions, reviews, suspend, validate) →
    **400** ; UUID valide absent → **404** ; ressource réelle → **200**.
  - T-124 (E2) : pages RSC `dashboard/{messages,bookings}`+`rooms/calendrier`
    et `(main)/messages` avec id non-UUID → page **404 propre**, plus aucune
    erreur Postgres `22P02` dans les logs.
  - Migration `0016_sessions-token-text.sql` appliquée (colonne `token`
    varchar(255)→text, corrige l'erreur `22001` à la connexion).
- ▶️ smoke : **94/94** (aligné : promotions admin-only, host→307).
- ai:check : **20 OK / 0 warn / 0 fail**. Données de test nettoyées
  (34 réservations smoke supprimées).

## Preuves session 2026-08-27 (T-121)

- 🔨 `typecheck` 0 erreur (après rebase, `tsc --noEmit` OK) · `build` OK ·
  `lint` 0 erreur (15 warnings préexistants).
- 🧪 `npm test` : **216 réussis / 12 skip** (intégration PG) / 0 échec.
- ▶️ `npm run smoke` : **91/91** · `npm run ai:check` : **19 OK · 1 warn (R7) · 0 fail**.
- Runtime (3e audit `REPORTS/audit_fonctionnel_profond3_2026-08-27.md`) :
  F1 — `offset=-10`/`offset=abc`/`minRating=abc`/`minRating=99`/`minPrice=abc`
  → **400** (avant 500) ; `limit=-5` borné (défaut 20), `limit=2` → 2 ;
  F2 — réponse `{ properties, total, limit, offset }`, `total=8` cohérent
  (offset 0/3/99), pagination en JS après tous les filtres ;
  F3 — `currency:"EUR"` exposée avec `minPrice`.
  Non-régression : `guests=2`→8, `guests=6`→0, `guests=-5/abc`→400,
  `city=Paris`→2, `minPrice=99999`→0, prix 100–130→3, dates inversées→0,
  `minRating=9`→3, tri `price_asc` croissant [89 … 148.33].
  Page `/recherche` (SQL SSR propre) non touchée. Réservation de test
  (`MBB-2026-VAE8EX`) nettoyée.

## Preuves session 2026-08-27 (T-120)

- 🔨 `typecheck` 0 erreur · `build` OK · `lint` 0 erreur (15 warnings préexistants).
- 🧪 `npm test` : **228/228** (36 fichiers).
- ▶️ `npm run smoke` : **91/91** · `npm run ai:check` : **19 OK · 1 warn (R7) · 0 fail**.
- Runtime : corps JSON vide/mal formé sur register/bookings/reviews/wishlists/
  2fa/login/messages/promotions → **400** (avant 500) ; appels valides → 200 ;
  compte suspendu → « Ce compte est désactivé… » (401) ; `/inscription` rend le
  champ « Confirmer le mot de passe ». Réservation de test nettoyée, compte de
  test suspendu puis réactivé. Process arrêtés en fin de session.

## Preuves session 2026-08-27 (T-119)

- 🔨 `typecheck` 0 erreur · `build` OK · `lint` 0 erreur (15 warnings préexistants).
- 🧪 `npm test` : **228/228** (36 fichiers).
- ▶️ `npm run smoke` : **91/91** · `npm run ai:check` : **19 OK · 1 warn (R7) · 0 fail**.
- Runtime : `guests=6/99` → 0 hébergement (avant 8 impossibles), `guests=2` → 8,
  `guests=3` → 4 ; `guests=-5/abc` → 400 ; dates inversées → liste vide ;
  fiche Montmartre (chambre 2 ad.) → options adultes [1,2] ; home → champ
  Voyageurs 1–8 présent. Réservation de test smoke nettoyée.

## Preuves session 2026-08-27 (T-116/T-117)

- 🔨 `typecheck` 0 erreur · `lint` 0 erreur (15 warnings préexistants) · `build` OK.
- 🧪 `npm test` : **228/228** (36 fichiers).
- ▶️ `npm run smoke` : **91/91** · `npm run ai:check` : **19 OK · 1 warn · 0 fail**
  (le warn R7 porte sur ce champ HEAD, résolu par le commit de doc).
- Runtime T-116 : `GET /api/bookings/[id]/invoice` 200 owner/host/admin,
  401 anonyme, 404 inexistant ; REÇU↔FACTURE selon réglages ; base de test
  nettoyée (réservations de test supprimées, réglage billing remis par défaut).
- Process de test arrêtés en fin de session (Next :3000, Postgres :55432).

## Preuves de la session 2026-08-27

- 🔨 `typecheck` 0 erreur · `lint` 0 erreur (16 warnings préexistants) ·
  `build` 57/57 pages · migration `0015` appliquée (index
  `conversations_conversation_key_unique`).
- 🧪 `npm test` : **216/216** (3 nouveaux tests T-112
  idempotence/concurrence ; auto-skip si DB absente).
- ▶️ `npm run smoke` : **91/91** · `npm run ai:check` : **20 OK · 0 warn · 0 fail**.
- Environnement : Postgres embarqué :55432, `db:push`, seed via smoke.

## 🛠️ État technique

- Checkout invité : profil créé seulement après les règles de disponibilité/prix;
  lien `guest_claim` hashé, expirant et à usage unique pour password/session.
- Paiement : hold/intention repris par propriétaire via endpoint dédié, même clé
  idempotente, sans créer une nouvelle réservation. Les providers restent hors
  transaction DB.
- Notifications : claim, vérification et reset passent par outbox avec tentative
  immédiate; messages sont livrés immédiatement puis retryables par cron.
- Webhooks : Stripe accepte les signatures v1 de rotation et traite uniquement
  l’allowlist payment/refund. Alertes changées réinitialisent leur déduplication.
- Messages : lien dashboard réel, rate-limit auteur, MIME attachment dérivé de
  l’objet uploadé serveur.

## ✅ Preuves T-109

- 🔨 migration fraîche `0000…0014`, typecheck/build et lint 0 erreur.
- 🧪 `npm test`: **223/223** réussis.
- ▶️ guest invalide sans user, guest claim mail/session/bookings, reset alerte,
  outbox verification, Mock retrieve et Stripe signature tests.
- ▶️ `npm run smoke`: **91/91**.

## Limites résiduelles explicites

- T-110 : settings décoratifs, multi-devise/timezone, quote checkout UI,
  BestRewards/referral/promos, dates bornées et E2E/upgrade dépendances.
- Aucun compte Stripe, Resend ou S3/R2 de test : aucune intégration fournisseur
  réelle n’est déclarée validée.
- Chromium Playwright indisponible; preuves HTTP/DB/build ne sont pas E2E navigateur.

## Documents de référence

- `REPORTS/analyse_impact_2026-08-23_T109_claim_resume_operational.md`
- `REPORTS/analyse_conception_2026-08-23_T109_claim_resume_operational.md`
- `REPORTS/debat_technique_2026-08-23_T109_claim_resume_operational.md`
- `REPORTS/analyse_impact_post_2026-08-23_T109_claim_resume_operational.md`
- `REPORTS/validation_T-109_2026-08-23.md`
- `REPORTS/audit_execution_deep_post_T109_2026-08-23.md`
- `ADR/ADR-014_Claim_invite_reprise_paiement_et_webhooks.md`

---
*Mis à jour le 2026-08-23, T-109 validée; audit post-T-109 sur `400e37b`.*
