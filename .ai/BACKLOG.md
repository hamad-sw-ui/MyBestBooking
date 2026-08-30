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

- 🟠 Sentry (ou équivalent) branché sur les 5xx et erreurs client
- 🟠 Logs structurés JSON (pino) au lieu de `console.error`
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

### Audit 28 (2026-08-30) — `REPORTS/audit_fonctionnel_profond28_2026-08-30.md` (rapport seul, à arbitrer)

- 🔴 **T-156 (P1)** — Annulation par l'hôte : `cancelBooking` sans notion
  d'acteur → frais de politique facturés au voyageur (preuve 277,38 €) ;
  bouton hôte « Annuler » inopérant (quote 403). → actor
  (host/admin → fee 0 + refund intégral + raison/emails dédiés), quote
  autorisé hôte du bien, UI hôte dédiée. Additif, cas voyageur inchangé.
- 🟠 **T-157 (P2)** — Identité voyageur en mode connecté : le serveur doit
  utiliser l'identité du compte (ignorer les champs invité du payload pour
  un user connecté) ; UI lecture seule + option « réserver pour un
  proche » à arbitrer. Guest mode inchangé.
- 🟠 **T-158 (P2)** — i18n : vague 1 = fiche propriété publique (EN) +
  help-center bilingue + garde-fou CI (warn) ; sélecteur de devise dans la
  recherche (priorité compte > localStorage > locale, contrat
  `displayCurrency` inchangé).
- 🟢 **T-159 (P3)** — Hygiène : script de purge des artefacts de
  simulation (`--dry-run`) ; PATCH settings par section (merge additif) +
  suppression des `issues` dans la réponse d'erreur ; alignement 409→400
  sur « capacité dépassée » (à décider).
