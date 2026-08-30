# 🧠 ÉTAT DU PROJET (STATE)

## 📌 Identification

- **Projet** : MyBestBooking
- **Branche actuelle** : `arena/01a052ed-mybestbooking`
- **HEAD de base** : `99b4c7f` (T-151 — T-149 sur la branche sœur
  `arena/01a042cf-mybestbooking` : `304e10e` + `2d8c885`).
- **PR ouverte** : historique (PR #2) — session T-152 en cours sur
  `arena/01a052ed-mybestbooking` (suivi des commits de cette branche).
- **HEAD Git** : T-152 sur `arena/01a052ed-mybestbooking`
  (base `99b4c7f` = T-151). Le hash exact du HEAD courant est **à mettre à jour en fin de session**
  : un commit de doc ne peut pas contenir son propre hash, et R7 le tolère
  explicitement (motif « à mettre à jour en fin de session »). Le workflow
  `.github/workflows/ci.yml` (T-113) reste hors suivi
  git de ces push car le jeton GitHub App n'a pas la permission `workflows`.
- **Version Framework** : AI-DOS 3.0.1
- **Dernière tâche validée** : **T-152 (2026-08-30)** — implémentation des
  findings de l'audit n°24 (A→E + G) : A réservation `pending` actionnable
  (« Payer maintenant » + reprise auto du paiement, annulation étendue) ; B
  devise réelle `room.currency` dans le tunnel (plus de `€` dur) ; C totaux
  analytics/billing **par devise** (`currency-summary`, jamais de somme
  inter-devises) ; D sélecteur FR/EN header + `<html lang>` dynamique
  (priorité compte > localStorage > plateforme > fr) ; E état avis additif
  sur `GET /api/bookings` + badge/écran « déjà publié » ; G smoke crée sa
  wishlist. Preuves : tsc 0 · lint 0 erreur (14 warnings préexistants,
  liste identique à la baseline) · **vitest 329/329 (+13)** · smoke
  **94/94** · build OK · ai:check 19/1/0 · runtime A/B/C/D/E prouvé (détails
  `REPORTS/validation_T-152_2026-08-30.md` ; pending→confirmed/paid,
  187,00 $US, 1 121,79 €, `<html lang="en"`, « déjà publié » 9.0/10).
  Précédent : **T-151** — e-mail de
  vérification localisé à l'inscription : `language` accepté/persisté à
  l'inscription **et** au checkout invité → e-mails vérification et
  réclamation de compte localisés fr/en pour le destinataire. Preuves :
  tsc 0 · lint 0 erreur · **vitest 316/316 (+4)** · smoke **94/94** · build
  OK · runtime prouvé (guest `language=en` → « Access your booking… »).
  Rapport : `REPORTS/validation_T-151_2026-08-30.md`. Audit fonctionnel
  n°24 produit (5 findings + solutions, aucune modif de code pour A→E) :
  `REPORTS/audit_fonctionnel_profond24_2026-08-30.md` (implémenté par T-152).
  Précédent : **T-150** — e-mails hôtes ↔ clients (CTA messagerie localisé,
  `newMessage` fr/en, annulation à l'hôte) ; tsc 0 · lint 0 erreur ·
  vitest 312/312 (+13) · smoke 94/94 · build OK · runtime prouvé.
  Historique ancien conservé ci-dessous (T-133, T-145…T-149) : **T-133**
  (implémentation des remarques audit n°12) —
  **A1** le filtre de prix de la recherche comparait en EUR alors que l'affichage
  est en XAF : normalisation du prix en EUR dans le SQL (`priceBoundToStorage`
  + `CASE currency` avec cast `::numeric`) et `SearchPriceFilter` (champ caché
  `displayCurrency`, libellés FCFA) ; **A3** bouton « Contacter l'hôte » avant
  réservation (`ContactHostButton`, masqué à l'hôte sur sa propriété) ; **A4**
  photo de profil (`avatarUrl` au profil, `UserAvatar` avec repli initiales,
  exposée par `/api/auth/me`). **A2** s'est révélé être un **faux positif**
  (l'expiration des réservations `pending` impayées existe déjà :
  `expirePendingBookings` dans le cron price-alerts, prouvé
  `expiredPendingBookings=1`). Validation : tsc 0, eslint 0, vitest **273
  passés**, smoke **94/94**, build ✓, ai:check **19 OK · 1 warn · 0 fail** ;
  preuves : filtre 50000 XAF→0 / 80000→6 / 100000→8 logements, EUR hist.
  maxPrice=100→3 ; contact présent client/absent hôte ; avatar 200/400/200 —
  2026-08-28. Rapport : `REPORTS/validation_T-133_2026-08-28.md`.
  Avant : T-132 (implémentation des remarques audit n°11) —
  **Franc CFA (XAF) devient la devise d'affichage par défaut** et **la langue a
  un effet réel**. Réglage plateforme `defaultCurrency` → XAF ; nouvelle route
  publique `GET /api/app-preferences` ; hook `useDisplayPreferences` (devise
  utilisateur sinon défaut plateforme XAF, pour les anonymes aussi) ; dictionnaire
  de libellés FR/EN `ui-strings` ; `LocalizedDescription` (descriptionEn si
  langue `en`) et `LocalizedRoomPrice`. **Aucune conversion transactionnelle** :
  les chambres/paiements restent en EUR (Stripe ne supporte pas le XAF), avec
  mention « paiement en EUR ». Validation : tsc 0, eslint 0, vitest **256
  passés/12 skips**, smoke **94/94**, build ✓, ai:check **19 OK · 1 warn · 0
  fail** ; exécution : `app-preferences` → `defaultCurrency:"XAF"` anonyme,
  89 € → 58 380 FCFA, langue `en` → libellés/contenu EN (ar/fr → FR) —
  2026-08-28. Rapport : `REPORTS/validation_T-132_2026-08-28.md`.
  Avant : T-131 (11e audit fonctionnel profond) —
  la préférence **Devise** du profil était enregistrée (`users.currency`) mais
  sans aucun effet : `convertAmount`/`formatMoney` de `src/lib/i18n.ts` étaient
  du code mort (jamais importés), tous les prix restant affichés en euros via
  `formatPrice`. Correctif **additif** (aucune migration, aucune route) : nouveau
  hook client `src/lib/use-display-currency.ts` (lit `/api/auth/me`, cache
  module) ; prix d'aperçu convertis dans la devise du client dans
  `property-card-client.tsx` et `property-booking-card.tsx`, avec mention
  « Conversion indicative · paiement en <devise source> » — **jamais** de
  conversion sur les montants transactionnels (paiement/remboursement/wallet
  restent en devise chambre) ; mention honnête sous les sélecteurs devise et
  **langue** (interface reste en français en V1, `pickLocalized` inopérant en
  l'absence de dictionnaires). Audit n°11 : souhait partagé, 2FA, vérif email à
  usage unique, claim invité, promotions, plans tarifaires, calendrier dispo,
  annulation+wallet tous vérifiés **sains** à l'exécution (3 rôles + anonyme).
  Validation : typecheck/lint 0, tests **264/264**, build ✓, ai:check
  **19 OK · 1 warn R7 · 0 fail** ; `convertAmount(89,"EUR","USD")`=96,12 et
  EUR→EUR/anonyme identiques (non-régression) — 2026-08-28. Rapport :
  `REPORTS/audit_fonctionnel_profond11_2026-08-28.md`.
  Avant : T-130 (10e audit fonctionnel profond) —
  quatre « fonctionnalités fantômes » (back-end livré, inaccessible/inexact
  côté interface) corrigées de façon **additive** (aucune migration, aucune
  route nouvelle) : **P1** l'hôte n'avait aucun bouton pour clôturer un séjour
  ou marquer un no-show (`PUT /api/bookings` l'autorisait mais l'UI ne
  l'exposait pas ; le cron gratifiait alors les no-show en `completed`) →
  boutons « Terminer le séjour » / « No-show » dans `BookingRowActions`
  (gated `canManageStay` hôte/admin, gardes serveur conservées) ; **P2** le
  parrainage (T-125) était livré côté API mais son composant `ReferralCard`
  n'était monté nulle part et « Mon compte » affichait « parrainage pas encore
  ouvert » → carte montée dans l'onglet BestRewards + message corrigé ; **P3**
  aucun badge messages non lus dans la navigation → `<UnreadMessagesBadge/>`
  (réutilise `GET /api/conversations`) dans header + sidebars ; **P4** l'onglet
  Photos de l'édition d'hébergement n'avait ni upload ni galerie → upload
  fichier + galerie (définir principale/supprimer) + URL alternative.
  Validation : typecheck/lint 0, tests **264/264**, smoke **94/94**, ai:check
  **19 OK · 1 warn R7 · 0 fail** ; preuves d'exécution : host `completed`
  (fidélité posée) vs `no_show` (aucune gratification, wallet inchangé),
  boutons visibles sur confirmed/masqués en terminal, customer 307, carte
  parrainage + badge dans le bundle, galerie PUT 200 — 2026-08-28. Rapports :
  `REPORTS/audit_fonctionnel_profond10_2026-08-28.md`,
  `REPORTS/validation_T-130_2026-08-28.md`.
  Avant : T-129 (9e audit fonctionnel profond) —
  restitution des crédits wallet et de l'usage promo à l'annulation d'une
  réservation **payée**, + cohérence des capacités/prix de chambre. **P1 (finance)**
  : `booking-cancellation.ts` n'appelait `releaseBookingBenefits` que pour les
  réservations non payées → les crédits wallet d'une résa payée annulée étaient
  perdus (et l'usage promo non rendu), alors que la part carte est remboursée
  par le PSP. Preuve avant : wallet 25,00 → 0,00 après annulation. Correctif
  **additif/sans migration** : appel inconditionnel de `releaseBookingBenefits`
  (idempotent via `benefitsReleasedAt` + transaction `FOR UPDATE`, sans contact
  PSP → aucun double remboursement carte ; couvre aussi les résa 100 % wallet).
  **P2/P3** : helper `src/lib/room-validation.ts` (adultes ≤ capacité,
  adultes+enfants ≤ capacité, prix > 0, quantité ≤ 99) appliqué à POST/PUT
  rooms (PUT sur le résultat fusionné) → 400 ; garde miroir formulaire.
  Validation : typecheck/lint 0, tests **264/264** (+6), smoke **94/94**,
  ai:check **19 OK · 1 warn R7 · 0 fail** ; preuve d'exécution wallet
  25→0→25 après annulation, idempotence 409, chambres incohérentes 400/valide
  201, PUT 400/200 — 2026-08-28. Rapports : `REPORTS/audit_fonctionnel_profond9_2026-08-28.md`,
  `REPORTS/analyse_impact_T-129_2026-08-28.md`, `REPORTS/validation_T-129_2026-08-28.md`.
  Avant : T-128 (8e audit fonctionnel profond) —
  verrou de pages en mode maintenance. En maintenance les écritures API
  étaient bien bloquées (503) mais un chargement direct de page répondait 200
  avec le contenu normal (la redirection RSC n'émet pas de 307 fiable au
  plein-chargement, comme constaté pour les rôles en T-123). Solution
  **additive** : route publique `GET /api/maintenance-status` (`{active}`),
  logique pure `src/lib/maintenance-gate.ts`, et composant client
  `<MaintenanceGate/>` monté dans le layout racine qui force
  `window.location.replace("/maintenance")` au montage (donc aussi en
  plein-chargement), sauf admin / whitelist anti-verrouillage (`/maintenance`,
  auth, assets). Les 503 API et gardes RSC restent en défense de profondeur.
  Validation : typecheck/lint 0, tests **258/258** (+7 gate), smoke **94/94**,
  exécution route d'état + simulation de redirection — 2026-08-28.
  Avant : T-127 (7e audit fonctionnel profond) —
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
