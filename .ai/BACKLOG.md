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
- 🟠 **T-112 (S/P2)** — referral/promos, conversations uniques, rétention,
  support/ticketing, UX restantes, navigateur CI et upgrade dépendances.

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
- 🟢 Programme parrainage lié à `walletBalance`
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
