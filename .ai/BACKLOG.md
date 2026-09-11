# 📋 BACKLOG

> **Actions à faire**, distinct de `FEATURES.md` (inventaire de ce qui
> existe) et `BUGS.md` (défauts). Un item de backlog devient une tâche
> `T-xxx` dans `CURRENT_TASK.md` quand elle est démarrée.
>
> Réécrit intégralement en Session 5 après ADR-006. Les items 🔴/🟠
> corrigés en Sessions 3-4 ont été retirés.

## Légende
- 🔴 **P1** — bloquant pour ouvrir aux vrais utilisateurs
- 🟠 **P2** — important pour l'usage quotidien
- 🟢 **P3** — confort, backlog non urgent

---

## Session courante

Voir `CURRENT_TASK.md` pour la tâche active.

### Audit T-210 (2026-09-10) — suites non bloquantes proposées

- ✅ ~~**T-211 (L/P3)** — Ajouter un wrapper `site:audit:prod` qui lance `next start`, attend `/api/health`, exécute `scripts/site-audit.mjs`, puis stoppe le serveur.~~ **Livré 2026-09-10** : `npm run site:audit:prod` exécute `build → next start → /api/health → site-audit → cleanup`, port configurable et `--skip-build` disponible. Preuve : 247 pages / 0 issue.
- 🟢 **T-212 (S/P3)** — Ajouter une carte optionnelle sur `/recherche` à partir des coordonnées existantes. La liste et les filtres actuels restent la source principale ; la carte doit échouer en silence avec fallback liste.
- 🟢 **T-213 (S/P3)** — Compléter les preuves HTTP par un pack Playwright navigateur quand Chromium est disponible : accueil → recherche, recherche → fiche, fiche → demande, hôte confirme/refuse, messagerie, dashboard mobile.
- 🟠 **T-214 (S/P2)** — Préparer un environnement staging avec providers réels isolés (Resend, stockage objet, webhooks signés) pour valider les intégrations externes sans réactiver de paiement voyageur plateforme.

### Suite de l’analyse produit du 2026-09-10 (commission hôte, avis, statuts)

- ✅ ~~**T-215 (L/P2)** — Rendre la commission d'un hôte éditable par l'admin pour **tout** statut d'approbation (et non seulement à l'approbation), avec impact annoncé et propagation explicite aux hébergements.~~ **Livré 2026-09-10** : action `updateCommission` de `PATCH /api/admin/hosts/[id]` + `GET` d'aperçu + éditeur sur `/dashboard/users` ; corrige au passage `propertyCount` (BUG-050). Preuve : 642 tests verts, runtime documenté dans `REPORTS/validation_T215_T216_2026-09-10_commission_hote_statuts_reservation.md`.
- ✅ ~~**T-216 (L/P2)** — Permettre à l'hôte/admin de gérer le statut d'une réservation **depuis la liste** `/dashboard/bookings` (elle n'offrait qu'un badge), en réutilisant la FSM existante.~~ **Livré 2026-09-10** : `BookingStatusSelect` + `availableTransitions()` dérivé de `transitionError()`, audit `booking.status.update`, aucune nouvelle route. Même rapport de validation.

### Remédiations issues de l’audit post T-107 (à arbitrer avant implémentation)

- 🔴 **T-108 (C)** — frontières publiques/RBAC, DTO RSC de recherche,
  annulation financière admin, suppressions/agrégats transactionnels et 2FA
  locale/réauthentifiée. Couvre BUG-035/036/037, migration additive et tests de
  sécurité négatifs.
- 🔴 **T-109 (C)** — saga d’annulation/reprise paiement, outbox unifiée,
  claim checkout invité, messagerie hôte et politique de timezone/devise. Couvre
  le noyau financier et compte de BUG-038.
- 🔴 **T-110 (S/P0)** — JSON-LD script-safe, journal refund crash-safe,
  consommation claim atomique et retrait des promesses commerciales non
  implémentées. Voir audit profond post T-109.
- 🟠 **T-111 (C/P1)** — chiffrement TOTP, devise/ledger, timezone/dates,
  inventaire compatible booking et settings réellement appliqués.
- 🟠 **T-112 (S/P2)** — referral/promos, ~~conversations uniques~~ ✅
  (validé 2026-08-27, tests idempotence/concurrence, voir
  `REPORTS/validation_T-112_2026-08-27.md`), rétention, support/ticketing,
  UX restantes, navigateur CI et upgrade dépendances.

#### Écarts fonctionnels relevés à l'exécution (audit 2026-08-27, voir
`REPORTS/audit_fonctionnel_2026-08-27_execution.md`)

- 🔵 ~~**T-113 (L/P2)** — Upload des photos d'annonce~~ ✅ livré 2026-08-27 :
  `POST /api/properties/upload` (image publique, host/admin) + stockage
  `PublicLocalUploader`/S3 + `<input type=file>` dans `properties/new`
  (URL gardée en alternative). Voir rapport d'audit fonctionnel.
- 🔵 ~~**T-114 (L/P3)** — Page `/bestrewards` personnalisée~~ ✅ livré
  2026-08-27 : `<BestRewardsStatus>` affiche niveau réel, séjours, wallet et
  code de parrainage (`/api/auth/me` + `/api/users/me/referral`) ; bug
  d'affichage des réductions `${...}` corrigé.
- ⚪ ~~**T-115 (L/P3)** — Sous-notes d'avis~~ ✅ livré 2026-08-27 : 6 critères
  (propreté, confort, emplacement, équipements, accueil, rapport qualité-prix)
  alimentent les champs déjà acceptés par `POST /api/reviews`.
- ⚪ ~~**T-116 (C/P2)** — Factures légales~~ ✅ livré 2026-08-27 :
  `GET /api/bookings/[id]/invoice` produit un document HTML imprimable
  (→ PDF via le navigateur, zéro dépendance). Réglages `billing` étendus
  (raison sociale, SIREN/SIRET/RCCM, n° TVA, adresse, email, préfixe,
  pied de facture) éditables dans le panneau admin. Si ces mentions ne
  sont pas renseignées, le document est un **« REÇU »** portant la mention
  explicite « non conforme facturation légale » ; dès que société + n°
  légal sont saisis, il devient **« FACTURE »** numérotée. Accès réservé
  au voyageur propriétaire, à l'hôte du bien et à l'admin (401 anonyme,
  404 inexistant). Vérifié à l'exécution (200 owner/host/admin, bascule
  REÇU↔FACTURE). Aucune fausse facture fiscale tant que non configuré.
- ⚪ ~~**T-117 (T/P3)** — Régénérer `PRODUCT_ACCEPTANCE.md`~~ ✅ fait
  2026-08-27 : parcours réévalués sur l'exécution réelle (smoke 91/91,
  curl, tests). Couverture P1 fonctionnelle ~100 % ; restent hors-code la
  validation Stripe réelle et les E2E Playwright (Chromium indisponible).
- ⚪ ~~**T-119 (L/P2)** — Corrections d'audit fonctionnel (recherche & CTA)~~
  ✅ livré 2026-08-27, suite à l'audit profond `REPORTS/audit_fonctionnel_profond_2026-08-27_T116.md` :
  - **A1** : `GET /api/properties?guests=N` exclut désormais les hébergements
    dont aucune chambre n'a la capacité demandée (le LEFT JOIN laissait
    passer des résultats `roomCount=0` impossibles à réserver).
  - **A2** : `guests` invalide (négatif, non numérique) → **400** explicite ;
    dates de séjour incohérentes (départ ≤ arrivée) → liste vide au lieu
    d'ignorer le filtre.
  - **B1** : la carte de réservation borne le sélecteur d'adultes à la
    capacité réelle de la chambre (`maxAdults` propagé), au lieu de 1–6 figé.
  - **B2** : sans chambre disponible, le CTA affiche « Aucune chambre
    disponible » (désactivé) au lieu de rediriger en silence vers /recherche.
  - **B3** : la barre de recherche de la page d'accueil a un champ
    « Voyageurs » (1–8), déjà compris par /recherche.
  Toutes non régressives (champs optionnels, validation additive) ; B4
  (taux d'occupation analytics) reste en backlog.
- ⚪ ~~**T-120 (L/P2)** — Robustesse API & finitions auth (2e audit)~~
  ✅ livré 2026-08-27, suite à l'audit
  `REPORTS/audit_fonctionnel_profond2_2026-08-27.md` :
  - **D1** : un corps JSON vide/mal formé sur les routes d'écriture
    provoquait une fausse erreur **500** (`SyntaxError` de
    `request.json()` non capturée). Désormais toutes les routes répondent
    **400** « Corps de requête invalide ou manquant » (garde-fou
    `instanceof SyntaxError` devant le test ZodError, sur les 32 routes
    d'écriture). Le chemin valide est inchangé.
  - **E1** : formulaire d'inscription enrichi d'un champ
    « Confirmer le mot de passe » avec vérification client (et `pattern`
    HTML) — aucune modification d'API.
  - **E2** : un compte suspendu (soft-delete **réversible**) affichait
    « Ce compte a été supprimé » à la connexion → reformulé
    « Ce compte est désactivé. Contactez le support pour le réactiver. »
- ⚪ ~~**T-121 (L/P2)** — Robustesse GET /api/properties + pagination/devise (3e audit)~~
  ✅ livré 2026-08-27, suite à l'audit
  `REPORTS/audit_fonctionnel_profond3_2026-08-27.md` :
  - **F1** : paramètres numériques de `GET /api/properties` faisaient 500
    (`?offset=-10` → « OFFSET must not be negative », `?minRating=abc` → cast
    SQL échoué) ou étaient ignorés (`?limit=-5`). Désormais `limit` borné
    (1–100, défaut 20), `offset` négatif/non numérique → **400**,
    `minRating`/`minPrice`/`maxPrice` non numériques ou hors bornes → **400**.
  - **F2** : réponse enrichie `{ properties, total, limit, offset }` ; la
    pagination est appliquée APRÈS tous les filtres (prix JS, disponibilité,
    distance, capacité) pour que `total` et la tranche soient cohérents.
    Champs additifs (aucun appelant cassé).
  - **F3** : chaque propriété expose `currency` (devise de la chambre la
    moins chère) avec `minPrice`.
  Non régressif : guests/ville/prix/dates/tri vérifiés à l'exécution ; page
  `/recherche` (SQL SSR propre) non touchée. B4 (taux d'occupation) reste
  en backlog.
- ⚪ **T-118 (T/P3)** — FEATURES.md annonçait un composant `<ImageUploader>`
  (`src/components/ui/image-uploader.tsx`) inexistant ; corriger la doc.

### Chantiers Sessions 5-7 (livrés)

- ✅ **T-011** Framework v1.1.0 — livré Session 5
- ✅ **T-012** Vérification disponibilité + chevauchement bookings — livré
- ✅ **T-013** Emails transactionnels (Resend/SMTP dev) — livré
- ✅ **T-014** Uploads d'images (adapter S3-compatible + local) — livré
- ✅ **T-015** Vague API mutations manquantes — livré
- ✅ **T-016** UI compte + endpoints mineurs — livré
- ✅ **T-017** SEO + a11y + CSP + BUG-016 — livré
- ✅ **T-018** Éditeur calendrier hôte — livré
- ✅ **T-019** Tests intégration + Playwright specs — livré
- ✅ **T-020** Paiement Stripe test-mode + webhook — livré
- ✅ **T-021** Panel d'administration configurable + UI suspend user
  (Session 7, ADR-007)
- ✅ **T-022** Câblage effectif du mode maintenance (Session 7)
- ✅ **T-023** Modération d'avis admin (endpoint + UI, recalcul
  atomique averageRating) (Session 7)
- ✅ **T-024** Table `audit_log` globale + endpoint + page + hooks
  4 handlers admin (Session 7)
- ✅ **T-025** Templates emails éditables via `app_settings` (Session 7)
- ✅ **T-026** Recherche & filtres avancés (amenities, guests, dates,
  sort, near) + upload delete + price alerts + referral (Session 8)
- ✅ **T-027** Emails cancellation/newMessage + wallet + BestRewards
  discount + delete account (Session 8)
- ✅ **T-028** Rate-limits bookings/reviews/wishlists + logger
  structuré (Session 8)
- ✅ **T-029** 2FA TOTP + i18n EN + devise dynamique + dark mode +
  guest booking + attachments messages + skip link a11y + rotation
  secret docs (Session 8)

### Sandbox-limited restants (documenté FEATURES.md)

Chacun activable en 1 commit ou 1 clic dès que la contrainte disparaît :

- 🟢 `next/font/google` — CDN Google indispo au sandbox build
- 🟢 Playwright Chromium — CDN Google indispo
- 🟢 CI GitHub Actions — permission `workflows` manquante sur token
- 🟢 Dependabot — activation UI GitHub
- 🟢 Rate-limit Redis — mono-instance suffit V1
- 🟢 Dockerfile prod — pas requis Vercel/Node
- 🟢 Backup DB auto — dépend de l'hébergeur

### Backlog UX/métier non prioritaire

- 🟢 Comparateur d'hébergements
- 🟢 Rendu carte Mapbox/Leaflet (endpoint `?near=` déjà livré)
- 🟢 Analytics avancées ADR/RevPAR
- 🟢 PDF invoice (dépend prestataire compta)
- 🟢 Cron notification price_alerts (job planifié)

---

## Sécurité résiduelle

- 🟠 Rate-limit sur `/api/bookings`, `/api/reviews`, `/api/wishlists`
  (utilisateur connecté peut spammer aujourd'hui)
- 🟢 Rate-limit Redis (multi-instance) — remplace le Map en mémoire
- 🟠 CSP fine (`Content-Security-Policy`) dans `next.config.ts`
- 🟢 CSRF token explicite (double-submit) sur formulaires HTML
- ✅ Support du 2FA TOTP côté réglages et connexion ; ajouter davantage de
  tests E2E autour de la récupération reste souhaitable.
- 🟠 Procédure documentée de rotation `JWT_SECRET` et `CREDENTIALS_ENCRYPTION_KEY` en cas de fuite

## Base de données & performance

- 🟢 Index composé sur `bookings (roomId, checkIn, checkOut)` pour
  accélérer les recherches de disponibilité (T-012 va en avoir besoin)
- 🟢 Pagination + tri stables (tie-breaker par `id`) partout où on
  paginee (aujourd'hui : `properties`, `bookings`, `reviews`)
- 🟢 Cache RSC (`revalidateTag`, `unstable_cache`) sur la liste des
  properties « populaires » de la home

## UI / UX

- ✅ **T-180 (P1)** — Impasse « Ajouter mon hébergement » : lien footer
  contextuel (hôte/admin → dashboard inchangé ; voyageur/anonyme →
  `/inscription?role=host` avec rôle pré-coché). Audit 12 zones : cycle
  promotions intégral, facture, CSV, parrainage, suspension, reset mdp…
  → sains. 470 tests · smoke 94/94 · runtime par rôle validé.
- 🟠 Dark mode + toggle
- 🟠 i18n réelle (`next-intl`) — le modèle DB supporte déjà
  `descriptionEn`, `users.language`, `users.currency`
- 🟠 `useToast` réellement utilisé dans les formulaires (aujourd'hui
  monté mais jamais appelé)
- 🟠 `Modal` réellement utilisée pour confirmations destructives
- ✅ Mode invité au checkout ; email déjà associé exige une connexion.
- ✅ Filtre par équipements (`amenities`) côté API ; UI de recherche à exposer.
- 🟢 Comparateur d'hébergements

## Dashboard hôte étendu

- 🟠 Analytics complémentaires : ADR, RevPAR et export CSV. Le taux
  d'occupation de base est déjà calculé avec les chambres actives.
- 🟠 Notifications email/webhook sur nouvelle réservation (T-013 + T-015)
- ✅ Édition d'une property disponible ; renforcer validation et UX mobile.
- 🟢 Édition d'une room complète et calendrier avancé.

## Idées produit

- 🟢 Carte géographique (Mapbox/Leaflet) sur `/recherche` et fiche
- ✅ ~~Programme parrainage lié à `walletBalance`~~ **livré T-125** (2026-08-28) : `referred_by` + `referral_rewarded_at` (migration 0017), `referralCode` au register + `?ref=` à l'inscription, récompense idempotente au séjour terminé (parrain/filleul, réglable `bestrewards.referral`). Voir `REPORTS/validation_T-125_2026-08-28.md`.
- 🟢 Réductions réelles BestRewards sur properties `isBestrewards:true`
- 🟢 Monitoring/observabilité du cron d'alertes prix et de clôture des séjours (le handler idempotent est livré T-102).
- ✅ Système d'avis de base ; votes « utile » restent à améliorer.

## Observabilité & prod

- ✅ **T-181…T-185 (P1, 2026-09-02)** — Accélération mesurée et livrée :
  cache lecture 60 s (recherche sans dates, fiche publique), headers HTTP
  API conditionnels, requêtes parallélisées, `npm run perf`. 2 idées
  écartées après mesure (optimizer images : egress Unsplash absent du
  sandbox ; optimizePackageImports : 0 octet). `/recherche` 84→12 ms.
- 🟠 Sentry (ou équivalent) branché sur les 5xx et erreurs client
- 🟠 Logs structurés JSON (pino) au lieu de `console.error`
- ✅ Migrer les visuels seed vers local + optimizer activé — **livré T-186**
  (2026-09-02) : `public/seed-images/` (23 JPG), `seedImageUrl`, optimizer
  ON (−86 % mesuré). Reste : 3 visuels dédiés pour remplacer les alias
  (dest-tunis, hero, placeholder) au prochain créneau quota.
- 🟠 Dockerfile prod + `docker-compose.yml` pour parité dev/prod
- 🟠 Runbook incidents (DB HS, paiement HS, `JWT_SECRET` fuité)
- 🟢 Backup DB automatique + procédure de restore testée
- 🟢 Dependabot ou Renovate branché

## Framework `.ai/` (jaunes reportés en Session 4)

- 🟢 **F** Étendre R17 pour vérifier plus finement PROGRESS.md
- 🟢 **G** Ajouter dans INDEX.md une note « pour lire le manifest,
  voir `npm run ai:check` »
- 🟢 **H** Clarifier DEVLOG (notes libres) vs PROGRESS (journal formel)
- 🟢 **I** Remplacer les refs commit en dur `4ad8884` dans les docs
  vivantes par « commit initial »
- 🟢 **J** Étendre R9 (liens Markdown) à `ADR/`, `REPORTS/`, `PROMPTS/`,
  `LOGS/`
- 🟢 Hook Git `pre-commit` qui lance `npm run ai:check`
- 🟢 R18 : chaque `PAR-xxx` de `PRODUCT_ACCEPTANCE.md` doit avoir un
  test Playwright associé
- 🟢 R19 : chaque nouveau endpoint API doit avoir un test d'intégration
- 🟢 Vérifier que `EXPECTED_ENDPOINT_TABLES` du manifest reste aligné
  avec `src/db/schema.ts` (test dédié Vitest)

## Documentation publique

- 🟢 Screenshots dans le README
- 🟢 Vidéo de démo
- 🟢 CHANGELOG.md (auto-généré depuis `git log`)
- 🟢 `LICENSE` (annoncée « projet privé » mais aucun fichier)
- 🟢 `SECURITY.md` racine (policy de divulgation responsable)
- 🟢 `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`
- 🟢 OpenAPI / Swagger auto-généré pour `/api/*`

---

### Audit 4 (2026-08-27) — `REPORTS/audit_fonctionnel_profond4_2026-08-27.md`

- ✅ ~~**T-122 (L/P2)** — G1 : routes API dynamiques → **500 sur id non-UUID**~~
  **LIVRÉ** 2026-08-27. Helper `isUuid()` ajouté dans `src/lib/http.ts` ;
  garde-fou `if (!isUuid(id)) → 400` en tête de **tous** les handlers dynamiques
  (`rooms/[id]` GET/PUT, `rooms/[id]/{rate-plans,availability}`, `properties/[id]`
  GET/PUT + `validate`, `bookings/[id]` GET/PUT + `{invoice,cancellation,payment}`,
  `messages/attachments/[id]`, `price-alerts/[id]`, `promotions/[id]` PATCH/DELETE,
  `reviews/[id]/{helpful,reply,moderate}`, `users/[id]/suspend`). UUID valide
  absent → reste **404** ; id mal formé → **400**. Tests `src/lib/http.test.ts`.
- ✅ ~~**T-123 (S/P2)** — G2 : la **garde de rôle des pages `/dashboard/*` ne
  s'appliquait pas au plein-chargement**~~ **LIVRÉ** 2026-08-27 (vérifié en
  build de production). Le JWT embarque désormais le `role`
  (`createToken(userId, exp, role)`, `createSession` lit le rôle en base) ;
  `src/proxy.ts` applique la garde par segment au chargement direct :
  customer → 307 `/` ; host sur sections admin-only
  (`users`,`settings`,`audit`,`promotions`) → 307 `/dashboard` ; host/admin
  sur leurs sections → 200. Anciens tokens (sans claim role) tolérés
  (proxy laisse passer, gardes RSC tranchent). Colonne `sessions.token`
  passée en `text` (migration `0016_sessions-token-text.sql`) car le JWT
  avec rôle dépassait varchar(255) (erreur 22001). Tests `src/proxy.test.ts`
  (11 cas). Gardes RSC conservées en 2e couche.
- ✅ ~~**T-124 (L/P3)** — E2 : pages RSC par `[id]`~~ **LIVRÉ** 2026-08-27 :
  validation UUID avant SQL dans `dashboard/messages/[id]`,
  `dashboard/bookings/[id]`, `dashboard/rooms/[id]/calendrier`,
  `(main)/messages/[id]` → `notFound()` propre, plus aucune erreur Postgres
  `22P02` dans les logs.
- ℹ️ **Confirmé (produit)** : la promotion est **admin-only** (page ET API,
  403 pour un host). C'est cohérent avec la sidebar admin ; le smoke a été
  aligné (host → 307 sur `/dashboard/promotions*`).

### Audit 27 (2026-08-30) — `REPORTS/audit_fonctionnel_profond27_2026-08-30.md`

- ✅ ~~**T-155 (P2)** — `POST /api/bookings` : code promo inconnu → **409**~~
  **LIVRÉ** 2026-08-30 : `PromoCodeNotFoundError` → **400** (le 409 reste
  réservé aux conflits d'état : expiré, épuisé, règles, wallet). Vérifié
  `curl promoCode=NOPE277` → 400.
- ✅ ~~**T-155 (P3)** — recherche `?amenity=` muet pour `tv`/`minibar`~~
  **LIVRÉ** 2026-08-30 : le filtre matche `properties.amenities` **OU**
  `rooms.amenities` (`OR EXISTS`) — 8 propriétés chacun (avant 0),
  `zzz` → 0, `pool` inchangé.
- ✅ **T-155 (harnais)** — resynchronisation des garde-fous sur les
  contrats réels (guest mode `/reservation`, 2FA `password`, upload privé,
  mails par `To:`, register 400/409) + robustesse (nettoyage réentrant
  smoke, timeouts/retry runner). Runner unifié : **396 OK · 3 WARN ·
  0 KO** · tsc 0 · vitest 372/372.

### Audit 28 (2026-08-30) — `REPORTS/audit_fonctionnel_profond28_2026-08-30.md` (~~à arbitrer~~ ✅ traité — voir section Audit 29)

> ⚠️ **Resynchronisation T-190 (2026-09-02)** : cette section était restée
> marquée « à arbitrer » alors que T-156→T-159 ont été implémentés et
> validés le même jour (section « Audit 29 » ci-dessous). Conservée pour
> l'historique ; ne pas re-traiter ces items.

- 🔴 ~~**T-156 (P1)** — Annulation par l'hôte~~ ✅ **CORRIGÉ (VALIDÉ)**
  2026-08-30 (voir section Audit 29).
- 🟠 ~~**T-157 (P2)** — Identité voyageur en mode connecté~~ ✅
  **CORRIGÉ (VALIDÉ)** 2026-08-30 (voir section Audit 29).
- 🟠 ~~**T-158 (P2)** — i18n vague 1 fiche propriété + help-center~~ ✅
  **CORRIGÉ (VALIDÉ)** 2026-08-30 (voir section Audit 29).
- 🟢 ~~**T-159 (P3)** — Hygiène purge/settings~~ ✅ **CORRIGÉ (VALIDÉ)**
  2026-08-30 (voir section Audit 29).

### Audit 29 (2026-08-30) — `.ai/REPORTS/audit_fonctionnel_profond29_2026-08-30.md` (implémenté + validé)

- T-156 **CORRIGÉ (VALIDÉ)** — acteur sur `cancelBooking` (host/admin → fee 0,
  refund intégral, motif forcé, mail plateforme) ; quote hôte du bien/admin ;
  UI hôte dédiée. Voyageur inchangé. Preuves : probes 30/30 + 8 tests.
- T-157 **CORRIGÉ (VALIDÉ)** — `bookingGuestIdentity()` : identité du compte
  (payload invité ignoré) ; UI lecture seule + encart. Guest mode inchangé.
- T-158 **CORRIGÉ (VALIDÉ)** — i18n vague 1 fiche propriété (boutons,
  formulaire d'avis, métadonnées via cookie langue) + sélecteur de devise
  publique EUR/USD/GBP/XAF (priorité compte > localStorage > plateforme).
- T-159 **CORRIGÉ (VALIDÉ)** — `purge-sim-data.mjs` (dry-run) ; PATCH settings
  merge + erreurs sans `issues` ; 400 vs 409 par code de règle ; 2 tests de
  validation corrigés (property BR/non-BR, mocks auth complets).
- Preuves : 🔨 tsc 0 · 🧪 vitest **57 fichiers / 390 tests** · ▶️ sims
  **5/5 · 396 OK · 0 KO** · ▶️ probes **30/30** · ✅ ai:check.

### Audit 30 (2026-08-30) — `.ai/REPORTS/audit_fonctionnel_profond30_2026-08-30.md` (~~rapport seul, à arbitrer~~ ✅ implémenté + validé)

> ⚠️ **Resynchronisation T-190 (2026-09-02)** : cette section était restée
> marquée « à arbitrer » alors que T-160→T-166 ont été implémentés le
> 2026-08-30 (PROGRESS, session 49) — vérifié par probes runtime le
> 2026-09-02 : re-POST d'alerte avec arrivée 2020 → **400** ; token de
> partage invalide → **404** ; `confidentialite`/`mentions-legales`
> servies en EN avec le cookie langue ; `purge-sim-data.mjs` couvre
> votes/wishlists/alertes. Conservée pour l'historique ; ne pas
> re-traiter ces items.

- 🟠 ~~**T-160 (P2)** — Favoris : purge + N+1 + compteur~~ ✅ **livré
  2026-08-30** : `purge-sim-data.mjs` + `cleanup_db`, jointure/
  déduplication (`src/app/api/wishlists/route.ts`), tests
  `wishlist-utils.test.ts (T-160)`.
- 🟠 ~~**T-161 (P2)** — Alertes prix : dates passées~~ ✅ **livré
  2026-08-30** : `isStayPast`/`isStayExpired` (`price-alert-rules.ts`),
  POST → 400, cron `expirePastStayAlerts` (probe runtime 2026-09-02).
- 🟠 ~~**T-162 (P2)** — i18n vague 2 (5 pages)~~ ✅ **livré 2026-08-30** :
  `getServerLocale`/`makeT` + métadonnées (probes EN 2026-09-02 :
  « Privacy policy », « Legal notice »).
- 🟢 ~~**T-163 (P3)** — Token partage invalide~~ ✅ **livré 2026-08-30** :
  `notFound()` dans `generateMetadata` (probe 404 le 2026-09-02).
- 🟢 ~~**T-164 (P3)** — Sélecteur devise SSR~~ ✅ **livré 2026-08-30** :
  `UiLocaleProvider` amorcé par `getServerLocale` — pas de flash FR.
- 🟢 ~~**T-165 (P3)** — E-mails liens relatifs~~ ✅ **livré 2026-08-30** :
  `src/lib/app-url.ts` (`appBaseUrl()` + repli) + tests `app-url.test.ts`.
- 🟢 ~~**T-166 (P3)** — Hygiène runs~~ ✅ **livré 2026-08-30** :
  `purge-sim-data.mjs` étendu (votes/alertes/wishlists de sims).

### T-217 (2026-09-10) — correctifs P1–P10 de l'audit runtime

- ✅ ~~**Soft-404** : pages `notFound()` en 200~~ **Livré** : squelettes de
  chargement au niveau feuille (`components/page-loading.tsx`) ; matrice prod
  8 URL → 404 / 18 pages → 200 ; smoke 95/95.
- ✅ ~~**Édition hébergement client-only**~~ **Livré** : RSC + `notFound()` +
  props initiales ; édition/upload/commission inchangés.
- ✅ ~~**Modération des avis sans UI**~~ **Livré** : section « Avis » dans
  `/dashboard/settings` (avis `pending` quand activée).
- ✅ ~~**Reçus des séjours passés**~~ **Livré** : `BookingRowActions` dans les
  cartes « Passées » ; carte billing renommée « Versements et relevés ».
- ✅ ~~**Promotions non éditables**~~ **Livré** : `/dashboard/promotions/[id]`,
  plafonds `null` = illimité, `currentUses` conservé.
- ✅ ~~**Chambres** : route d'édition absente / édition enfouie~~ **Livré** :
  redirection `/dashboard/rooms/[id]` → `/calendrier#room-edit` + libellé dédié.
- ✅ ~~**Fil de messagerie vide introuvable**~~ **Livré** : fenêtre de
  rattrapage de 7 jours (compteurs non-lus inchangés).
- ✅ ~~**Audit limité à 100 lignes / code mort**~~ **Livré** : « Charger plus »
  branché sur `GET /api/admin/audit` ; 3 composants orphelins `@deprecated` et
  documentés.
- ✅ ~~**Navigation admin sans Chambres**~~ **Livré** : entrée ajoutée
  (desktop + mobile).

#### Sujets résiduels proposés (non bloquants, audit T-217)

- ✅ ~~**T-219 (S/P3)** — Clarifier l'export CSV de la carte billing~~ **Livré
  2026-09-10** : libellés « Export CSV (versements) » (carte billing) et
  « Export CSV (réservations) » (liste des réservations) ; routes inchangées.
- ⛔ **T-218 (S/P3)** — ~~Notifier l'hôte par e-mail à la création d'une
  conversation~~ **Non retenu (2026-09-10)** : `POST /api/messages` notifie déjà
  le destinataire (T-027) ; un e-mail au seul ouvrir d'un fil vide serait une
  notification sans contenu. Le rattrapage du fil non écrit est traité par P7
  (fenêtre de 7 jours dans `/messages`).
- 🟢 **T-220 (S/P3)** — Préférences de notification par utilisateur
  (`user_notification_prefs`) : aujourd'hui seul `priceAlertEnabled` est
  individuel, le reste est global (`app_settings.notifications`).

### Audit T-221 (2026-09-10) — fonctionnalités inachevées ou mal pensées

Analyse complète : `docs/analyse_2026-09-10_audit_runtime_inacheves.md` (11 constats A1→A11,
6 observations O1→O6). Ordre d'implémentation retenu : A1+A2 → A6+A7+A8 → A3+A4 → A5+A9+A10+A11.

> **Les onze constats A1→A11 sont livrés et validés (2026-09-10)** — preuve :
> `npm run ci` verte (typecheck 0 · lint 0 · i18n 0 · **vitest 691 tests** · build ·
> smoke) et vérifications runtime sur serveur réel (échéance affichée, expiration sans
> e-mail, interrupteurs d'e-mails, parrainage, avis notifiés, édition de chambre,
> horaires/fuseau persistés et validés, labels refusés à l'hôte en PUT **et** POST,
> libellé du fil par acteur, `suspended_at` distinct de `deleted_at`, codes de secours
> 2FA testés en bout en bout : activation → connexion → non-réutilisation →
> désactivation).

- ✅ ~~**T-221 (M/P1)** — *A1 — échéance des demandes de réservation.* `requestExpiresAt` (TTL 24 h)
  n'est affiché nulle part et l'expiration (`expireManualBookingRequests`) n'envoie aucun e-mail ;
  `stats.bookings.pending` est calculé mais jamais rendu sur `/dashboard`. Livrable : échéance sur
  `/mes-reservations` + `/dashboard/bookings`, carte « Demandes à traiter » (hôte/admin), e-mail
  d'expiration idempotent. Preuve : sonde `MBB-2026-1PRF1S` (`requestExpiresAt` renvoyé, 0 mention
  dans la page).
- ✅ ~~**T-222 (M/P1)** — *A2 — séjours échus non réglés.* `completed` est refusé sans
  `paymentStatus = paid` ; la constatation n'existe que sur la fiche ; aucun filtre/colonne
  « Règlement », aucune relance. Livrable : vue « À constater » (départ ≤ aujourd'hui),
  colonne Règlement, action de ligne, rappel hôte J+1, compteur admin.
- ✅ ~~**T-223 (S/P2)** — *A3 — interrupteurs d'e-mails sans UI.* `notificationsSchema` (7 booléens,
  défauts `true`) est lu par 5 modules mais absent de `settings-panel.tsx` (0 occurrence) ;
  `newsletter` n'est lu nulle part. Livrable : section « Notifications » ; trancher le sort de
  `newsletter`.
- ✅ ~~**T-224 (S/P2)** — *A4 — parrainage non réglable.* `bestrewards.referral`
  (`enabled`/`referrerAmount`/`refereeAmount`) n'a pas de champs dans la section BestRewards alors
  que le programme est affiché dans `/mon-compte`.
- ✅ ~~**T-225 (M/P2)** — *A5 — avis sans notification.* Aucun `enqueueEmail` dans
  `src/app/api/reviews/**` : l'hôte ignore la publication, l'auteur ignore l'issue de la
  modération. Livrable : `review-published` / `review-moderated`, optionnels (liés à T-223).
- ✅ ~~**T-226 (M/P2)** — *A6 — édition de chambre incomplète.* Le `PUT` accepte description, type,
  lits, surface, devise, équipements, photos ; `RoomEditSection` n'en envoie que 7 champs, figés
  après création.
- ✅ ~~**T-227 (S/P2)** — *A7 — horaires arrivée/départ.* `check_in_from` / `check_in_until` /
  `check_out_until` sont affichés sur la fiche (repli 14:00/23:00/11:00) mais absents des API et
  des formulaires. Livrable : acceptation POST/PUT + champs d'édition (+ `timezone`).
- ✅ ~~**T-228 (M/P2)** — *A8 — labels non administrables.* `isEcoCertified` n'est écrit nulle part
  (badge inatteignable) ; `isBestrewards`/`isPreferred` ne sont écrits que par le seed
  aléatoirement, alors que `isBestrewards` majore la remise BestRewards de 2 points.
- ✅ ~~**T-229 (S/P3)** — *A9 — fil depuis le back-office.* Libellé `book.writeHost` sur la fiche
  réservation hôte/admin (il écrit au voyageur) ; l'admin reçoit **403** (prouvé : admin 403 /
  hôte 201 / voyageur 201). Livrable : libellé par acteur + décision explicite sur l'admin.
- ✅ ~~**T-230 (M/P2)** — *A10 — suspension vs suppression.* Les deux écrivent `deleted_at` ; l'UI
  admin affiche « Suspendu » + « Réactiver » sur un compte anonymisé (sonde : réactivation 200,
  email `deleted-…@anonymized.local` conservé). Livrable : `suspended_at` (+ raison), UI à deux
  états, refus 409 de réactivation d'un compte anonymisé, migration des suspensions existantes.
- ✅ ~~**T-231 (M/P1)** — *A11 — 2FA sans secours.* Désactivation = mot de passe + code TOTP ; aucun
  code de secours, aucun reset support (le seul reset est l'anonymisation). Livrable : codes de
  secours hachés à usage unique + action admin tracée `user.2fa.reset` (+ révocation de sessions,
  e-mail d'information).

#### Observations (à trancher, hors lots ci-dessus)

- 🟢 **O1** — Portefeuille sans journal ni débit : décider d'une consommation (avoir au règlement
  sur place) avec `wallet_transactions`, ou geler le programme explicitement.
- 🟢 **O2** — Calendrier d'indisponibilité sans affichage des réservations couvrant la date.
- 🟢 **O3** — Pas de vue admin de `email_outbox` (statuts `pending`/`failed`/`sent`).
- 🟢 **O4** — Avis non modifiable/non supprimable par son auteur (seul l'admin masque).
- 🟢 **O5** — Pas de fiche utilisateur admin (vue 360° support).
- 🟢 **O6** — Pas d'export CSV dans `/dashboard/analytics`.


### Audit n°5 (2026-09-11) — exécution : parcours métier et fins de parcours

Analyse complète : `docs/analyse_2026-09-11_audit_runtime_execution.md` (copie
`.ai/REPORTS/analyse_runtime_n5_2026-09-11_execution.md`) — 8 constats A1→A8, tous vérifiés au
runtime (promos, stop-sell, réponses d'avis, heure d'arrivée, alertes prix, disponibilité de
chambre, favoris, messagerie, matrice de rôles, analyse croisée des 66 endpoints appelés par l'UI).
Aucune ligne de code produit modifiée par l'analyse ; base remise à l'état seed (contrôles SQL en
§5 du rapport : `review_votes` 0, `price_alerts` 0, `stop_sell` 0, `bookings` 35).

- ✅ ~~**T-245 (M/P2) — *A2 — aucune pagination sur les écrans de liste.***~~ Les pages RSC
  `dashboard/bookings`, `users`, `reviews`, `properties`, `promotions` et `mes-reservations` n'ont
  aucun `.limit()` (grep : 0 occurrence) et chargent la totalité des lignes ; `GET /api/bookings` et
  `GET /api/messages` renvoient toutes les lignes alors que `GET /api/reviews` et
  `GET /api/properties` sont paginés (clamp 1–100, prouvé : `?limit=1000` → `limit=100`) ;
  `audit-filter.tsx:27` documente lui-même « pas de pagination API ». Invisible sur le seed
  (8 users / 35 réservations / 26 avis) = mur de charge. Livrable : pagination **côté page** pour les
  écrans RSC (`?page=N`, 25 lignes, composant `Pagination` partagé, compteur « X résultats ») et
  pagination **opt-in** des API (`limit`/`offset` ignorés si absents → corps inchangé, en-tête
  `X-Total-Count`, bornes identiques à `/api/properties`). Tests de contrat « sans paramètre =
  réponse actuelle » + bornes (`limit=0/-1`, `offset=-1` → 400).
  **Livré (variante retenue : fenêtre progressive, pas de `?page=N`)** : filtres, tri et compteurs
  des 6 écrans étant **côté client**, un paginateur aurait restreint les filtres et faussé les
  compteurs. `parsePageWindow` (défaut 25, +25, plafond 500, `queryLimit = size + 1`) et
  `<ShowMore>` (compteur « N sur M », « Afficher 25 de plus », « Tout afficher », avertissement de
  plafond, note de périmètre) branchent les 6 pages RSC ; l'API est **opt-in**
  (`GET /api/bookings`, `GET /api/messages` : sans paramètre la réponse historique est identique,
  avec `limit` 1-100 / `offset` ≥ 0 et `X-Total-Count` ; bornes invalides → 400). Verrou i18n
  1688 → **1693**. Preuves : runtime (`/dashboard/bookings` → « 25 résultats affichés sur 30 »,
  `?limit=50` → 30/30 sans bandeau, `limit=5` → 5 lignes + `X-Total-Count: 30`, `limit=0/-3/abc/1.5`
  et `offset=-1` → 400) et tests `page-window` 11/11.
- ✅ ~~**T-246 (M/P2) — *A1 — favoris : multi-listes à moitié câblé.***~~ `GET /api/wishlists` ne trie
  pas (0 `orderBy`) alors que le cœur écrit dans `wishlists[0]` (`use-wishlist-toggle.ts:138`) et
  que `/mes-favoris` affiche par `createdAt desc` → le favori peut atterrir dans une autre liste que
  celle affichée, sans choix possible ; `updateWishlistSchema` (`.strict()`) refuse `name` → pas de
  renommage ; aucun retrait/déplacement d'un favori depuis `/mes-favoris`. Livrable : tri stable +
  `defaultWishlistId`, `name` optionnel dans le PATCH (+ UI de renommage), sélecteur de liste dans le
  cœur (défaut = comportement actuel), action « déplacer » transactionnelle. Ajouts additifs, verrou
  i18n mis à jour.
  **Livré** : `GET /api/wishlists` trié (`createdAt`, `id`) et expose `defaultWishlistId` (le cœur
  n'utilise plus un `wishlists[0]` implicite) ; `PATCH` accepte `name` (1-80, `trim`) sans toucher au
  partage ; nouveau `POST /api/wishlists/move` transactionnel (insertion cible puis suppression
  source, 404 si liste d'un tiers ou favori absent de la source, 400 si listes identiques ou bien
  déjà présent) ; UI : « Choisir une liste » sur le cœur (≥ 2 listes), « Déplacer vers une liste »
  sur `/mes-favoris`, renommage dans `WishlistActions`. Verrou i18n 1693 → **1706** ; tests `route.t246.test.ts` 4/4.
- ✅ ~~**T-247 (S/P2) — *A3 — motifs de modération en `window.prompt` et facultatifs.***~~ Trois écrans
  admin (`review-moderate-actions.tsx:40`, `user-suspend-actions.tsx:63`,
  `property-validate-actions.tsx:25`) utilisent le dialogue natif (aucune validation, aucun style,
  dismiss silencieux, bloqué dans certains environnements) et `moderationReason` est `optional`
  (`reviews/[id]/moderate/route.ts:16`) → un avis `hidden`/`rejected` peut l'être sans motif (e-mail
  à l'auteur et `audit_log` sans raison). Livrable : composant `Dialog` réutilisable (rôle, focus,
  Esc, compteur 500 car.) remplaçant les 3 `prompt` sans changer les appels réseau, et
  `superRefine` : motif obligatoire pour `hidden`/`rejected` (400 via `issues`), `approved`/`pending`
  inchangés. Tests route (400 sans motif) + dialogue + trace `audit_log.metadata.reason`.
  **Livré** : `Dialog` accessible (rôle, `aria-modal`, piège de focus, Esc, verrouillage du scroll,
  retour du focus) et `ReasonDialog` (motif obligatoire, compteur 0/500, envoi bloqué si vide) ;
  les 3 `window.prompt` ont disparu (`grep` = 0) ; `reviews/[id]/moderate` refuse `hidden`/`rejected`
  sans motif (400, `issues.field = moderationReason`, motif conservé dans `audit_log`). Verrou i18n
  **1683 → 1688** ; tests route 8/8, `reason-dialog` 4/4.
- ✅ ~~**T-248 (M/P2) — *A6 — wallet sans journal (reprise de O1).***~~
  `users.walletBalance` est muté par 4 familles de code (clôture manuelle, cron cashback/parrainage/
  remboursements, `booking-benefits`, `booking-request-expiration`) sans aucune trace ; depuis T-207
  (`useWalletCredits` ignoré, `walletUsedEur = 0`) le solde BestRewards ne peut **jamais** être
  dépensé, alors que 3 écrans l'affichent comme un avantage. Livrable : table append-only
  `wallet_transactions` (migration **0023**, montant EUR, `kind`, `booking_id`, `balance_after`)
  écrite **dans les transactions existantes** (balance inchangée = source de vérité), historique des
  20 derniers mouvements dans `/mon-compte`, puis décision produit : avoir au règlement sur place
  (`markPaidOffline`) **ou** gel explicite du programme. Tests : « 1 crédit = 1 ligne », idempotence
  du rejeu de cron, soldes inchangés après clôture manuelle et expiration.
  **Livré (étapes 1 et 2 ; étape 3 = décision produit ouverte)** : migration **0024**
  `wallet_transactions` (append-only, `amount` signé EUR, `balance_after`, `kind`, `booking_id`,
  `actor_id`, `note`) écrite **dans les 4 transactions existantes** (`booking-benefits`,
  `booking-request-expiration`, cron : cashback + bonus filleul + bonus parrain) ; `users.wallet_balance`
  reste la source de vérité ; `GET /api/wallet/transactions` (lecture seule, 20 derniers, pagination
  opt-in) et carte « Historique des mouvements » dans `/mon-compte`. Verrou i18n 1728 → **1739**.
  Preuves : `wallet-ledger` 5/5 (dont « solde = somme des lignes » et « une erreur de journal annule
  le solde »), `cron/price-alerts/route.t248.test.ts` 3/3 (clôture → 1 ligne de 5,00 EUR, rejeu
  idempotent → toujours 1 ligne, trace `cron_runs` écrite), runtime `GET /api/wallet/transactions`
  200/401/400). **Décision produit tranchée (2026-09-11) : gel explicite du programme.** Aucun code de
  consommation n'est ajouté ; les libellés qui parlent du solde annoncent un **crédit futur** gelé
  (`account.walletHint`, `account.availableBalance`, `search.walletBanner`,
  `reservation.walletReductionNote`, `bestrewards.benefitCashback`, `bestrewards.how3Desc`,
  `bestrewards.faq4A`, FR et EN) et `src/lib/wallet-policy.test.ts` (3 tests) verrouille la décision :
  il échoue si les libellés cessent d'annoncer le gel ou si une déduction (`applyWalletToTotal`)
  réapparaît. Décision inscrite dans `KNOWN_LIMITATIONS.md`. Verrou i18n inchangé (**1739** : valeurs
  modifiées, aucune clé ajoutée).
- ✅ ~~**T-249 (S/P3) — *A4 — tri ignoré en silence.***~~ **FAIT (2026-09-11)** : `GET /api/properties?sort=…` inconnu → 200 avec
  tri `rating` par défaut (`route.ts:216`) alors que les 4 autres filtres écartés déclenchent un
  bandeau (T-175, `search-warnings.ts`). Livrable : warning `sortIgnored` + clé
  `search.warn.sortIgnored` (verrou i18n 1682 → **1683**, le verrou comptant les clés FR), API inchangée (tolérance conservée),
  test `search-warnings.test.ts` (inconnu/`Price_Asc`/blanc → `["sortIgnored"]` ou `[]`, 4 valeurs connues → `[]`).
  **Livré** : `sortIgnored` ajouté à `SearchWarning` + liste blanche `SORT_VALUES`, clé FR/EN, verrou 1683 ;
  23 tests ciblés verts (`search-warnings`, `ui-strings`, `api-error`, `messages`).
- ✅ ~~**T-250 (S/P3) — *A7 — tâches planifiées sans trace.***~~ Le cron `price-alerts` exécute 14
  opérations (rappels J-3/J-1, demandes d'avis, clôtures, expirations, alertes prix, purge
  technique) et n'écrit **aucune** trace (0 `recordAudit`) ; `/api/health` ne teste que PostgreSQL →
  un cron muet (URL/clé/panne) est invisible. Livrable : table `cron_runs` (`name`, `started_at`,
  `finished_at`, `ok`, `duration_ms`, `counters` JSONB, `error_message`) écrite en fin d'exécution
  **et** dans le `catch`, écran admin « Tâches planifiées » (dernier passage, âge, compteurs, badge
  rouge au-delà de 2× la période), purge intégrée à `purgeTechnicalData()` (T-243).
  **Livré** : migration **0023** `cron_runs` ; `runWithTrace(name, task, countersOf)` enveloppe le
  corps du cron (trace best-effort : une panne de la table ne casse jamais la tâche métier) ;
  `getCronHealth()` (`ok` / `stale` au-delà de 3 périodes / `failed` / `missing`) exposé par
  `/api/health` (`cronStatus` + `crons[]`, additif, HTTP 200 conservé) et par l'écran
  `/dashboard/cron` (lien sidebar + menu mobile) ; purge 90 jours dans `purgeTechnicalData()`.
  Preuves : `cron-trace` 5/5, `cron/price-alerts/route.t248.test.ts` 3/3, runtime (`/api/health`
  → `cronStatus: missing` avant exécution, `ok` avec compteurs et durée après ; page 200 pour
  l'admin, redirection pour un voyageur). Verrou i18n 1706 → **1728**.
- ✅ ~~**T-251 (XS/P3) — *A5 — messagerie : introuvable et interdit partagent le 403.***~~ **FAIT (2026-09-11)** :
  `checkParticipant()` renvoie `null` dans les deux cas → `GET /api/messages` répond
  « Accès refusé » même pour un UUID inexistant (prouvé). Le cloisonnement est correct (aucune fuite)
  mais un lien périmé est indiscernable d'un refus.
  **Livré (variante retenue, alignée sur `/messages/[id]`)** : `checkParticipant` renvoie un résultat
  discriminé (`not_found` / `forbidden` / `ok`) → **404** « Conversation introuvable »
  (`code: CONVERSATION_NOT_FOUND`) pour une conversation absente, **403** « Accès refusé »
  (`code: CONVERSATION_FORBIDDEN`) inchangé pour un tiers ; traduction EN ajoutée
  (`api-error.ts`), UUID non devinable (aucune énumération facilitée), GET et POST couverts.
- ✅ ~~**T-252 (XS/P3) — *A8 — hygiène T-207.***~~ **FAIT (2026-09-11)** : `applyWalletToTotal()` (`wallet-currency.ts:28`) n'a
  plus aucun appelant applicatif (seul son test l'exerce) et `useWalletCredits` (accepté puis ignoré)
  n'est pas recensé dans `KNOWN_LIMITATIONS.md`. Livrable : suppression de la fonction et de son
  test **ou** annotation `@deprecated` + inscription dans les « surfaces inactives » ;
  `useWalletCredits` documenté avec la décision T-207.

Confirmations de la même campagne (aucune ligne de BACKLOG ajoutée pour elles, à ne pas rouvrir) :
`DELETE /api/price-alerts/[id]` fonctionne (200 / 404 / 400) et l'UI `/mes-favoris` est complète ;
`PUT /api/rooms/[id]/availability` fonctionne avec le corps `{ days: [...] }` par l'hôte propriétaire ;
`/api/auth/verify` n'est pas une route morte (lien des e-mails `register`/`resend-verification`) ;
stop-sell réellement appliqué (recherche 8 → 7, page sans la fiche, devis et réservation 409) ;
réponse d'hôte publiée et visible sur la fiche ; heure d'arrivée présente dans les 2 e-mails ;
promos valides/en minuscule/sous minimum/inconnues → 200/200/400/404 ; **0 bouton mort** (66 endpoints
UI ↔ routes), **0** `TODO/FIXME`, **0** `href="#"`. La rétention technique (T-243) et l'export
analytique (T-241/O6) sont déjà livrés.

### Audit n°6 (2026-09-11) — pages, boutons et fonctionnalités inachevés ou mal pensés

Analyse : `docs/analyse_2026-09-11_audit_runtime_inacheves_mal_penses.md` (copie
`.ai/REPORTS/analyse_runtime_n6_2026-09-11_inacheves.md`). Sixième passe d'exécution : 45 pages
balayées avec les 3 rôles (0 erreur applicative), 71 routes API, 90 appels UI ↔ routes,
confrontation **schéma ↔ API ↔ formulaires**, `email_outbox` relue, et mesure de l'état de
supervision après insertion d'une trace `cron_runs` datée de −4 h (ligne supprimée ensuite).
**12 constats B1→B12**, aucune ligne de code modifiée, base rendue à l'état seed. Lots à trancher
(oui/non) :

| Lot | Constats | Contenu | Risque | Effort |
|---|---|---|---|---|
| **A** | B1, B2, B3, B11 | Supervision cron juste (cadence déclarée = `vercel.json`), cron `payouts` planifié sans trace ni écran, base URL unique des e-mails (`appBaseUrl()` partout), squelettes de chargement manquants | Très faible | ~1 session |
| **B** | B4, B5, B6 | Fenêtres de liste (`/dashboard/messages`, `/dashboard/rooms` + N+1 par bien), page « tous les avis » + compteur sur la fiche, champs éditables (`description_en`, `state`, `latitude`/`longitude`) | Faible | 1–2 sessions |
| **C** | B7, B9 | Exposer `sort=popularity` / `minRating` / `near` / `search` ; préférences de notification par utilisateur (`users.notification_prefs`, `null` = héritage global) | Faible / moyen | 1–2 sessions |
| **D** | B8, B10, B12 | Crédit gelé signalé et journalisé à la suppression de compte (**sans consommation**), résidus T-207 récapitulés, rate-limit en mémoire documenté au déploiement | Faible | ~0,5 session |

Détail par constat (problème, preuve d'exécution, correctif non régressif, tests et i18n) : § 3 du
rapport ; vérifications saines à ne pas rouvrir : § 4 (0 bouton mort, 0 texte en dur, 0 route sans
contrôle justifié, 12/12 interrupteurs d'e-mail lus, expiration T-203 intacte).

Numérotation de suivi : **B1→T-253**, **B2→T-254**, **B3→T-255**, **B11→T-256**, **B4→T-257**,
**B5→T-258**, **B6→T-259** (lot B), lot C **B7→T-260**, **B9→T-261**, lot D **B8→T-262**,
**B10→T-263**, **B12→T-264**.

- ✅ ~~**T-253/T-254/T-255/T-256 (lot A — B1, B2, B3, B11).**~~ **FAIT (2026-09-11, commit `11165d4`)** :
  cadence `price-alerts` alignée sur l'ordonnanceur réel (24 h), `/api/cron/payouts` déplanifié de
  `vercel.json` (410 quotidien tant que `platformPayoutsEnabled()` est faux, exécution manuelle via
  `scripts/cron-runner.mjs`), base URL unique des e-mails (`appBaseUrl()` dans 10 fichiers — seul
  `verify/route.ts` garde la sienne, justifié en commentaire), squelette `loading.tsx` limité aux
  feuilles (`(main)/mon-compte`). Tests `cron-schedule` 3/3, `app-url-usage` 2/2, `cron-trace`
  recalculé. 0 clé i18n ajoutée.
- ✅ ~~**T-257 (M/P2) — *B4 — deux écrans de liste hors fenêtre + N+1 côté hôte.***~~ **FAIT
  (2026-09-11)** : branche hôte de `/dashboard/rooms` réécrite en **une** jointure `rooms ⋈ properties`
  (fin du `for (const prop of hostProperties)`), `countRooms()` + `parsePageWindow`/`<ShowMore>` sur
  `/dashboard/rooms` **et** `/dashboard/messages`, `conversationScope()` partagé par la liste et le
  compteur de conversations. Preuves : `list-window.t257.test.ts` **3/3** (23 chambres → aucun bandeau ;
  26 lignes → « 25 résultats affichés sur 26 » ; messages 26 fils idem). 0 clé i18n ajoutée (`show.*`
  déjà présentes en T-245).
- ✅ ~~**T-259 (M/P2) — *B6 — des champs affichés que personne ne peut remplir.***~~ **FAIT
  (2026-09-11)** : `descriptionEn` (≤ 4 000) entre dans les schémas POST/PUT et dans l'éditeur (onglet
  Informations, avec la phrase de repli FR), `state` est bornée à 100 (colonne `varchar(100)` : une
  saisie trop longue finissait en 500) et saisissable **à la création** et dans l'éditeur, et
  `latitude`/`longitude` sont validées (−90..90 / −180..180, virgule décimale acceptée puis normalisée,
  `""` ⇒ `null`) avec saisie dans l'éditeur et affichage sans zéros inutiles
  (`src/lib/coordinates.ts`). La page `[id]` transmet désormais les quatre colonnes à l'éditeur —
  sans quoi l'enregistrement les aurait **effacées**. Verrou i18n **1742 → 1748** (+6). Preuves :
  `route.t259` **4/4** (persistance, bornes, effacement, création), `coordinates` **3/3**, sonde
  runtime (PUT « 43,769 » → `43.76900000`, relecture « 43.769 », valeurs du seed restaurées).

- ✅ ~~**T-258 (M/P2) — *B5 — cinq avis pour toujours, sans le dire.***~~ **FAIT (2026-09-11)** :
  compteur (`property.reviewsCount`) dans l'en-tête « Avis vérifiés ✓ » de la fiche, lien « Voir les N
  avis » (`property.reviewsSeeAll`) dès que `totalReviews > 5`, **nouvelle page**
  `/hebergement/[slug]/avis` (20 avis/page, `?page=`, `generateMetadata`, mêmes règles de visibilité
  que la fiche, 404 sinon), bloc d'avis extrait dans le composant partagé `PropertyReviewsList`
  (markup inchangé). Titre de la page = clé orpheline `property.reviews` enfin utilisée. Verrou i18n
  **1739 → 1742** (+3 : `property.reviewsCount`, `property.reviewsSeeAll`,
  `property.backToProperty`). Preuves : `reviews-page.t258.test.ts` **3/3** (bien à 24 avis : compteur,
  lien, fiche toujours bornée à 5 ; page 1 = 20 lignes avec `?page=2`, page 2 = fin de liste ; slug
  inconnu → `notFound()`).

### Audit T-242 (2026-09-10) — audit de profondeur (analyse n°4)

Analyse : `docs/analyse_2026-09-10_audit_runtime_profondeur.md` (copie
`REPORTS/analyse_runtime_n4_2026-09-10_profondeur.md`). 24 cas × 5 identités (120 requêtes), base
remise à l'état seed. Trois constats nouveaux ; les autres confirment avec preuves chiffrées les
tâches T-232 → T-241 (renvois en fin de section).

- ✅ ~~**T-242 (M/P1)** — *N1 — anonymisation partielle à la suppression de compte.* `DELETE
  /api/users/me` anonymise `users` (e-mail haché, nom effacé, 2FA purgée, sessions supprimées)
  mais conserve l'identité dans `bookings.guest_email/guest_first_name/guest_last_name`,
  `email_outbox.to` et `audit_log.metadata.targetEmail` (vérifié : `targetEmail` en clair dans la
  trace de suspension d'un compte supprimé). Livrable : UPDATE ciblés dans la transaction
  d'anonymisation (agrégats comptables intacts), + test « aucune occurrence de l'adresse d'origine
  après DELETE ». Recoupe T-230 (séparation `suspended_at` / `deleted_at`).
- ✅ ~~**T-243 (S/P2)** — *N2 — aucune purge des données techniques.* `sessions` expirées,
  `email_outbox` livrés et `audit_log` ne sont jamais purgés (27 sessions en base après campagne
  de sondes, 0 créée par le seed ; six `delete(sessions)` tous événementiels). Livrable :
  `purgeTechnicalData()` en fin de cron (sessions expirées > 7 j, outbox > 90 j hors `pending`,
  rétention d'audit documentée) + compteurs `sessionsPurged` / `emailsPurged` dans la réponse cron.
  Prépare O3 (vue admin de l'outbox).
- ✅ ~~**T-244 (S/P2)** — *N3 — stock affiché ≠ stock vendable.* `GET /api/rooms/[id]/availability`
  renvoie le stock **déclaré** sans soustraire les séjours (prouvé : 24–26/09 « 2 disponibles »
  pour une chambre à 2 unités dont 1 est réservée), alors que le tunnel applique bien les
  chevauchements. Livrable : champ additif `bookedCount` + affichage « reste X / déclaré Y » dans
  `AvailabilityCalendar` ; le tunnel reste l'autorité. Ferme O2 avec une information juste.

Confirmations apportées par la même campagne (aucune ligne de BACKLOG modifiée) : dates et fuseaux
(C1 → T-232), suspension d'hôte et sort des demandes en attente (C2 → T-233), expiration paresseuse
(C3 → T-234), quota compté avant validation (C4 → T-235), heure d'arrivée jamais restituée et
`z.string()` sur colonne `time` (C5 → T-236), fuseau décoratif et liste fermée incohérente
(C6 → T-227), analytics figé 30 jours (C7 → T-241 b). Vérifié sain : matrice de permissions,
révocation de session, bénéfices rendus à l'annulation, idempotence e-mail, anti-double vote,
`POST /api/seed` fermé hors environnement démo, brouillons/wishlists privées en 404.

### Audit T-232 (2026-09-10) — scénarios runtime (analyse n°3)

Analyse complète : `docs/analyse_2026-09-10_audit_runtime_scenarios.md` (copie
`.ai/REPORTS/analyse_runtime_n3_2026-09-10_scenarios.md`) — 13 constats F1→F13, tous vérifiés
au runtime (sondes HTTP + PostgreSQL, fuseaux `UTC`/`Africa/Douala`/`America/Los_Angeles`/
`Pacific/Kiritimati`, crawl par rôle, analyse statique des boutons). Les intersections avec
l'audit n°2 sont signalées (F3↔T-221, F9↔T-227, F11↔T-230, F12↔O6). Aucune ligne de code produit
modifiée par l'analyse.

Rapport de validation : `REPORTS/validation_T232_T234_2026-09-10_dates_suspension_expiration.md`
(T-232 + T-233 + T-234 + volet T-240).

- ✅ **T-232 (M/P1) — FAIT (2026-09-10)** — *F1 + F10 + F9 — dates de séjour et fuseaux.* `formatDate()` formate les
  colonnes `date` sans `timeZone: "UTC"` : le même séjour s'affiche « 24 septembre » en UTC et
  **« 23 septembre »** à Los Angeles (reproduit), le rendu SSR pouvant différer du client ; `pg` lit
  une `date` à minuit **local du serveur** (`TZ=Africa/Douala` → `2026-09-23T23:00Z`), ce qui rend
  `toDate()` (`booking-lifecycle.ts:14-16`) et donc la clôture/éligibilité d'avis dépendantes du
  fuseau de l'instance ; `users.timezone`/`properties.timezone` sont collectés et **jamais lus**,
  et `PATCH /api/users/me` accepte `"Pas/Un-Fuseau"` (200, vérifié). Livrable : helper unique
  d'affichage des dates civiles (UTC), lecture `date` normalisée (mode string) pour les
  comparaisons métier, validation IANA du fuseau, usage effectif (ou retrait) du réglage, tests
  multi-fuseaux. Aucune migration destructive.
- ✅ **T-233 (M/P1) — FAIT (2026-09-10)** — *F2 — suspension d'hôte sans effet sur ses annonces.* Après
  `PATCH /api/users/[id]/suspend`, la fiche `/hebergement/appartement-montmartre` répond **200** et
  le bien reste dans `/recherche?city=Paris` alors que l'hôte ne peut plus se connecter (401
  « Ce compte est désactivé… ») — prouvé au runtime. Livrable : cascade `active → suspended` en
  transaction (statut antérieur conservé), filtre `users.deleted_at IS NULL` dans les requêtes
  publiques, traitement des demandes en attente + e-mail d'information, restauration à la
  réactivation, test « suspension → invisible → réactivation → visible ».
- ✅ **T-234 (M/P2) — FAIT (2026-09-10)** — *F3 — demande en attente bloquant les dates sans expiration paresseuse.*
  Le contrôle de chevauchement ignore `pending` (`ne(status,'cancelled')`, `api/bookings/route.ts:220-232`) :
  une 2ᵉ demande sur les mêmes dates reçoit **409** (reproduit), la libération dépendant du cron
  quotidien (`vercel.json`, 08:00 UTC). Livrable : extraction de la purge d'expiration en fonction
  partagée, appel **dans la transaction** de devis/création pour la chambre et la fenêtre
  demandées (le cron reste), test d'intégration « demande expirée → nouvelle réservation
  acceptée ».
- ✅ **T-235 (S/P2) — FAIT (2026-09-11)** — *F4 — quota de réservation punissant les erreurs de saisie.* Rate-limit
  10/h par utilisateur (10 par IP pour les invités) appliqué **avant** la validation
  (`api/bookings/route.ts:158-162`) : 6 essais invalides puis une demande correcte → **429**
  (reproduit deux fois), message sans délai, quota partagé derrière une IP publique. Livrable :
  compteur déplacé après validation (ou compteurs séparés), message avec `Retry-After`, clé invité
  par cookie plutôt qu'IP seule, documentation `KNOWN_LIMITATIONS.md`.
  **Livré** : garde-fou 60/h par clé posé **avant** lecture du corps, quota produit 10/h consommé
  **après** validation (une saisie invalide ne le consomme plus), clé invité = cookie signé
  `mbb_guest` (repli IP), 429 avec `Retry-After` + « réessayez dans N minute(s) » localisé,
  `KNOWN_LIMITATIONS.md` complété. Tests : `rate-limit.test.ts` 15/15,
  `bookings/route.t235.test.ts` 3/3 (6 essais invalides ne bloquent plus la demande valide).
- ✅ **T-236 (S/P2) — FAIT (2026-09-11)** — *F5 — heure d'arrivée estimée jamais restituée.* `bookings.estimated_arrival`
  est saisie au tunnel (select heures pleines) et **aucun affichage** ne la relit (fiche hôte,
  e-mails, espace voyageur) ; l'API accepte n'importe quelle chaîne (`z.string()`) alors que la
  colonne est `time` (erreur PostgreSQL possible, vérifié). Livrable : affichage sur la fiche
  réservation hôte + variable dans les e-mails de demande/confirmation, validation `HH:MM`.
  **Livré** : validation `HH:MM` à l'entrée (`bookings/route.ts`), affichage sur la fiche hôte
  **et** dans l'espace voyageur (`mes-reservations`), variable `estimatedArrival` dans les 4
  e-mails (demande + confirmation, voyageur et hôte), libellés FR/EN. Tests :
  `booking-arrival-time.test.ts` 3 + `mail/templates.t236.test.ts` 4.
- ✅ **T-237 (S/P2) — FAIT (2026-09-11)** — *F6 — validation/rejet d'annonce non notifié, motif invisible.*
  `/api/properties/[id]/validate` écrit `reason` dans `audit_log` uniquement (aucun `enqueueEmail`,
  aucune colonne motif) ; l'hôte voit un statut « draft » sans explication. Livrable : gabarits
  `propertyApproved`/`propertyRejected` (idempotents, interrupteurs `notifications`), colonne
  additive `properties.review_reason` affichée dans l'éditeur hôte.
  **Livré** : migration `0022_property_review_reason.sql` (`properties.review_reason`, appliquée),
  `notifyHostOfDecision` idempotent (`eventKey` déterministe, interrupteurs dédiés, best-effort),
  motif persisté au rejet/suspension et **effacé à l'approbation**, bannière motif dans l'éditeur
  hôte, gabarits FR/EN. Tests : `validate/route.t237.test.ts` 3/3.
- ✅ **T-238 (XS/P2) — FAIT (2026-09-11)** — *F7 — wishlist partagée indexable, sans expiration.*
  `/wishlists/share/[token]` expose `title`/`description` sans `robots: { index: false }` alors que
  les 14 autres surfaces privées le déclarent ; `share_token` sans échéance ni rotation.
  Livrable : noindex, régénération du lien (« invalider l'ancien »), mention dans l'UI de partage.
  **Livré** : `robots: { index: false, follow: false }` sur `/wishlists/share/[token]` (la
  dernière surface privée qui ne le déclarait pas), mention de partage + infobulle de rotation
  dans l'UI, rotation `PATCH /api/wishlists` (`rotateShareToken`) désormais **testée** : ancien
  lien → 404, nouveau → 200. Tests : `route.t238.test.ts` 2/2.
- ✅ **T-239 (S/P2) — FAIT (2026-09-11)** — *F8 — désabonnement promis mais inexistant.* La page Confidentialité
  annonce « désabonnement possible depuis l'onglet Notifications » alors que seule
  `priceAlertEnabled` est exposée et qu'aucun e-mail ne porte de lien d'opposition. Livrable :
  corriger la formulation, puis préférences par catégorie (`user_notification_prefs` ou JSONB)
  alimentant les envois non transactionnels + lien d'opposition en pied d'e-mail.
  **Livré** : formulé corrigé dans `/confidentialite` (FR/EN : ce qui est refusable, ce qui reste
  dû), `src/lib/unsubscribe.ts` (jeton **HMAC-SHA256** `userId|catégorie`, vérification à temps
  constant, registre `UNSUBSCRIBE_CATEGORIES`), page publique `/desabonnement` (noindex, `GET`
  depuis l'e-mail, idempotente, message générique si jeton invalide), pied d'opposition dans
  l'alerte prix (le seul envoi non transactionnel), section Notifications du compte inchangée
  comme voie alternative. Décision : pas de table `user_notification_prefs` pour une seule
  catégorie — le registre est le point d'extension (voir `KNOWN_LIMITATIONS.md`). Tests :
  `unsubscribe.test.ts` 4/4, `desabonnement/page.t239.test.ts` 2/2.
- ✅ **T-240 (S/P3) — FAIT (2026-09-10)** — *F9/F10 (volet fuseau serveur) — tests de
  non-régression multi-fuseaux sur `transitionError`/`isReviewEligible`
  (`TZ=Africa/Douala`, `Pacific/Kiritimati`) ajoutés, et « aujourd'hui » métier centralisé sur
  une date d'horizon explicite (`civilToday("UTC")`) dans `sendPaymentReminders`, `future-stay`,
  `room-remaining`, `search-warnings`.*
- ✅ **T-241 (S/P3) — FAIT (2026-09-11)** — *F11 + F12 + F13 — finitions : (a) « Supprimé » vs « suspendu » dans
  l'admin (à fusionner au correctif T-230 : `suspended_at` distinct, bouton « Réactiver » masqué
  sur un compte anonymisé) ; (b) analytics : sélecteur de période + export CSV (reprend O6) ;
  (c) erreurs d'API : `issues` détaillées en complément du message et schémas de mutation
  `.strict()` (le `PUT` accepte aujourd'hui un champ inconnu en 200 silencieux, vérifié).
  **Livré** : (a) déjà couvert par T-230 (colonnes `suspended_at`/`deleted_at` distinctes, bouton
  « Réactiver » remplacé par « Compte anonymisé — non réactivable ») — vérifié, aucun code ajouté ;
  (b) période `?from&to` **civile** avec défaut inchangé (30 j), agrégats extraits dans
  `src/lib/analytics.ts` (partagés écran + export), sélecteur + export CSV localisé
  (`GET /api/dashboard/analytics/export`, sections Résumé / Revenus par jour / Top hébergements,
  devises séparées) ; (c) `zodIssues`/`zodErrorResponse` → 400 `{ error, issues[] }` traduits sur
  20 routes, `.strict()` sur les schémas de mutation (champ inconnu = 400, plus de 200 trompeur).
  Tests : `analytics-period.test.ts` 5/5, `bookings/[id]/route.t241.test.ts` 3/3, contrat T-159
  réécrit. Verrou i18n **1682**.*
