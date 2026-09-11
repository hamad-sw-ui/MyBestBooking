# 🚧 KNOWN_LIMITATIONS — limites assumées

Ce document liste les **limites connues** du produit qui **ne sont pas des
bugs** : ce sont des choix ou des dettes acceptées, avec la raison. Une
limite peut redevenir un bug si le contexte change — la déplacer alors dans
`BUGS.md`.

À distinguer de :

- `BUGS.md` — défauts non voulus.
- `BACKLOG.md` — évolutions désirées, non encore priorisées.

---

## Produit

- **Validation Stripe réelle non exécutée dans le sandbox.** Le checkout utilise
  Stripe Elements lorsque les clés Stripe secrète, webhook et publique sont
  configurées et ne présente jamais un intent `pending` comme payé. Aucun
  compte/jeu de clés Stripe n'est disponible ici : capture, webhook et
  remboursement Stripe test-mode restent à valider avant ouverture production.
  Le mock est explicitement limité au dev/test et refusé en production sans
  configuration complète.

- **Vérification d'email non bloquante.** L'inscription envoie un mail de
  vérification best-effort et crée la session immédiatement. Le produit ne
  bloque pas encore les actions sensibles tant que `emailVerified` est faux.

- **Rotation provider assistée mais opérée par l’infrastructure.** Les overrides
  Stripe, Resend et S3 sont chiffrés AES-GCM et peuvent être réchiffrés via le
  keyring temporaire documenté dans ADR-012. La clé primaire et l’ancienne
  restent exclusivement des variables d’environnement : leur perte avant
  rotation rend toujours les données chiffrées illisibles. Une sauvegarde
  sécurisée des secrets et une procédure d’incident restent indispensables.

- **Rate-limit en mémoire (mono-instance).** `src/lib/rate-limit.ts` de
  T-009 utilise une Map process-local. En déploiement multi-instance
  (Vercel, Kubernetes avec réplicas), chaque instance a son propre
  compteur → limite effective multipliée par le nombre d'instances.
  Suffisant pour ralentir un attaquant naïf, à remplacer par Redis
  (Upstash, ioredis) pour un vrai rate-limiting global.

  **T-235 (2026-09-11) — deux compteurs distincts sur les réservations.**
  `POST /api/bookings` applique désormais (a) un garde-fou anti-abus de
  **60 requêtes/heure** posé **avant** la lecture du corps, et (b) le quota
  produit de **10 réservations/heure** consommé **après** validation du
  payload (une demande rejetée pour saisie invalide ne consomme plus le
  quota). Clé invité : cookie signé `mbb_guest` (180 j, httpOnly, lax)
  avec repli IP — plusieurs voyageurs derrière une même IP publique ne se
  pénalisent donc plus entre eux, mais **effacer le cookie repart de zéro**
  (contournement trivial, accepté : le garde-fou 60/h par IP reste, et la
  limite est un quota produit, pas un contrôle de sécurité). En
  multi-instance, ces deux compteurs restent process-locaux comme ci-dessus.

- **Cache catalogue/fiches 60 s (T-182, mono-instance).**
  `src/lib/read-cache.ts` sert les recherches **sans dates** et les fiches
  **publiques** depuis un TTL 60 s process-local (pattern settings T-179).
  Conséquences bornées et acceptées : un hébergement nouvellement validé
  ou un avis approuvé peut mettre ≤ 60 s à apparaître publiquement ;
  la disponibilité AVEC dates et le tunnel de réservation restent temps
  réel (jamais cachés). En multi-instance, chaque instance diverge ≤ TTL —
  à remplacer par `unstable_cache`/Redis le jour venu.

- **Désabonnement (T-239) limité aux envois non transactionnels.** Seules
  les **alertes prix** portent un lien d'opposition signé (`/desabonnement`) et
  sont pilotées par une préférence utilisateur. Les e-mails de réservation
  (demande, confirmation, expiration, rappel de paiement), de sécurité
  (2FA, réinitialisation de mot de passe) et de contenu (avis publié ou
  modéré) restent envoyés sans possibilité de refus : ils portent l'exécution
  du contrat ou la sécurité du compte. Le registre
  `UNSUBSCRIBE_CATEGORIES` (`src/lib/unsubscribe.ts`) est le point d'extension
  si une nouvelle catégorie marketing apparaît : aucune table
  `user_notification_prefs` n'a été créée pour une seule catégorie.

- **Rotation JWT_SECRET manuelle.** Voir ADR-003. Une rotation
  invalide toutes les sessions actives (30 jours par défaut).
- **i18n UI (T-167/T-172 VALIDÉ).** Catalogue **1482** clés FR=EN ;
  `i18n:check` **0 candidat** ; SSR cookie `en` prouvé (`html lang=en`,
  navbar/home/auth/recherche). T-168→T-171 ont depuis localisé facture
  HTML, placeholders réglages, messages JSON d’API et e-mails
  transactionnels ; T-172 a câblé les métadonnées localisées sur toutes
  les pages (incl. `/recherche`, auth, compte) avec `noindex` sur les
  zones privées. **T-194** (+1 `auth.demoHint`), **T-195** (+38
  `payouts.*` dont 11 `payout-account`, +2 `payouts.*` P7, +8
  `billingCsv.*` P9), **T-202** (+15 : `book.confirmRequest`, `dash.*`
  approbation hôte, `host.*` gate, `pay.manualConfirmed`) et **T-203**
  (+2 : `book.markPaidOffline`, `book.paymentAwaitingHost` puis, suite d'audit,
  +3 : `reservation.manualRequestSent`, `reservation.manualRequestBody`,
  `reservation.manualAmountOnSite`) ont porté le verrou à **1482**.
  Restent **hors périmètre** (pas des bugs) : termes métier
  identiques FR/EN (« No-show »), contenus stockés en base (seed, avis,
  motifs d’annulation, corps d’e-mails personnalisés par l’admin), arabe
  `ar` (repli FR volontaire — défaut `supportedLocales` aligné fr/en).
  Pages légales et centre d’aide bilingues (T-162/T-158). Le sélecteur
  FR/EN n’agit que via `useT`/`makeT`.

- **Exécution Stripe Connect réelle des versements = INSPECTION (T-195).** La
  partie **interne** du versement est **validée** : ledger `payouts` /
  `payoutAccounts` (migration additive 0018), agrégation multi-devise par
  période (`createPayoutsForPeriod`, jamais de somme inter-devises),
  route `POST/GET /api/host/payout-account` (référence chiffrée AES-GCM via
  `provider-credentials`, jamais réaffichée), tâche cron idempotente
  `/api/cron/payouts`, UI « Versements » + `webhook payout.*` idempotent.
  La partie **externe** (création de l'account Connect, onboarding,
  `transfer`/`payout` Stripe, destination SEPA réelle) **ne peut pas être
  prouvée ici** faute de clés Connect : `StripePayoutProvider.executePayout`
  lève explicitement sans clés (Jamais simulé comme réussi), et le sandbox
  bascule sur le mock uniquement via `ALLOW_MOCK_PAYMENTS=true` (opt-in
  explicite, jamais implicite). À re-valider avec un compte Connect de test
  avant ouverture production.
- **Devise multi : tunnel et totaux gérés, affichages secondaires non.** La
  table `bookings.currency` est multi-devises : le tunnel de réservation
  (T-152) et les totaux analytics/billing (T-152, `sumByCurrency` — jamais
  de somme inter-devises affichée) utilisent la devise réelle. Restent en
  `€` dur (hors périmètre audit B) : wallet dans `mon-compte` et
  `bestrewards-status`, prix `/nuit` dans `dashboard/properties/[id]`,
  montants promo (`promo-code-input`, `promotion-form`).

  **Versements (T-195) — garde-fous ajoutés :**
  - **Un payout par devise** (`createPayoutsForPeriod`) : une période avec des
    bookings EUR **et** XAF génère UN payout par devise, jamais une somme
    inter-devises (clé d'idempotence `payout:host:period:currency`).
  - **Garde-fou devise à l'exécution (P2)** : `POST /api/host/payouts` n'exécute
    un versement que si `payout.currency` correspond à la devise du compte de
    versement par défaut. Sinon le payout reste `pending` et est renvoyé dans
    `skipped[]` (jamais transféré) — la règle « ne jamais mélanger les
    devises » s'applique aussi au versement, pas seulement à l'affichage.
  - **Chemin admin multi-hôte (P3)** : un admin voit/agrège par (hôte, devise)
    mais **n'exécute jamais** le versement d'un autre hôte (garde d'appartenance
    → `skipped`, reste `pending`). Seul l'hôte propriétaire exécute son
    versement.
  - **Bouton par devise (P6) et feedback visible (P7)** : le bouton demande un
    versement pour **une seule devise** (`currency` transmis au POST, la route
    ne traite que cette devise → 404 si aucun payout de cette devise pour la
    période). Garde-fou explicite en UI : si des versements sont `skipped`
    (devise ≠ compte) ou si `hasAccount === false`, le bouton affiche un
    message (`payouts.skippedCurrency` / `payouts.accountMissing`) au lieu d'un
    simple `reload()`. **Limite** : si un hôte possède des bookings sur
    plusieurs devises sans compte dans l'une d'elles, il doit ajouter un compte
    pour cette devise pour déclencher son versement (comportement voulu, pas un
    bug).
  - **Export ledger des versements (P8/P9)** : la carte « Factures » affiche les
    versements et son export (bouton header + icône `download` ligne) pointe
    vers `GET /api/dashboard/billing/export-payouts` (CSV du ledger `payouts`,
    host/admin, 500 lignes max, en-têtes localisés `billingCsv.*`), **et non**
    vers l'export bookings `/api/dashboard/billing/export` (réservé à la carte
    Réservations). **Limite** : l'export de versements est tronqué à 500 lignes
    (garde-fou volume, même règle que l'export bookings) — au-delà, une
    pagination/CSV streamé serait nécessaire (backlog).
- **Réservations sans paiement plateforme (T-207).** Le client réserve via une
  **demande transmise à l'hôte**, sans choix "payer en ligne", sans formulaire
  carte/Stripe, sans reprise `/reservation?booking=...` et sans débit wallet.
  `POST /api/bookings` force le flux demande (`status:"pending"`,
  `payment:null`, `manualConfirmation:true`, `onlinePaymentDisabled:true`) même
  si un client legacy forge `payOnline:true` ou `useWalletCredits:true` ;
  `/api/bookings/[id]/payment` répond `410 ONLINE_PAYMENT_DISABLED` après
  contrôle auth/propriété. Le wallet reste informatif. L'hôte/admin conserve les
  transitions métier (`pending→confirmed`, annulation, constat hors plateforme si
  utilisé en legacy), et les e-mails de confirmation manuelle restent envoyés. Un
  **hôte non approuvé** (`approvalStatus=pending`) peut créer/soumettre un
  hébergement mais il ne peut **pas** passer `active` (`validate→approve` → 409)
  tant que l'admin n'a pas approuvé son compte et fixé sa commission.
- **Mode invité limité.** Le checkout accepte un email non enregistré et crée
  un profil sans mot de passe. Un email déjà associé à un compte doit être
  utilisé après connexion pour éviter le rattachement de données.

## E-mails (hôtes ↔ clients)

Audit du 2026-08-30 (`REPORTS/audit_emails_hotes_clients_2026-08-30.md`)
puis **implémentation T-150** (`REPORTS/validation_T-150_2026-08-30.md`) :
les trois écarts sont **résolus** — CTA direct dans `newMessage` (section
selon le rôle du destinataire), sujet/corps plateforme localisés fr/en,
e-mail d'annulation à l'hôte (`bookingHostCancellation`, localisé fr/en via
l'outbox). Restent assumées :

- **Vérification à l'inscription localisée (T-151, résolu).** `language`
  est accepté/persisté à l'inscription et au checkout invité → l'e-mail de
  vérification et la réclamation de compte sont localisés fr/en pour le
  destinataire (défaut fr). **T-152** ajoute le sélecteur FR/EN du header
  (compte + anonyme) et `<html lang>` dynamique. **T-167** clôture la vague 3
  UI (`useT`/`makeT`, 1354 clés, SSR cookie `en`). Restent hors i18n UI :
  corps e-mails admin et JSON API.
- **Corps éditables admin non traduits.** Les blocs `emailTemplates`
  personnalisés par l'admin gardent la langue de rédaction admin (compromis
  T-025) ; la localisation fr/en s'applique aux contenus plateforme
  (habillage, `priceAlert`, `guestAccountClaim`, `bookingHostCancellation`,
  `newMessage` par défaut) et au CTA.

## Technique

- **Migrations Drizzle présentes**, mais `drizzle-kit push` reste le chemin
  local le plus utilisé ; vérifier le pipeline de migration avant production.
- **Tests automatisés : contrats hétérogènes, ordre imposé.** 484 tests
  (73 fichiers) stables en exécution isolée. Les tests d'intégration
  **supposent la base démo seedée** — ne jamais les lancer après un smoke
  sans purge (leçon T-187/188/189). L'ordre correct (vitest → smoke) est
  outillé par `npm run ci` (T-191) ; en CI distante, bases strictement
  disjointes (service postgres:16 vs embedded — `docs/ci-workflow.yml`).
- **`<img>` natifs : exception unique et volontaire.** `img → SmartImage`
  migré site-wide en T-188 (next/image pour l'auto-hébergé, lazy enrichi
  sinon). Reste `user-avatar.tsx` — `<img>` client **justifié** : repli
  dynamique sur les initiales via `onError` + state, impossible à porter
  tel quel sur next/image sans perdre le repli (eslint-disable explicite).
- **`POST /api/seed` libre en dev uniquement.** En production la route est
  protégée par `x-seed-token` = `SEED_TOKEN` (timing-safe, 404 sinon) —
  T-178/BUG-002 ; probe sandbox 2026-09-02 : **404 sans token, 200 avec**.
  Reste : le compte démo seedé est public par nature (dev/preview).
- **Rate-limit en mémoire** : présent sur les routes critiques, mais non
  distribué entre plusieurs instances. Voir la limite produit ci-dessus.
- **Pages 404 dynamiques : statut HTTP 200 avec `noindex`.** (T-153, audit
  n°25, finding D.) Quand une route dynamique (`(main)/[slug]`,
  `reservation`, etc.) appelle `notFound()` après avoir commencé à streamer
  (RSC), Next.js **ne peut pas modifier le statut HTTP** déjà envoyé : la
  réponse reste 200, mais `src/app/not-found.tsx` est rendu par Next avec la
  balise `<meta name="robots" content="noindex">` — les moteurs ne
  l'indexent donc pas. C'est la limite du modèle streaming App Router ;
  la corriger nécessiterait un pré-rendu non-streamé de ces pages (travail
  de routage/performance hors périmètre V1) — voir BACKLOG. Aucun contrat
  API n'est affecté (les API renvoient de vraies 404).

## Framework

- **Vérification automatisée livrée, pas de hook pre-commit.**
  `scripts/check-ai.mjs` (20 règles R1→R20 : manifest, CURRENT_TASK,
  rapports S/C, liens, couvertures DB/UI, fraîcheur, sync HEAD…) est joué
  par `npm run ai:check` et dans `npm run ci` (T-191). Reste assumé : pas
  de hook Git local qui forcerait l'exécution avant commit — la discipline
  reste la barrière, la CI distante (docs/ci-workflow.yml) en fera un gate.
- **Hooks git distants :** la permission `workflows` de l'App GitHub du
  sandbox est absente → le push de `.github/workflows/` est refusé.
  Contournement documenté dans `docs/CI.md` (workflow prêt à activer).

## Environnement de développement

- **Polices Inter/Poppins jamais chargées (fallback system-ui partout).**
  `next/font/google` indisponible hors-ligne (T-017 revert) et le `<link>`
  Google Fonts historique n'existe plus : le site sert `--font-family-sans`
  → system-ui. Correction possible : auto-héberger les woff2 dans `public/`
  (téléchargement impossible dans ce sandbox) — backlog.
- **PostgreSQL embarqué, zéro Docker.** `npm run db:dev` lance un Postgres
  18 embarqué (`embedded-postgres`, port 55432, binaire installé par npm).
  Reste : pas de mock SQLite — par design (fidélité prod).
- **Artefacts sandbox non persistés entre reprises** (constaté 2026-09-02,
  deux fois) : `node_modules`, `.data/pg`, `.next`, `.env.local`
  disparaissent quand le conteneur redémarre. **Restauration outillée** :
  `npm run env:restore` (T-192 — idempotent : node_modules → `.env.local`
  → PG embedded → db:push ; l'app et le cron se relancent ensuite via le
  gestionnaire de processus). Les secrets sandbox sont des constantes
  déterministes pour que le vault chiffré des providers reste lisible.
- **Node 20+** requis (contrainte de Next 16). Assumé.

---

Si l'une de ces limites bloque la prochaine étape (ex : mise en prod), la
déplacer immédiatement dans `BUGS.md` **avec la priorité appropriée** et
créer une tâche dans `BACKLOG.md`.

## Surfaces inactives (volontairement hors service, T-217/P9)

Ces surfaces existent dans le code mais ne sont **branchées à aucun écran** :
elles sont conservées comme historique/contrat et ne doivent pas être
réintroduites sans décision produit.

- Composants `@deprecated` : `src/components/stripe-payment-form.tsx`
  (paiement carte, retiré par T-207), `payout-account-form.tsx` et
  `payout-request-button.tsx` (versements hôtes, désactivés par T-209).
- Routes sans appelant applicatif : `GET /api/providers/stripe`,
  `POST /api/webhooks/stripe` (compatibilité PSP), `POST /api/bookings/[id]/payment`
  (410), `GET /api/cron/payouts` (410). `GET /api/admin/audit` est désormais
  **branchée** par `/dashboard/audit` (T-217/P9).
- Champs de payload inertes : `useWalletCredits` (`POST /api/bookings`) est
  accepté puis **ignoré** (`walletUsedEur = 0`) depuis T-207 — le wallet n'est
  pas déduit dans le tunnel tant que le paiement en ligne est désactivé. Le
  champ est conservé pour la compatibilité des appelants ; sa consommation
  éventuelle est une décision produit (**T-248**, reprise de l'observation O1).
- Code retiré par T-252 (audit n°5) : `src/lib/wallet-currency.ts`
  (`applyWalletToTotal`) et son test — plus aucun appelant applicatif depuis
  T-207 ; ne pas réintroduire sans la décision produit ci-dessus.
