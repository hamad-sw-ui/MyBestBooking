# 🧠 ÉTAT DU PROJET (STATE)

## 📌 Identification

- **Projet** : MyBestBooking
- **Branche actuelle** : `arena/01a0913d-mybestbooking` (branche Arena active)
- **Configuration SMTP (2026-09-12) — demande utilisateur : « dites moi si serveur smtp est
  correctement configuré, si non faites la configuration »** — **Analyse** : aucun `SMTP_*` défini
  dans l'environnement → le mailer actif est le **ConsoleMailer** (repli dev documenté : les e-mails
  sont écrits dans `.data/mails/*.txt`) — la chaîne d'envoi elle-même (outbox, lease 5 min,
  MAX_ATTEMPTS=8, header d'idempotence `X-MyBestBooking-Event-Key`, relivraison cron
  `deliverPendingEmails(20)`) était saine et testée. **Travaux (non-régressifs)** :
  (1) `src/lib/mail/smtp-mailer.ts` — **STARTTLS imposé par défaut** en mode non-secure (port 587) :
  sans TLS, la livraison échoue **proprement** (la ligne outbox repasse en attente et sera retentée ;
  jamais d'envoi en clair vers un serveur distant) ; `SMTP_REQUIRE_TLS="false"` accepté uniquement
  pour un relais local en clair sur réseau de confiance (documenté dans `.env.example`) ; le mode
  `secure=true` (465, TLS implicite) est inchangé (`requireTls` sans effet) ;
  (2) **preuve d'intégration** `src/lib/mail/smtp-mailer.smtp.test.ts` (4 tests, sink SMTP local
  `node:net` 127.0.0.1) : sélection SmtpMailer via env, non-régression ConsoleMailer sans env,
  **livraison réelle** outbox→sink (AUTH PLAIN, enveloppe RFC 5321, DATA From/Subject/Event-Key,
  ligne `sent` + `providerMessageId`), et 587 strict (sink sans STARTTLS → `ok=false`, ligne
  `pending`, `lastError` « starttls », retry possible) ;
  (3) **preuve runtime live** (dev server, `.env.local` pointant un sink local 2525) : réservation
  guest `MBB-2026-TOT2CA` → e-mail réel capturé par le sink (`X-Mybestbooking-Event-Key:
  guest-claim:<id>`, `From: MyBestBooking <…>`, corps FR) et 2 lignes outbox `sent` avec
  `provider_message_id` = Message-ID SMTP (guest-claim + demande hôte) ; le même scénario sans
  `SMTP_REQUIRE_TLS=false` a **mesuré** le défaut strict (attente 120 s nodemailer, pas de 5xx) ;
  (4) `.env.example` : bloc SMTP réorganisé (465 TLS implicite / 587 STARTTLS) + `SMTP_REQUIRE_TLS`
  documenté ; `.env.local` (gitignored) : bloc SMTP **commenté, prêt à remplir** (valeurs à fournir
  par l'utilisateur). **Aucun e-mail existant modifié** : mêmes gabarits, même outbox, seul le
  transport SMTP gagne un chiffrement par défaut conforme ; sans variables SMTP, le comportement est
  strictement identique (ConsoleMailer). Preuves : **tsc 0** · **vitest intégral 162 f / 862 t,
  0 échec** (+4 = tests SMTP) · **ai:check 19 OK / 1 warn (R7) / 0 fail** · fixtures démo purgées
  (0 résidu `demo-smtp*`, `email_outbox` 0, base à l'état seed). **Valeurs utilisateur reçues
  (2026-09-12)** : SMTP **Gmail** fourni (utilisateur + mot de passe d'application) → activé dans
  `.env.local` (gitignored, **jamais commité** : le mot de passe réel reste un secret) ; testé à
  l'exécution (réservation guest → 3 e-mails outbox, connexions SMTP tentées) — la **livraison
  réelle vers Gmail est impossible depuis le sandbox** (egress sélectif : le handshake TLS vers
  smtp.gmail.com est coupé ; GitHub/npm passent) : les lignes restent `pending` + `last_error` +
  retry cron, comportement conçu ; elle fonctionnera dans tout environnement à internet réel
  (machine utilisateur ou production, mêmes variables). **`.env.example` : config Gmail préparée**
  (host/port/secure/user/from renseignés, `SMTP_PASSWORD=""` volontairement vide — à vide, le
  code retombe sur Console/Resend, rien ne casse ; le secret va dans `.env.local`).
  **Incident documenté** : le restore du workspace avait réinitialisé
  la branche locale à `1ad5f2d` avec un tree intermédiaire (brouillons audits #7/#8) ; récupéré par
  `git reset --hard bbeec20` (= remote, fin d'audit #8) + réapplication des 2 fichiers SMTP — aucun
  travail antérieur perdu.
- **Implémentation de l'audit n°8 (2026-09-11) — audit entièrement soldé, F1 → F5 livrés (T-271 → T-275)** :
  **T-271 (S/F1, majeur)** — le 500 latent de `/mes-reservations` est corrigé :
  `formatTimestamp` (`src/lib/dates.ts`) n'applique les styles Intl
  (`dateStyle`/`timeStyle`) qu'entre eux, avec `timeZone` ; le chemin historique
  (composants explicites) est inchangé — tout client possédant une demande `pending`
  (champ `requestExpiresAt` posé à 100 % des créations) revoit sa page ; **T-272
  (S/F2)** — le no-show n'est plus unilatéral : gabarit `noShow` FR/EN +
  `sendNoShowNotificationIfNeeded` (idempotent `no-show:<id>`, best-effort
  post-commit, interrupteur `notifications.bookingNoShow` défaut `true`) hooké dans
  `PUT /api/bookings/[id]` ; **T-273 (C/F3)** — le remboursement hors plateforme se
  **finalise** : `POST /api/bookings/[id]/refund` (hôte du bien/admin ; gardes `paid` +
  `refundStatus='none'` + `paymentIntentId IS NULL` + non-`pending` ; `FOR UPDATE` ;
  idempotent 409 ; audit `booking.refund.manual` ; e-mail `refund-finalized:<id>`
  best-effort) + action « Finaliser le remboursement » (`ReasonDialog`) dans
  `BookingRowActions`/colonne Règlement — la voie PSP reste exclusivement Stripe
  (garde `paymentIntentId IS NULL`) ; **T-274 (S/F4)** — l'anonymisation coupe
  `price_alerts.active` + `users.price_alert_enabled` **dans la même transaction**
  et le scan cron applique la garde `isNull(users.deletedAt)` (`selectActivePriceAlerts()`
  exportée) : un compte supprimé (même avant le correctif) ne produit plus aucun e-mail
  d'alerte prix ; **T-275 (C/F5)** — le claim invité a un **renvoi auto-service** :
  `POST /api/auth/resend-guest-claim` (zod strict, double identification référence +
  e-mail exact, 4 gardes d'émission, réponse **strictement générique** anti-énumération,
  rate-limit IP 10/h + email 3/h avant toute lecture, jeton `guest_claim` 24 h **non
  annulé**, eventKey `guest-claim-resend:<id>:<ts>`, échec mail sans 5xx) + bouton
  « Renvoyer l'e-mail d'activation » sur l'écran de confirmation du tunnel guest.
  **Aucune migration** (colonnes existantes), aucun contrat d'API existant modifié,
  FSM intacte, e-mails existants strictement inchangés. Débat §15.2 fait pour les deux
  C ; analyses d'impact/conception **avant** tout code. Preuves : `dates.t271` 35/35 ·
  `no-show-notification` 5/5 · `refund/route.t273` 10/10 · `account-anonymization.t274`
  2/2 + `cron/price-alerts/route.t274` 3/3 · `resend-guest-claim/route.t275` 8/8 ·
  **vitest intégral 161 f / 858 t, 0 échec** · **chaîne CI complète verte** (typecheck ·
  lint 0/0 · i18n · `ai:check` 19 OK / 1 warn R7 / 0 fail · build · smoke 95/95) ·
  **runtime réel des 5 scénarios** (500→200, no-show mail sent, refund refunded+audit+409,
  cron `scanned:1` compte supprimé exclu / contrôlée notifiée, 3 renvois claim sent +
  429 au 4e essai) · verrou i18n **1770 → 1774** (FR/EN appariées) · base rendue à
  l'état seed exact. Rapport : `REPORTS/validation_T271_T275_2026-09-11_audit8.md`.
  **Aucune ligne de l'audit n°8 ouverte.** `STATE.md` est réécrit au-dessus du commit
  d'implémentation et ne peut pas citer son propre SHA (motif R7 toléré) —
  commit de clôture poussé : `d463f0d` (analyse n°8 : `8b8b2e5`).
- **Analyse (2026-09-11, après l'audit n°7) : audit runtime n°8 — ANALYSIS DELIVERED** —
  `docs/analyse_2026-09-11_audit_runtime_n8_parcours_execution.md` (copie
  `.ai/REPORTS/analyse_2026-09-11_audit_runtime_n8_parcours_execution.md`) :
  5 constats **F1→F5** mesurés à l'exécution (base seed + fixtures n°8, purgés
  après coup) — **F1 (majeur)** : 500 latent sur `/mes-reservations` pour tout
  client possédant une demande `pending` : `requestExpiresAt` (toujours posé à
  la création, route.ts:472/510) + `formatDate(…, { dateStyle, timeStyle })`
  (page.tsx:229) → `formatTimestamp` (dates.ts:137) mélange styles Intl et
  composants → `RangeError` ; préexistant `1ad5f2d` ; fix proposé : styles seuls
  dans `formatTimestamp` quand `dateStyle`/`timeStyle` sont présents ;
  **F2 (mineur)** : no-show unilatéral — 0 e-mail voyageur, aucun recours
  (fixture `MBB-T8-NOSHOW` exécuté, outbox vide) ; **F3 (report produit)** :
  finalisation du remboursement hors plateforme Stripe-only (`payment-events.ts`),
  aucun action hôte/admin, `bookings.refundManual` sans suite ;
  **F4 (mineur, prouvé)** : alertes prix d'un compte supprimé toujours notifiées —
  `anonymizeUserAccount` ne touche pas `price_alerts`/`users.priceAlertEnabled`
  et le scan cron n'exclut pas `users.deletedAt` → e-mail « sent » vers
  `deleted-…@anonymized.local` (alerte `c9509c78`, cron `notified:1`) ; fix
  proposé : `active=false` + flag à l'anonymisation (même tx) + garde
  `isNull(users.deletedAt)` dans la requête cron ; **F5 (mineur)** : claim invité —
  e-mail unique, jeton 24 h (demande aussi 24 h), `passwordHash=null` (pas de
  connexion possible), `resend-verification` = `email_verification` auth seulement
  → **aucun renvoi auto-service** si l'e-mail est perdu/la fenêtre dépassée ; fix
  proposé : `POST /api/auth/resend-guest-claim` (réf. + email, rate-limit, réponse
  générique) + lien UI. **Vérifié sain** (infirmé) : lien facture dans l'UI
  (`booking-row-actions.tsx:294`), compteur non-lus (reset 2→0 au rendu), cycle
  promo (incrément booking / décrément annulation `GREATEST(x-1,0)` / code
  réutilisable), i18n EN des nouveaux labels (FR/EN symétriques, rendu EN vérifié),
  cashback 0.00 niveau 2 (by design, Ambassador-only), review requests (fenêtre
  14 j, idempotent), traces cron (GET + Bearer), double-booking 201+409, lifecycle,
  suppression de compte (hors F4), claim à usage unique. **Aucune ligne de code
  modifiée** ; base rendue à l'état seed (0 résidu fixture, `email_outbox` 0,
  `cron_runs` 0, compteurs client 8→7, langue fr, `CRON_SECRET` retiré de
  `.env.local`). **À trancher** : les 5 décisions § 5 de la doc (F1/F4 recommandés
  sans débat).
- **Implémentation de l'audit n°7 (2026-09-11) — audit entièrement soldé, lots A→C livrés (commit `b39fe89`)** :
  **lot A** — **C1 → T-265** : la confirmation d'une demande re-vérifie le bien et la
  chambre **dans la transaction** (annonce suspendue ou chambre désactivée → `409` au lieu d'un
  séjour réalisable sur un bien sanctionné ; la fiche publique 404 n'est plus contournable) et
  **C2 → T-266** : le remboursement hors plateforme n'est plus « en cours » indéfiniment —
  l'hôte peut le **finaliser** (`refundStatus → refunded`, action + e-mail), et l'état `pending`
  est relabelé « **à traiter par l'hébergeur** » (FR/EN) sur `/mes-reservations` ;
  **lot B** — **C3 → T-267** : le placeholder est un **visuel neutre dédié** (plus de
  photo d'autrui) et l'annonce sans photo rend un **état vide explicite** sur la fiche publique
  (plus aucune image de substitution) et **C4 → T-268** : le claim invité pose
  `emailVerified=true` (la maîtrise de la boîte mail est prouvée par le claim) ;
  **lot C** — **C5 → T-269** : migration additive `0026` — `bookings.confirmed_at`
  posée **dans la transaction de confirmation** ; la timeline dashboard lit
  `confirmedAt ?? updatedAt ?? createdAt` (lignes historiques inchangées, la date affichée ne
  glisse plus après un `markPaidOffline`) et **C6 → T-270** : `/messages` — dernier message des
  fils de la fenêtre en **une requête IN-liste** (fin du 1+N), **fenêtre T-245** (25 par défaut,
  « Afficher 25 de plus », « Tout afficher (N) », plafond 500 — 9ᵉ écran rattrapé) et
  **visibilité + recherche en SQL partagé** entre la liste et le compteur du bandeau (le « N sur
  M » ne peut pas mentir, contrat T-257). Bonus : `list-window.t257` ne code plus en dur
  « 23 chambres seed » (le seed est aléatoire) — comptage dynamique.
  Preuves : `route.t269` 4/4 · `page.t270` 4/4 · non-régression messages/fenêtres 14/14 ·
  **chaîne CI complète verte** (typecheck · lint 0/0 · i18n · ai:check · vitest intégral ·
  build · smoke 95/95) · runtime serveur réel (T-266 label, T-269 timeline, T-270 bandeau).
  Base rendue à l'état seed exact.
- **Analyse (2026-09-11, après l'implémentation de l'audit n°6)** : **audit runtime n°7** —
  `docs/analyse_2026-09-11_audit_runtime_n7_fins_de_parcours.md` (copie
  `.ai/REPORTS/analyse_2026-09-11_audit_runtime_n7_fins_de_parcours.md`) : 6 constats **C1→C6**
  mesurés à l'exécution sur base neuve (demande pending **confirmable après suspension de
  l'annonce** — transition sans re-vérification du bien, fiche publique 404 · remboursement hors
  plateforme « en cours » **indéfiniment** (`refundStatus=pending` sans chemin vers `refunded`) ·
  annonce sans photo servie avec la **photo d'une autre propriété** (placeholder = copie de
  `villa-azure-1.jpg`) · claim invité laissant `emailVerified=false` · timeline « confirmée »
  datée de `updated_at` (colonne `confirmed_at` absente) · `/messages` voyageur en 1+N requêtes
  sans fenêtre, contrairement aux 9 autres écrans T-245/T-257) — **tous corrigés** par les lots
  A→C ci-dessus ; balayage 46 pages × 4 rôles → 0 erreur applicative, 78 liens dashboard
  résolus, cycles rejoués de bout en bout (vie de réservation, avis, 2FA, claim, alertes prix,
  cron, validation, suspension, favoris, promotions).
- **Analyse (2026-09-11, après le gel wallet T-248 §3)** : **audit runtime n°6** —
  `docs/analyse_2026-09-11_audit_runtime_inacheves_mal_penses.md` (copie
  `.ai/REPORTS/analyse_runtime_n6_2026-09-11_inacheves.md`) : 12 constats **B1→B12** mesurés à
  l'exécution (cadence de cron déclarée ≠ réelle, `/api/cron/payouts` planifié mais muet, trois
  stratégies de base URL dans les e-mails, deux écrans de liste sans fenêtre, avis de la fiche
  plafonnés à 5 sans compteur, `description_en`/`state`/coordonnées jamais éditables, capacités API
  (`popularity`, `minRating`, `near`, `search`) sans entrée d'interface, crédit gelé perdu sans mot à
  la suppression de compte, résidus T-207, 10 écrans sans `loading.tsx`, rate-limit en mémoire) et
  solutions non régressives par **lots A→D**, à trancher en oui/non. **Aucune ligne de code
  modifiée** ; balayage 45 pages × 3 rôles → 0 erreur applicative, 0 bouton mort, 0 texte en dur,
  0 route sans contrôle justifié.
- **Implémentation de l'audit n°6 (2026-09-11) — lots A et B (complet)** : décisions **oui ×4**
  reçues après l'analyse ; **lot A commité `11165d4`** — **B1** le seuil « stale » de `getCronHealth`
  suit la cadence **réellement déclarée** (`CRON_SCHEDULES`, 3 × 24 h pour `price-alerts` ; le seuil
  de 4 h héritait d'une cadence fantôme et faisait passer une tâche saine pour en retard) ; **B2**
  `/api/cron/payouts` **retiré** de `vercel.json` (il répondait 410 quotidiennement tant que
  `platformPayoutsEnabled()` est faux ; reste exécutable par `scripts/cron-runner.mjs`) ; **B3** base
  URL **unique** des e-mails (`appBaseUrl()` dans 10 fichiers ; seul `verify/route.ts` garde la
  sienne, justifié en commentaire) ; **B11** un squelette `loading.tsx` **uniquement** sur une feuille
  (`(main)/mon-compte`) — jamais au-dessus d'une route `[id]` (BUG-051 : soft-404 figé à 200). Tests
  `cron-schedule` 3/3, `app-url-usage` 2/2, `cron-trace` recalculé · **0 clé i18n ajoutée**. **Lot B
  (partiel)** — **B4 → T-257** : `/dashboard/rooms` (branche hôte) ne fait plus **une requête par
  bien** (une jointure `rooms ⋈ properties` filtrée par `host_id`, `countRooms()` pour la fenêtre) et
  les **deux derniers écrans hors fenêtre** (`rooms`, `messages`) adoptent `parsePageWindow` +
  `<ShowMore>` — le contrat T-245 couvre désormais les **9 écrans de liste** ; `conversationScope()`
  est partagé par la liste et le compteur de conversations. **B5 → T-258** : la fiche publique garde
  ses 5 avis (même requête, même cache TTL 60 s) mais affiche le **total** (« Avis vérifiés ✓ — 24
  avis ») et un bouton « Voir les 24 avis » dès qu'il existe plus de lignes que la fenêtre ; nouvelle
  page **`/hebergement/[slug]/avis`** (20 avis par page, `?page=`, `generateMetadata`, mêmes règles de
  visibilité que la fiche, 404 sinon) et bloc d'avis extrait dans le composant partagé
  `PropertyReviewsList` (markup inchangé). Titre de la page = clé orpheline `property.reviews` enfin
  utilisée ; verrou i18n **1739 → 1742** (+3, FR/EN appariées). **Preuves** : `list-window.t257.test.ts`
  **3/3** (base réelle : 23 chambres → aucun bandeau ; 26 lignes → « 25 résultats affichés sur 26 » ;
  messages 26 fils idem) et `reviews-page.t258.test.ts` **3/3** (bien porté à 24 avis : compteur, lien,
  fiche toujours bornée à 5 ; page 1 = 20 lignes avec `?page=2`, page 2 = fin de liste ; slug inconnu →
  `notFound()`) ; fixtures purgées et agrégats recalculés en `afterAll`. **Preuves de chaîne** :
  `npm run ci` **verte** (typecheck 0 · lint 0/0 · i18n 6 candidats pré-existants · `ai:check` **20 OK
  / 0 warn / 0 fail** · vitest **138 fichiers / 761 tests passés (789 collectés, 28 ignorés)** · build
  + 67 pages · smoke **95/95**). Rapports : `REPORTS/validation_T257_T258_2026-09-11_audit6_B4_B5.md`,
  `REPORTS/analyse_impact_T257_T258_2026-09-11_audit6_B4_B5.md`,
  `REPORTS/analyse_conception_T257_T258_2026-09-11_audit6_B4_B5.md`. **Runtime** :
  `/dashboard/rooms` hôte → 200 sans bandeau (23 chambres) puis « 25 résultats affichés sur 26 » après
  3 créations (`?limit=50` → 26/26 sans bandeau) ; fiche à 24 avis (sonde) → « 24 avis » + « Voir les
  24 avis » + 5 avis seulement dans la section ; page dédiée → 20 avis en page 1 (« page 1 sur 2 »),
  fin de liste en page 2, EN servi (« Reviews », « Back to the property »), slug inconnu → 404 ; base
  rendue à l'état seed (8 users / 8 annonces / 23 rooms / 30 réservations / 21 avis, 0 favori, 0
  alerte, 0 conversation). **B6 → T-259** : `descriptionEn` (≤ 4 000), `state` (≤ 100, colonne
  `varchar(100)`) et `latitude`/`longitude` (bornées −90..90 / −180..180, virgule décimale normalisée,
  `""` ⇒ `null`, affichage sans zéros inutiles via `src/lib/coordinates.ts`) entrent dans les schémas
  POST/PUT **et** dans les formulaires (description EN + coordonnées dans l'éditeur, région aussi à la
  création) ; la page `[id]` transmet les quatre colonnes à l'éditeur pour ne pas les effacer. Verrou
  i18n **1742 → 1748** (+6). Preuves : `route.t259` 4/4, `coordinates` 3/3, vitest complet **142
  fichiers / 796 tests**, sonde runtime (« 43,769 » → `43.76900000`, relecture « 43.769 », valeurs du
  seed restaurées). Rapports : `REPORTS/validation_T259_2026-09-11_audit6_B6.md` (+ impact et
  conception). **Reste** : lot D (B8/B10/B12 — le crédit gelé reste **non consommable**) puis lot C
  (B7/B9). **B8 → T-262** : la suppression de compte trace et signale le crédit gelé sans jamais le
  consommer — encart conditionnel dans la zone de danger et ligne `wallet_transactions`
  `account_closed` (montant 0, `balanceAfter` = solde) écrite dans la transaction par
  `recordAccountClosureEntry()` (verrou `wallet-policy` étendu) ; verrou i18n **1748 → 1749** ; preuves
  `route.t262` 2/2, `delete-account-section` 2/2 et sonde runtime (solde `12.50` inchangé après
  suppression). **B10 → T-263** : les 5 résidus T-207 sont récapitulés dans `KNOWN_LIMITATIONS.md`
  (conditions de retrait comprises) et marqués `// legacy:` sur les deux sites de compatibilité —
  aucune route supprimée. **B12 → T-264** : limiteur en mémoire énoncé dans la checklist de
  production (`docs/CI.md`) + avertissement **unique** en production sans `REDIS_URL`
  (`rate-limit.test.ts` 11/11). **T-260 → lot C (1/2)** : `/recherche` expose le tri « Populaires », la note minimale, « Autour de moi » (`near` 25 km, repli « saisissez une ville », puce de rayon actif) et la recherche libre `search` (nom, ville, description — `?city=` inchangé) ; la distance est filtrée en SQL pour que `total`/`totalPages` restent justes ; verrou i18n **1749 → 1762** ; preuves : `geo-distance` 8/8, `search-near-me-button` 1/1, vitest **146 fichiers / 812 tests**, sondes runtime FR/EN. **T-261 → lot C (2/2)** : préférences de notification par utilisateur — colonne additive `users.notification_prefs` (jsonb **nullable**, migration `0025` ; `NULL` = héritage du réglage global, donc envoi inchangé pour les comptes existants), trois catégories réglables (rappels de séjour J-3/J-1, demandes d'avis, décisions de modération), helper `src/lib/notification-prefs.ts` appliqué aux rappels/demandes d'avis (voyageur), à la modération d'avis (auteur) et aux décisions d'annonce (hôte) — **le réglage global reste maître** ; `PATCH /api/users/me` (objet strict, `null` = effacer) + `GET /api/auth/me` ; écran `/mon-compte` étendu. Preuves : `notification-prefs` 10/10, `route.t261` 5/5, `booking-lifecycle-emails.t261` 2/2, composant 2/2, sonde runtime PATCH/GET/400/reset ; verrou i18n **1762 → 1768**. **Audit n°6 entièrement soldé (B1 → B12)**. `STATE.md` est à rafraîchir en fin de session (R7 : un
  commit ne peut pas citer son propre SHA).
- **✅ Audit n°6 — CLOS le 2026-09-11 (B1 → B12)** : lot A `11165d4` (B1/B2/B3/B11), lot B
  `76ec5b9` (B4/B5) + `dfd0a5e` (B6), lot D `7e71914` (B8 : crédit gelé signalé et journalisé,
  **aucune consommation**) + `130831e` (B10 résidus T-207 récapitulés, B12 rate-limit en mémoire
  énoncé), lot C `04d906e` (B7 recherche complète : tri « Populaires », note minimale, « Autour de
  moi », `search`) + `49f4c69` (B9 préférences de notification par utilisateur, migration `0025`).
  **CI finale verte, EXIT=0** : ai:check **19 OK · 1 warn (R7)** · i18n warn-only · vitest
  **148 f passés + 2 ignorés / 803 t passés + 28 ignorés** (831 collectés ; base réelle : 150 f/831 t) ·
  build **67/67** · smoke **95/95**. Verrou i18n **1749 → 1768** (T-260 +13, T-261 +6). Base remise à
  l'état seed après sondes (8 users seed + 14 comptes `t235-*@test.local` préexistants d'anciens tests,
  8 properties, 23 rooms, 32 bookings, 21 avis ; `notification_prefs` **toutes NULL**, `price_alerts` 0,
  `wishlist_items` 0, `cron_runs` 0, `wallet_transactions` 0, `stop_sell` 0). Aucun item 🔴/🟠 ouvert :
  l'audit n°6 est entièrement soldé. **HEAD Git (dernier commit de code)** : `49f4c69` — ce fichier est
  réécrit au-dessus de lui et ne peut donc pas citer son propre SHA (motif R7 toléré, warn attendu).

- **HEAD Git précédent** : `6acdd82` (dernier commit figé, au-dessus) — **IMPLÉMENTATION DE L'AUDIT N°5 (T-245 → T-250), 2026-09-11** : les huit constats A1→A8 sont soldés (A4/A5/A8 l'étaient déjà par T-249/T-251/T-252). **T-247 (A3)** : trois `window.prompt` remplacés par un `Dialog` accessible (rôle, `aria-modal`, piège de focus, Esc, retour du focus) et `ReasonDialog` (motif obligatoire, compteur 0/500, envoi bloqué si vide) ; `reviews/[id]/moderate` refuse `hidden`/`rejected` sans motif (400 `issues.field=moderationReason`, motif conservé dans `audit_log`) — 8 tests route + 4 composant. **T-245 (A2)** : **fenêtre progressive** sur les 6 écrans de liste (`dashboard/bookings|users|reviews|properties|promotions`, `mes-reservations`) car filtres, tri et compteurs y sont côté client — `parsePageWindow` (25 par défaut, +25, plafond 500, `queryLimit = taille + 1`) et `<ShowMore>` (compteur « N sur M », « Afficher 25 de plus », « Tout afficher », avertissement de plafond, note de périmètre) ; pagination **opt-in** de `GET /api/bookings` et `GET /api/messages` (sans paramètre la réponse historique est identique ; avec `limit` 1-100 / `offset` ≥ 0 et `X-Total-Count` ; `limit=0/-3/abc/1.5`, `offset=-1` → 400) — 11 tests `page-window`. **T-246 (A1)** : favoris multi-listes — tri stable + `defaultWishlistId` (le cœur n'écrit plus dans un `wishlists[0]` implicite), renommage par `PATCH name` (1-80, `trim`, partage intact), `POST /api/wishlists/move` **transactionnel** (insertion cible puis suppression source ; 404 liste d'un tiers ou favori absent de la source, 400 listes identiques ou bien déjà présent), sélecteur de liste sur le cœur et « Déplacer vers une liste » sur `/mes-favoris` — 4 tests route. **T-250 (A7)** : supervision des crons — table `cron_runs` (migration **0023**) alimentée par `runWithTrace` (trace best-effort : une panne de la table ne casse jamais la tâche métier), `getCronHealth` (`ok` / `stale` au-delà de 3 périodes / `failed` / `missing`) exposé par `/api/health` **sans changer son contrat** (HTTP 200 conservé, champs `cronStatus`/`crons[]` additifs) et écran `/dashboard/cron` (lien sidebar + menu mobile), purge 90 jours intégrée à `purgeTechnicalData()` — 5 tests. **T-248 (A6, étapes 1-2)** : journal du wallet — table `wallet_transactions` (migration **0024**, append-only : `amount` **signé** en EUR, `balance_after`, `kind` ∈ `cashback|referral_referee|referral_referrer|booking_refund|booking_payment|manual_adjustment`, `booking_id`, `actor_id`, `note`) écrite **dans les 4 transactions** qui mutent le solde (clôture de séjour : cashback + bonus filleul + bonus parrain ; remboursements `booking-benefits` et `booking-request-expiration`) — `users.wallet_balance` **reste la source de vérité**, un échec du journal annule le crédit (prouvé) ; `GET /api/wallet/transactions` en lecture seule (20 derniers, pagination opt-in) et carte « Historique des mouvements » dans `/mon-compte` — 5 + 3 + 3 tests. Verrou i18n **1683 → 1739** (+5 T-247, +5 T-245, +13 T-246, +22 T-250, +11 T-248), FR et EN appariées. **Preuves** : `npm run ci` **verte** (typecheck 0 · lint 0/0 · i18n 0 candidat · vitest **135 fichiers / 775 tests, 0 échec** · build production · smoke **95/95**) · `ai:check` **19 OK / 1 warn / 0 fail** (warn R7 : ce fichier ne peut pas citer le SHA du commit qui le contient) · runtime réel (bandeau « 25 résultats affichés sur 30 » puis `?limit=50` → 30/30 sans bandeau ; `?limit=999999` → avertissement de plafond ; `limit=5` → 5 lignes + `X-Total-Count: 30` ; 5 bornes invalides → 400 ×5 ; `/api/health` → `cronStatus: missing` avant exécution puis `ok` avec compteurs et durée ; `/dashboard/cron` 200 admin (`data-status="ok"`) et 307 pour un voyageur ; `/api/wallet/transactions` 200 / 401 / 400). Base remise à l'état seed après les sondes (8 users / 8 annonces `active` / 30 réservations / 21 avis ; `price_alerts` 0, `wishlist_items` 0, `cron_runs` 0, `wallet_transactions` 0, comptes `@test.local` supprimés). **Décision produit T-248 §3 tranchée le 2026-09-11 : gel explicite du programme** — le solde BestRewards est un **crédit futur** tracé (journal + historique), non déductible ; les libellés FR/EN qui parlent du solde annoncent le gel (`account.walletHint`, `account.availableBalance`, `search.walletBanner`, `reservation.walletReductionNote`, `bestrewards.benefitCashback`, `bestrewards.how3Desc`, `bestrewards.faq4A`) et `src/lib/wallet-policy.test.ts` (3 tests) verrouille la décision (échec si les libellés cessent d'annoncer le gel ou si une déduction réapparaît), consignée dans `.ai/KNOWN_LIMITATIONS.md`. Verrou i18n inchangé (**1739** : valeurs révisées, aucune clé ajoutée). **Plus aucune ligne de l'audit n°5 ouverte.** `STATE.md` a été réécrit au-dessus du commit d'implémentation ; il reste **à mettre à jour en fin de session** (motif R7) car il ne peut pas citer son propre SHA. **Livraison précédente** : `9afae29` — **audit n°5 (exécution) + correctifs courts T-249 / T-251 / T-252** : cinquième passe d'analyse à l'exécution (`docs/analyse_2026-09-11_audit_runtime_execution.md`, copie `REPORTS/analyse_runtime_n5_2026-09-11_execution.md`) — scénarios métier rejoués (promos 200/200/400/404, stop-sell de bout en bout avec recherche 8 → 7 et devis/réservation 409, réponse d'hôte publiée sur la fiche, heure d'arrivée dans les 2 e-mails, alerte de prix créée/supprimée par la route de l'UI, disponibilité de chambre posée par l'hôte propriétaire) et surfaces jamais sondées (volumétrie des listes, cycle de vie d'une liste de favoris, motifs de modération, traçabilité du wallet, supervision des crons) → **8 constats A1→A8**, tâches **T-245 → T-252** au BACKLOG (rapports d'impact et de conception `T245_T252_2026-09-11_execution.md`). **Trois correctifs courts livrés et prouvés** : **T-249** (A4 — `sortIgnored` + liste blanche `SORT_VALUES` alignée sur le moteur, clé `search.warn.sortIgnored` FR/EN, verrou i18n **1682 → 1683** ; l'API reste tolérante, seul le bandeau T-175 explique désormais le tri écarté) ; **T-251** (A5 — `checkParticipant` discriminé : conversation absente → **404** « Conversation introuvable » `code: CONVERSATION_NOT_FOUND`, tiers → **403** inchangé `code: CONVERSATION_FORBIDDEN`, variante alignée sur `/messages/[id]`, traduction EN ajoutée) ; **T-252** (A8 — `src/lib/wallet-currency.ts` + 8 tests supprimés car plus aucun appelant depuis T-207, `useWalletCredits` et la décision documentés dans `KNOWN_LIMITATIONS.md` avec renvoi à T-248). Preuves : `npm run ci` **verte** (typecheck 0 · lint 0/0 · i18n · `ai:check` **19 OK / 1 warn / 0 fail** — warn R7 documenté, ce fichier ne pouvant pas citer son propre SHA · vitest **126 fichiers / 709 tests passés (737 collectés, 28 ignorés par leur sonde DB)** · build production · smoke **95/95**) ; runtime : bandeau tri présent uniquement sur `sort` inconnu (API properties toujours 200), `GET /api/messages` uuid inexistant → 404 + code, `?sort=price_asc` sans bandeau. Compteurs vitest cohérents (743 − 8 tests `wallet-currency` + 2 ajoutés = 737 ; 129 − 1 fichier = 128). Base remise à l'état seed après les sondes (8 users / 8 annonces `active` / 35 réservations / 26 avis ; `review_votes` 0, `price_alerts` 0, `stop_sell` 0, `host_reply` 0, `wishlists` 1, `conversations` 0). **Reste à mener** : T-247 (dialogues de motif + `moderationReason` requis) → T-245 (pagination RSC + API opt-in) → T-246 (favoris multi-listes) → T-250 (supervision des crons) → T-248 (journal du wallet, après décision produit sur sa consommation). **Puis** : `6dcabb6` — **T-241 (audit n°3 : F11 + F12 + F13)**, au-dessus de `f071e8b` (**T-235 → T-239** : quota de réservation scindé garde-fou 60/h / quota produit 10/h avec clé invité par cookie signé et 429 portant le délai ; heure d'arrivée estimée validée `HH:MM` et restituée fiche hôte, espace voyageur et 4 e-mails FR/EN ; décision de validation d'annonce persistée (`properties.review_reason`, migration 0022), affichée à l'hôte et notifiée par un e-mail idempotent avec interrupteurs admin ; lien de wishlist partagée en `noindex`/`nofollow` avec rotation prouvée ; désabonnement réel par jeton HMAC et page `/desabonnement`, pied d'opposition sur les alertes prix et page Confidentialité corrigée FR/EN) et de `863978e` (**T-232 / T-233 / T-234 + volet T-240** : helper unique de dates civiles `src/lib/dates.ts` et 0 `toLocaleDateString` restant, cascade transactionnelle de suspension d'hôte, expiration paresseuse des demandes dans la transaction du tunnel, tests multi-fuseaux). **T-241** : (a) « supprimé » ≠ « suspendu » — vérifié déjà livré par T-230 (`suspended_at` / `deleted_at` distincts, « Compte anonymisé — non réactivable ») ; (b) analytics — période `?from&to` en dates civiles (`src/lib/analytics-period.ts`, défaut historique 30 j inchangé, borne 366 j), agrégats extraits dans `src/lib/analytics.ts` pour que l'écran et l'export CSV affichent les mêmes nombres, sélecteur + export CSV localisé `GET /api/dashboard/analytics/export` (Résumé / Revenus par jour / Top hébergements, devises séparées, anti-formule) ; (c) erreurs d'API — `zodIssues`/`zodErrorResponse` renvoient `{ error, issues: [{ field, message }] }` traduits sur 20 routes et 8 schémas de mutation passent en `.strict()` : un champ inconnu est refusé en 400 au lieu d'un 200 silencieux. Preuves : `npm run ci` **verte** (typecheck 0 · lint 0/0 · i18n 0 candidat, catalogue **1682** · vitest **129 fichiers / 743 tests, 0 échec** · build · smoke **95/95**) · `ai:check` **19 OK / 1 warn / 0 fail** (warn R7 documenté : un commit ne peut pas citer son propre SHA) · runtime réel (export CSV 200 par défaut et sur période explicite, 400 sur période inversée, 403 sans session ; page analytique 200 avec et sans paramètre ; `PUT /api/bookings/[id]` champ inconnu → 400 nommant le champ, 6 essais invalides → 400 ×6 puis demande valide → 201 ; `/desabonnement` 200 `noindex` et préférence basculée ; fiche hôte « Heure d'arrivée estimée : 15:30 » ; rotation de wishlist ancien lien 404 / nouveau 200). Rapports : `REPORTS/validation_T241_2026-09-11_analytics_erreurs_api.md`, `REPORTS/validation_T235_T239_2026-09-11_audit3_f4_f8.md`, `REPORTS/validation_T232_T234_2026-09-10_dates_suspension_expiration.md`. Base remise à l'état seed (8 users / 8 annonces `active` / 35 réservations / 26 avis), sondes et comptes de test supprimés. **Aucune tâche 🔴/🟠 ouverte** : T-232 → T-241 sont livrés et prouvés. Rappel : `STATE.md` est à mettre à jour en fin de session (motif toléré R7) — ce fichier étant mis à jour par un commit, il ne peut pas citer le SHA du commit qui le contient.
  **mise en œuvre des remarques de l'audit e-mails** — garde UI `shouldShowStripeForm`
  (flux manuel → jamais d'UI carte, testé 5/5) ; e-mail annulation + price-alert
  **prouvés runtime** (mails console réels, localisés fr/en, idempotents).
  **Précédent T-203** :
  **fiabilisation du scénario « paiement manuel »** — un hôte/admin peut
  **constater le paiement sur place** (`PUT /api/bookings/[id]
  {markPaidOffline:true}` → `paymentStatus:"paid"` + `paymentMethodOffline:true`,
  audit `booking.pay.offline`), ce qui débloque les **versements/revenus**
  (pipeline `payout` filtre `paid` — corrigé indirectement, sans toucher au
  calcul). Les **demandes manuelles ne sont plus expirées** après 15 min
  (`paymentExpiresAt:null` sans `payOnline` + cron limité aux bookings avec
  `paymentIntentId`). UI : bouton/badge **« Payé sur place »** + masque
  « Payer maintenant » pour les manuels ; **i18n**
  (**book.markPaidOffline**, **book.paymentAwaitingHost**) → catalogue **1479**.
  **Zéro régression du tunnel Stripe/PSP ni du webhook** (intacts).
  **Complément d'audit (e-mails) — P7 + P3** : l'e-mail de confirmation ne
  partait que du flux de paiement en ligne ; la confirmation **manuelle par
  l'hôte** (paiement sur place) ne produisait **aucun e-mail**. Corrigé :
  `PUT /api/bookings/[id] {status:"confirmed"}` appelle désormais
  `sendBookingConfirmationIfNeeded(id)` (best-effort, post-commit) et la
  fonction ne conditionne plus l'envoi à `paymentStatus:"paid"` (une
  réservation confirmée avec paiement encore `pending` reçoit bien son e-mail) +
  respect du toggle `notifications.bookingConfirmation`. P3 : l'écran de
  confirmation manuelle (`reservation-form.tsx`) affiche « 📩 Demande envoyée » /
  « Montant à régler sur place » au lieu de « 🎉 C'est confirmé ! / Total payé »
  (clés `reservation.manualRequestSent/RequestBody/AmountOnSite`).
  Preuves : 🔨 tsc 0 · eslint 0 · i18n **1482** · build 64 pages · 🧪 vitest
  **554 (85 files, +3 tests)** · ▶️ runtime (réservation manuelle
  `paymentExpiresAt:null`, confirmation hôte `confirmedBy`, paiement sur place
  `paid`+`offline`, RBAC 403, cron non-expiration, **e-mail confirmation
  `:guest`+`:host` émis**, rappel J3 + demande d'avis par cron) · ✅ ai:check
  19 OK · 0 fail · `npm run ci` **verte**.
  **Précédent** :
  **T-202 IMPLEMENTÉ (VALIDÉ)** (2026-09-07) :
  validation hôte par l'admin (`users.approvalStatus` + `users.commissionRate`,
  routes `/api/admin/hosts[/id]`, gate de publication) + **paiement manuel**
  (`POST /api/bookings` ne déclenche plus de paiement auto → `pending`,
  `payment:null`, `manualConfirmation:true` ; webhook Stripe ne force plus
  `confirmed`) + **statuts gérés à la main par l'hôte** (`pending→confirmed`
  via `bookings/[id]` avec `confirmedBy` ; `booking-lifecycle` : host_all).
  Preuves : 🔨 tsc 0 · eslint 0 · i18n **1477** · build 64 pages · 🧪 vitest
  **546/546** · ▶️ runtime (réservation pending sans paiement, confirmation
  manuelle par l'hôte, gate validate→409) · ✅ ai:check 19 OK · 0 fail.
  **Précédent** :
  **T-195 CORRIGÉ P6–P9** (2026-09-07) :
  versements hôtes/admins (Phase C, S1) + webhook `payout.*` + correctifs
  **P1–P9** (gaps) : P1 cron de versement réellement déclenché (`GET` sur
  `/api/cron/payouts` par le runner local ET le cron Vercel, `POST` conservé,
  `vercel.json` enrichi) ; P2 exécution avec la **vraie référence** déchiffrée
  (`openPayoutAccountReference`) + **garde-fou devise** (payout de devise ≠
  compte → `pending`/`skipped`, jamais transféré) ; P3 **chemin admin**
  réparé — agrégation **par (hôte, devise)**, l'admin n'exécute jamais le
  versement d'autrui ; P4 audit `payout.paid`/`payout.failed` journalisé par
  le webhook ; **P6** bouton de versement **par devise** (`PayoutRequestButton`
  envoie `currency`, la route POST ne traite que cette devise) ; **P7**
  garde-fou devise **visible en UI** (consomme `skipped[]` → `payouts.skippedCurrency`,
  `hasAccount===false` → `payouts.accountMissing`) ; **P8** « Factures » vs
  « CSV » clarifié (les exports de la carte Versements pointent vers
  `/export-payouts`, pas vers l'export bookings) ; **P9** route
  `GET /api/dashboard/billing/export-payouts` (export CSV du ledger
  `payouts`, host/admin). Preuves : 🔨 tsc 0 · eslint 0 · build 63 pages ·
  🧪 vitest **536/536** (80 fichiers) · ▶️ runtime prod (base seedée) : `GET
  /api/cron/payouts` → 200 (avant 405) ; hôte compte EUR + booking XAF → EUR
  `paid`, XAF `skipped`/`pending` ; admin GET `projected` = 2 (avant `[]`) ;
  admin POST → `skipped` (non-propriétaire) ; webhook `payout.paid` → audit
  `payout.paid` présent ; POST `currency=XAF` → `skipped[]` XAF seul /
  `currency=USD` → 404 ; `GET /api/dashboard/billing/export-payouts` → CSV
  ledger versements / `/export` (bookings) conservé. 🔍 i18n:check 0
  (catalogue **1462**) · ✅ ai:check 19 OK · 0 fail. Partie **externe**
  Stripe Connect → **CORRIGÉ (INSPECTION)** (§13.5). Précédente (même jour) :
  **T-193** —
  audit runtime site-wide outillé (`npm run site:audit` : 236 pages
  crawlées ×5 profils, 0 issue) ; **T-192** —
  KNOWN_LIMITATIONS purgé (7 lignes obsolètes, probes à l'appui) +
  `npm run env:restore` (restauration sandbox idempotente, testée).
  npm run ci VERT (484/484 + smoke 94/94) ; **T-191** —
  CI reproductible `npm run ci` (ordre vitest→smoke imposé ; eslint dur
  `--max-warnings 0`) ; workflow GHA livré sous `docs/` (activation
  bloquée : permission `workflows` absente de l'App). Preuve `npm run ci`
  VERT (EXIT=0 : 484/484 vitest + smoke 94/94). Précédente (même jour) :
  **T-190** — resynchronisation BACKLOG (audits 28/30 listés « à arbitrer »
  mais livrés le 2026-08-30 — probes : 400 dates passées, 404 partage,
  pages légales EN, cron ok) + restauration env sandbox
  (install/db:push/seed/build ; cron 500 → réparé
  `ALLOW_MOCK_PAYMENTS=true`). eslint 0/0, tsc 0, vitest 484/484, smoke
  94/94, build 60/60. Précédentes (même jour) :
  **T-189** (hygiène hooks/eslint 11→0, `useT()` stabilisé) ; **T-188**
  (SmartImage site-wide + cron preview vivant) ; **T-174** —
  favoris figés après login (cache module, famille T-173) → invalidation
  réactive `WISHLISTS_CHANGED_EVENT` ; audit exhaustif : **2/2** caches
  client couverts, layouts sains. vitest **438/438**, build 0, smoke
  94/94, ai:check 20/0/0. Précédentes (même jour) :
  **T-173** (invalidation préférences après login/register SPA) ;
  **T-172** —
  audit d'exécution des scénarios (crawl runtime FR/EN × rôles) →
  métadonnées localisées sur 11 pages (wrappers serveur pour les 6 pages
  client, clés `search.meta.*` orphelines câblées), `noindex` sur zones
  privées + `/dashboard`, défaut `supportedLocales: ["fr","en"]`,
  catalogue **1416** FR=EN. Preuves : 🔨 tsc+build 0 · 🧪 vitest
  **432/432** (DB) · ▶️ smoke **94/94** · 🔍 i18n:check 0.
  Session précédente : T-168 (i18n 100 % facture/placeholders/API) —
  T-167 (vague 3 UI) inclus. Le workflow `.github/workflows/ci.yml`
  (T-113) reste hors suivi git (permission `workflows` du jeton).
- **Version Framework** : AI-DOS 3.0.1
- **Dernière activité (2026-08-30)** : **audit fonctionnel profond n°30
  implémenté (T-160→T-166, sans régression)** — T-160 purge 122 wishlists
  d'artefacts + refactor 1 requête/compteur dédupliqué · T-161 alertes
  dates passées **400** + expiration cron `active=false` · T-162 les 5
  pages publiques localisées (métadonnées+libellés+pluriels fr/en) ·
  T-163 partage invalide **404 réel** (proxy — écart documenté :
  `notFound()` dans `generateMetadata` reste 200 avec streaming Next
  16.2.6) · T-164 sélecteur devise `initialLanguage` SSR ·
  T-165 `appBaseUrl()` (e-mails jamais relatifs) · T-166 hygiène runs.
  Preuves : 🔨 tsc 0 · build prod 0 err · 🧪 vitest **60 fichiers/403
  tests · 0 échec · 0 skip** · ▶️ `run_all_sims.py` **5/5 · 396 OK ·
  3 WARN · 0 KO** · ▶️ probes `.data/a30/regression.mjs` **18/18** ·
  ✅ ai:check 19 OK · 1 warn R7 (motif toléré) · 0 fail.
  Rapport : `REPORTS/audit_fonctionnel_profond30_2026-08-30.md`.
  Précédent (même jour) : audit n°27 — T-155 livré/validé
  — remédiation des 9 KO du runner unifié : **P2** code promo inconnu →
  **400** (`PromoCodeNotFoundError` dans `src/app/api/bookings/route.ts`) ;
  **P3** `/recherche?amenity=` matche aussi `rooms.amenities`
  (`tv`/`minibar` → 8 propriétés, avant 0) ; resynchronisation des garde-fous
  (simulate/paranoid `/reservation` publique T-109, deep 2fa
  password+code/upload key+size, xtreme mails par `To:`, smoke nettoyage
  réentrant, `_run`/`sh()` anti-timeout + retry).
  🔨 tsc 0 · 🧪 vitest **372/372** · ▶️ `run_all_sims.py` **5/5 · 396 OK ·
  3 WARN · 0 KO** (smoke 94 · surface 68 · deep 80 · xtreme 83 · paranoid 71).
  Précédent (même jour) : audit n°26 100 % implémenté (T-154a→e) — vitest
  372/372, smoke 94/94.
- **Dernière tâche implémentée précédente** : **T-153 (S, implémenté et validé)**
  — implémentation des 7 findings de l'audit n°25 (rapport
  `audit_fonctionnel_profond25_2026-08-30.md`) : **A** wallet EUR appliqué
  à un total devise chambre (`applyWalletToTotal`, `wallet_credits_used`
  stocké/débité en EUR, jamais 1:1) ; **B** promos EUR normalisées +
  `GET /api/promotions/apply?currency=` additif ; **C** cashback cron
  calculé sur le total converti en EUR ; **D** limite `notFound()` → HTTP
  200 documentée dans `KNOWN_LIMITATIONS.md` ; **E** `€` durs restants →
  `formatPrice(…, devise)` (dashboard rooms, mon-compte,
  bestrewards-status, promo-code-input) ; **F** `/recherche?wallet=1` +
  bandeau solde réel ; **G** badge « Avis bientôt disponible ». Preuves :
  tsc 0 · lint 0 erreur · **vitest 340/340 (+23)** · smoke **94/94** ·
  build OK · ai:check 19/1/0 · runtime A/B/C/F/G prouvé (booking USD
  137,67 $, `walletCreditsUsed` 25,00 €, wallet 25,00→0,00 ; promo API USD
  21,60 vs 20,00 historique ; cron 200 $ → cashback 9,26 € ; bandeau
  wallet ; badge avis). Détails :
  `REPORTS/validation_T-153_2026-08-30.md`. Sans migration DB, sans retrait
  de contrat public, cas EUR identiques. Données de preuve nettoyées
  (DB = baseline).
- **Dernière tâche validée précédente** : **T-152 (2026-08-30)** — implémentation des
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

## Session 2026-08-30 — audit fonctionnel profond n°29 (implémenté + validé)

- Tâches T-156/T-157/T-158/T-159 **CORRIGÉ (VALIDÉ)** — voir
  `.ai/REPORTS/audit_fonctionnel_profond29_2026-08-30.md` et
  `.ai/TRACEABILITY.md` (preuves rejouables).
- Preuves : 🔨 tsc 0 · 🧪 vitest **57 fichiers / 390 tests** · ▶️
  `run_all_sims.py` **5/5 · 396 OK · 0 KO** · ▶️ probes **30/30** ·
  ✅ ai:check.
- Compteurs : `sessions_since_last_product_audit: 0` (audit produit exécuté
  ce jour) ; branche `arena/01a052ed-mybestbooking`.
- HEAD Git : à mettre à jour en fin de session (motif toléré R7 ;
  commit de clôture audit n°29 poussé : `39bf3b3`).

## Session 2026-08-30 — audit fonctionnel profond n°30 (rapport rendu)

- Tâches T-160→T-166 **AUDIT (rapport seul, à arbitrer)** — voir
  `.ai/REPORTS/audit_fonctionnel_profond30_2026-08-30.md` et
  `.ai/TRACEABILITY.md` (preuves runtime rejouables).
- Preuves : ▶️ `.data/a30/audit.mjs` (sessions réelles, mutations
  nettoyées) + curl cookie `en` (5 pages publiques) + état DB
  (123 wishlists, vote préexistant) + inspection code (N+1, APP_URL, cron).
- Compteur : `sessions_since_last_product_audit: 0`.
- HEAD Git : à mettre à jour en fin de session (motif toléré R7 ; audit
  n°30 rapport seul, aucun commit src attendu pour l'instant).

## T-175 — 2026-09-01 | Feedbacks filtres de recherche : CORRIGÉ ✅ VALIDÉ

- Audit d'exécution des scénarios : `/recherche` en 9 instantanés live
  (saines/inversées/passées/malformées) → silence utilisateur documenté.
- Brique pure `src/lib/search-warnings.ts` + bandeau `role="alert"` FR/EN
  (+4 clés → 1420) ; **moteur de filtrage inchangé** (zéro régression).
- Titre état réservation : « manquantes ou invalides ».
- Preuves : vitest 445/445 (67 fichiers) · tsc/build prod 0 (60/60) ·
  eslint 0 · smoke **94/94** · runtime FR/EN validé · i18n:check 0 candidat.

## T-176 — 2026-09-01 | Deep-links réservation : CORRIGÉ ✅ VALIDÉ

- Tunnel de réservation : liens incomplets (`room` seule, `property` seule)
  rattrapés (résolution API / redirection fiche) au lieu de l'impasse.
  Lien complet, `?booking=` et état 「 manquantes 」 : inchangés.
- Audit d'exécution : avis client↔hôte, messagerie, alertes prix, partage
  favoris, annulation — tous éprouvés sains avec données réelles.
- Preuves : vitest **450/450** (67 fichiers, +5) · tsc/build 0 (60/60) ·
  eslint 0 nouvelle alerte · smoke **94/94** · runtime post-build 4 formes.

## T-177 — 2026-09-01 | Disponibilité fiche hébergement : CORRIGÉ ✅ VALIDÉ

- Fiche : chambre épuisée sur dates valides → « Complet pour ces dates »
  au lieu du 409 final de tunnel ; sans dates → rendu inchangé (mesuré).
- Le moteur de refus (surbooking/reprise paiement/validation) éprouvé sain
  par campagne API réelle — aucun correctif métier requis.
- Preuves : vitest **456/456** (68 fichiers, +6) · tsc/build 0 (60/60) ·
  eslint 0 · smoke **94/94** · runtime 4 formes FR/EN · i18n:check 0.

## T-178 — 2026-09-01 | Lenteur constatée : CORRIGÉ ✅ VALIDÉ

- Preview Arena servie en **production** (pages pré-générées 60/60) :
  mesures 10–24 ms contre 90–200 ms / 2,2 s à froid en dev.
- Paiements : opt-in `ALLOW_MOCK_PAYMENTS=true` pour la démo ; la garde
  « prod ⇒ vrai Stripe » reste le défaut (couvert par 2 tests).
- `scripts/smoke.sh` transmet `x-seed-token` si défini → smoke **94/94**
  rejoué sur la production.
- Preuves : vitest **458/458** (68 fichiers) · tsc/build 0 · smoke 94/94.

## T-179 — 2026-09-01 | Garde maintenance pages : CORRIGÉ ✅ VALIDÉ

- Avant : maintenance ON → les pages restaient servies (redirect avalé dans
  le layout ; `/` hors groupe (main)). Seules les écritures API bloquaient.
- Après : vrai 307 `/maintenance` au proxy dès le chargement, sur tout le
  site ; admins et `/connexion` passent (anti-lockout) ; sonde en échec =
  passthrough loggé ; redirections tracées côté serveur.
- Audit admin exécuté : modération avis bouclée (pending→approuvé→masqué,
  agrégat recalculé) ; API 503 en maintenance ; RBAC — sains.
- Preuves : vitest **465/465** (69 fichiers, +7) · tsc/build 0 (60/60) ·
  eslint 0 · runtime prod ON/OFF · smoke **94/94**.

## T-180 — 2026-09-02 | Impasse « devenir hôte » : CORRIGÉ ✅ VALIDÉ

- Audit d'exécution en prod (12 zones) : promotions de bout en bout
  (création admin → simulation → consommation réelle, `currentUses`
  vérifié en SQL), facture HTML, export CSV hôte, parrainage, suspension
  (coupure totale 401), reset mdp à usage unique, BestRewards, profil,
  conversations, cycle de vie propriété (PUT, admin-only) — **tous sains**.
- Défaut retenu : footer « Ajouter mon hébergement » envoyait **tout le
  monde** sur `/dashboard/properties/new` → voyageur connecté : 307 → `/`
  muet ; anonyme : aller-retour connexion→accueil.
- Correction : `src/lib/host-entry.ts` — `hostEntryHref(role)` (hôte/admin
  → dashboard **inchangé** ; voyageur/anonyme → `/inscription?role=host`)
  + `initialRoleFromSearchParam` (pré-coche « Hôte », casse stricte) ;
  `Footer(userRole?)` optionnelle, rôle passé par `(main)/layout.tsx` et
  `page.tsx` ; initializer `useState` client (pattern `referralCode`).
- Aucune auto-élévation : seule la création de compte hôte reste la porte.
- Preuves : vitest **470/470** (70 fichiers, +5) · tsc/build 0 (60/60) ·
  eslint 0 · runtime prod : href par rôle (`/`, `/recherche`) ·
  `/inscription?role=host` 200 · hôte non régressé (200 dashboard) ·
  i18n:check 0 · smoke **94/94** (SEED_TOKEN sourcé).
- Artefacts d'audit en base : promo `RENTREE2026` (uses=1), réservation
  promo payée, comptes `filleul-26639@` / `suspend-19467@` (suspendu) ;
  mot de passe customer restauré à `Customer123!` après test du reset.
- Prochaine : T-181 — suggestions dans `CURRENT_TASK.md`.


## T-181…T-185 — 2026-09-02 | Accélération non-régressive : VALIDÉ ✅

- Livré : cache TTL 60 s (recherche sans dates + fiche publique —
  `src/lib/read-cache.ts`, pattern jumeau settings T-179), headers HTTP
  conditionnels `/api/properties`, requêtes count+page et rooms+avis
  parallélisées, `npm run perf` (scripts/perf-baseline.sh).
- Écarté après MESURE (documenté, pas embarqué) : optimizer images (sandbox
  sans egress Unsplash → casserait tout) ; optimizePackageImports (0 octet).
- Jamais caché : disponibilité avec dates, tunnel de réservation, vues
  privées hôte/admin, payloads avec session (no-store).
- Preuves : vitest **476/476** (71 fichiers, +6) · tsc/eslint 0 · build
  60/60 · smoke **94/94** · i18n 0 · probes runtime (tri, pagination,
  non-fuite wallet, headers par cas). p50 : /recherche 84→12 ms chaud,
  fiche 80→15 ms, API 5 ms.

## T-186 — 2026-09-02 | Visuels locaux + optimizer images : VALIDÉ ✅

- Toutes les images `<Image>` servies localement (`/seed-images/*.jpg`,
  23 fichiers) ; optimizer activé : 350 Ko → 49 Ko (−86 %, mesuré).
- Rollout sans 404 via `seedImageUrl` (local si présent, legacy sinon) ;
  3 alias locaux documentés (quota génération 10/tour).
- Preuves : vitest **479/479** (72 fichiers) · tsc/eslint 0 · build
  60/60 · smoke **94/94** · i18n 0 · probes 200 · perf inchangée.
- Prochaine : T-187 (visuels dédiés des alias / purge artefacts audit /
  audit e-mails).

## T-187 — 2026-09-02 | Visuels dédiés + purge + audit mails : VALIDÉ ✅

- Alias → visuels dédiés (dest-tunis, hero, placeholder) : 227→129 Ko.
- Base purgée (0 artefact) ; audit mails : 6 types joués, tous sent.
- vitest 479/479 ×2 · smoke 94/94 · i18n 0 · probes 200.
- Prochaine : T-188 (<img> natifs → next/image ; audit cron alertes prix
  + BestRewards checkout ; dark mode P2).

## T-188 — 2026-09-02 | SmartImage + cron preview vivant : VALIDÉ ✅

- 11 `<img>` → SmartImage (optimizer si local, lazy si externe) ; fiche
  servie en srcset responsive via /_next/image.
- Cron preview actif (`npm run cron:local`, process Arena) : alerte prix,
  clôture (loyalty+parrainage), rappels, review requests — idempotent.
- BestRewards checkout prouvé (945 → 862,78 €, confirmed/paid).
- vitest **484/484** (73 fichiers) · tsc/eslint 0 · build 60/60 · smoke
  94/94 · i18n 0 · purge 0 artefact.
- Prochaine : T-189 (warnings hooks préexistants ; dark mode P2).

## T-189 — 2026-09-02 | Hygiène hooks/eslint (11→0) : VALIDÉ ✅

- `useT()` stabilisé ; 5 useEffect inscrivent `t` ; roomTypeLabel en
  useCallback (corrige le filtre i18n figé) ; `now` mémoïsé ; directives
  orphelines retirées. eslint **0 erreur / 0 warning** sur tout src.
- Aucune modification de comportement · vitest 484/484 ×2 · build 60/60 ·
  smoke 94/94 · probes 200.
- Prochaine : T-190 (dark mode P2 à cadrer / CI bases distinctes / footer
  marketing si scope décidé).

## T-190 — 2026-09-02 | Resynchronisation backlog audits 28/30 : VALIDÉ ✅

- Probes runtime : alertes prix dates passées → 400 ; partage invalide →
  404 ; pages légales EN servies ; cron price-alerts ok:true.
- Environnement sandbox restauré (DB seedée, prod 200, cron runner actif).
- Gates : eslint 0/0 · tsc 0 · vitest 484/484 · smoke 94/94 · build 60/60.
- Prochaine : T-191 (dark mode à cadrer / CI gates disjoints / T-108→112).
