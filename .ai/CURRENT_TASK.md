# 🎯 TÂCHE EN COURS

**Tâche :** Implémentation des remarques de l'audit fonctionnel profond n°15.
- **A1 (i18n/UX)** : plusieurs routes grand public exposaient les messages
  d'erreur **zod par défaut en anglais** (« Too small: expected number to be
  >=1 », « Invalid email address », « Too big… ») jusqu'au navigateur.
  Nouveau helper `frenchZodMessage()` dans `src/lib/http.ts` (traduit les codes
  natifs `too_small/too_big/invalid_format/invalid_string/invalid_type`,
  préserve les messages personnalisés déjà en français) ; appliqué aux routes
  `bookings`, `bookings/[id]`, `reviews`, `price-alerts`.
- **A2 (flux inachevé)** : après un rejet admin (`draft`) ou une suspension,
  l'hôte n'avait **aucun moyen de re-soumettre** son annonce (le changement de
  statut générique est réservé à l'admin → 403, et l'éditeur n'envoyait pas de
  statut) : l'annonce restait bloquée/invisible indéfiniment. Ajout de
  `POST /api/properties/[id]/submit` (hôte/propriétaire ou admin ; autorise
  `draft`/`suspended` → `pending` ; `active` → 409 ; `pending` idempotent ;
  l'hôte ne peut jamais s'auto-approuver) + bouton `PropertySubmitButton` et
  bannière explicatifs dans l'éditeur, badge de statut en français.
- **A3 (flux inachevé)** : email de vérification envoyé à l'inscription mais
  **aucun renvoi possible** (lien expiré 24 h/perdu → compte « non vérifié »
  sans recours). Ajout de `POST /api/auth/resend-verification` (auth requise,
  rate-limit 5/h, best-effort SMTP, déjà vérifié → message générique) +
  bannière/bouton `ResendVerificationButton` dans Mon compte ; page
  `/verifier-email?ok=0` corrigée (le message « inscrivez-vous à nouveau »
  était trompeur, l'email existe déjà → 409).
**ID** : T-137 — additif, aucune migration, aucune route d'écriture existante
cassée (1 nouvelle route POST de soumission, 1 nouvelle route POST de renvoi).
**Niveau** : L
**Statut** : **CORRIGÉ (VALIDÉ)** — 2026-08-29.

## Sortie (validé — T-137)

- 🔨 `tsc` 0 · `eslint` 0. 🧪 `vitest` **286 passés** (42 fichiers, +5).
- ▶️ `smoke` **94/94** · `build` ✓ (Compiled successfully, 59 pages) ·
  `ai:check` **19 OK · 1 warn · 0 fail**.
- ▶️ Exécution DEV : messages 400 en français (résa/adultes=0, email invalide,
  note 99, alerte prix négative) ; cycle propriété rejet→re-soumission hôte
  (`pending`)→approbation admin (`active`), hôte auto-approve 403, tiers 403,
  `active`→409 ; renvoi email → token vérifie le compte (ok=1), usage unique
  (ok=0), déjà vérifié → message générique, anonyme 401.
- Voir `REPORTS/validation_T-137_2026-08-29.md`.

---

## Tâche précédente — T-136 (audit n°14)

**Tâche :** Implémentation des remarques de l'audit fonctionnel profond n°14.
- **A1** : un voyageur pouvait voter « utile » sur son **propre** avis
  (gonflage du compteur). Garde serveur dans `reviews/[id]/helpful` → 400 si
  `reviews.userId === user.id` ; bouton `ReviewHelpfulButton` masqué
  (`isOwn`) sur la fiche pour l'auteur.
- **A2** : l'inscription d'un email déjà utilisé renvoyait 400 au lieu de
  **409 Conflict** (convention ressource existante) ; corrigé, les erreurs de
  validation restent en 400. Le front teste `!response.ok` (UX inchangée).
**ID** : T-136 — additif, aucune migration, aucune route d'écriture.
**Niveau** : L
**Statut** : **CORRIGÉ (VALIDÉ)** — 2026-08-29.

## Sortie (validé — T-136)

- 🔨 `tsc` 0 · `eslint` 0. 🧪 `vitest` **281 passés**.
- ▶️ `smoke` **94/94** · `build` ✓ (58/58) · `ai:check` **19 OK · 1 warn · 0 fail**.
- ▶️ Exécution DEV + PROD : email existant→409, MDP faible→400 ; auto-vote
  →400, autre utilisateur→200, double→409, anonyme→401.
- Voir `REPORTS/validation_T-136_2026-08-29.md`.

---

## Tâche précédente — T-135 (audit n°13)

**Tâche :** Implémentation des remarques de l'audit fonctionnel profond n°13.
- **A1** : validation des préférences `language`/`currency` — l'API
  `PATCH /api/users/me` acceptait n'importe quelle chaîne (« ar », « ZZZ »).
  Bornage zod (`isUiLocale` fr/en ; devise dans `DISPLAY_CURRENCIES`) +
  normalisation côté hook (`useDisplayPreferences`). Nouveaux helpers
  `isDisplayCurrency`/`normalizeDisplayCurrency` dans `src/lib/i18n.ts`.
- **A2** : un visiteur connecté pouvait ouvrir `/connexion` et `/inscription`.
  Garde dans `src/proxy.ts` (vrai 307 → `/` en chargement direct ; un
  `redirect()` RSC dans un layout ne fait pas de 307). Anonyme reste 200,
  pages d'auth à jeton non touchées.
- **A3** : soft-404 streamés (`notFound()`) renvoient 200 (comportement
  documenté Next 16) mais émettent `noindex` ; le layout racine imposait
  `robots:{index:true}` en conflit → retrait de cette surcharge.
**ID** : T-135 — additif, aucune migration, aucune route d'écriture.
**Niveau** : L
**Statut** : **CORRIGÉ (VALIDÉ)** — 2026-08-28.

## Sortie (validé — T-135)

- 🔨 `tsc` 0 · `eslint` 0. 🧪 `vitest` **281 passés** (+5 `i18n`, +4 `proxy`).
- ▶️ `smoke` **94/94** · `build` ✓ (58/58) · `ai:check` **19 OK · 1 warn · 0 fail**.
- ▶️ Exécution DEV + PROD (`next start` 3100) : ar/de→400, ZZZ→400,
  xaf→200 normalisé XAF, en→200 ; connecté /connexion·/inscription→307 /,
  anonyme→200, /mon-compte anonyme→307 login ; 404 = balise `noindex`
  seule, pages normales indexables, mentions légales `index,follow`.
- Voir `REPORTS/validation_T-135_2026-08-28.md`.

---

## Tâche précédente — T-133 (audit n°12)

**Tâche :** Implémentation des remarques de l'audit fonctionnel profond n°12.
- **A1** : le filtre de prix de la recherche comparait en EUR (devise chambre)
  alors que l'affichage est en XAF → normalisation du prix en EUR dans le SQL
  (`priceBoundToStorage` + `CASE currency` avec cast `::numeric`), champ caché
  `displayCurrency` et libellés dynamiques via `SearchPriceFilter`.
- **A3** : « Contacter l'hôte » avant réservation (back-end déjà prêt) →
  bouton `ContactHostButton` sur la fiche (masqué à l'hôte sur sa propriété).
- **A4** : photo de profil `avatarUrl` (champ au profil, `UserAvatar` avec
  repli initiales, exposé par `/api/auth/me`).
- **A2** : **faux positif** — l'expiration des réservations `pending` impayées
  existe déjà (`expirePendingBookings` dans le cron price-alerts), vérifiée à
  l'exécution (`expiredPendingBookings=1`).
**ID** : T-133 — additif, aucune migration, aucune route d'écriture.
**Niveau** : L
**Statut** : **CORRIGÉ (VALIDÉ)** — 2026-08-28.

## Sortie (validé — T-133)

- 🔨 `tsc` 0 · `eslint` 0. 🧪 `vitest` **273 passés** (+5 `i18n`).
- ▶️ `smoke` **94/94** · `build` ✓ · `ai:check` **19 OK · 1 warn · 0 fail**.
- ▶️ Exécution : filtre `maxPrice=50000 XAF`→0 logement, `80000`→6,
  `100000`→8, `maxPrice=100` (EUR hist.)→3, sans filtre→8 ; bouton contact
  présent client / absent hôte ; avatar PATCH 200, URL invalide 400, null 200.
- Voir `REPORTS/validation_T-133_2026-08-28.md`.

---

## Tâche précédente — T-132 (audit n°11)

**Tâche :** Suite de l'audit n°11 — implémentation des remarques en suspens :
**Franc CFA (XAF) comme devise d'affichage par défaut** (réglage plateforme +
route publique `/api/app-preferences` + hook de préférences avec repli XAF pour
les anonymes) et **la langue avec un effet réel** (dictionnaire de libellés
FR/EN `ui-strings`, descriptions EN des hébergements via `LocalizedDescription`,
prix chambres localisés via `LocalizedRoomPrice`). Les montants transactionnels
restent dans la devise de la chambre (Stripe ne supporte pas le XAF).
**ID** : T-132 — additif, aucune migration, aucune table, aucune route d'écriture.
**Niveau** : L
**Statut** : **CORRIGÉ (VALIDÉ)** — 2026-08-28.

## Périmètre (T-132)

- `settings.ts` : `defaultCurrency` → **XAF** (+ test). Route publique
  `GET /api/app-preferences` (devise/langue plateforme, cache court).
- Hook `useDisplayPreferences` (devise **et** langue ; devise utilisateur sinon
  défaut plateforme XAF ; requêtes mises en cache module).
- `ui-strings.ts` (FR/EN) + test ; cartes recherche et fiche localisées ;
  `LocalizedDescription` (descriptionEn si `en`) ; `LocalizedRoomPrice`.
- Profil : devise initiale XAF, mention langue mise à jour.

## Sortie (validé — T-132)

- 🔨 `tsc` 0 · `eslint` 0. 🧪 `vitest` **256 passés / 12 skips**.
- ▶️ `smoke` **94/94** · `build` ✓ (route `/api/app-preferences` générée) ·
  `ai:check` **19 OK · 1 warn · 0 fail**.
- ▶️ Exécution : `GET /api/app-preferences` → `defaultCurrency:"XAF"` (anonyme) ;
  89 € → 58 380 FCFA ; langue `en` → libellés EN + descriptionEn, ar/fr → FR.
  Voir `REPORTS/validation_T-132_2026-08-28.md`.

---

## Tâche précédente — T-131 (audit n°11, F1)

**Tâche :** Audit fonctionnel profond n°11 (F1) — la préférence **Devise** du
profil était sauvegardée (`users.currency`) mais n'avait aucun effet : les
utilitaires `convertAmount`/`formatMoney` de `src/lib/i18n.ts` n'étaient importés
nulle part (code mort), et tous les prix restaient affichés en euros via
`formatPrice`. F2 : la préférence **Langue** est également sans effet (interface
non traduite) sans aucune mention. Correctif honnête et **additif** : conversion
des prix d'aperçu (cartes recherche + fiches) dans la devise du client, sans
jamais toucher aux montants transactionnels ; mention explicite sous les
sélecteurs langue/devise.
**ID** : T-131 — additif, aucun changement de schéma, aucune migration, aucune
nouvelle route API.
**Niveau** : L
**Statut** : **CORRIGÉ (VALIDÉ)** — 2026-08-28.

## Périmètre (T-131)

- Nouveau hook client **`src/lib/use-display-currency.ts`** : lit une fois
  `GET /api/auth/me` (promise mise en cache au niveau module), renvoie
  `user.currency` ou `null` (anonyme/erreur).
- **`src/components/property-card-client.tsx`** : prix « Dès … » converti via
  `convertAmount`/`formatMoney` quand la devise d'affichage diffère, avec mention
  « Conversion indicative · paiement en <devise source> ».
- **`src/components/property-booking-card.tsx`** : même traitement sur le prix
  « à partir de » de la fiche logement.
- **`src/components/profile-form.tsx`** : mention sous le sélecteur devise
  (aperçu converti, paiement en devise de l'hébergement) et sous la langue
  (interface reste en français en V1).

## Sortie (validé — T-131)

- 🔨 `tsc --noEmit` 0 erreur · `eslint` 0.
- 🧪 `npx vitest run` **264/264**.
- ▶️ exécution : `convertAmount(89,"EUR","USD")` → 96,12 ; EUR→EUR et devise
  inconnue → identique (non-régression anonyme/EUR). PATCH `/api/users/me
  {currency:"USD"}` appliqué puis restauré en EUR. Recherche + fiche anonyme →
  HTTP 200, prix en EUR inchangés.
- ▶️ `npm run build` ✓ ; `npm run ai:check` 19 OK · 1 warn · 0 fail.

> Voir `REPORTS/audit_fonctionnel_profond11_2026-08-28.md` (audit + solution).

---

## Tâche précédente — T-128 (audit n°8)

**Tâche :** Audit fonctionnel n°8 (P1) — verrou de pages en mode maintenance.
En maintenance, les écritures API étaient bien bloquées (503) mais un
chargement direct de page répondait 200 avec le contenu normal : la garde RSC
`redirect("/maintenance")` n'émet pas de 307 fiable au plein-chargement (comme
déjà constaté pour les rôles en T-123). Ajout d'une garde cliente qui force la
navigation vers /maintenance au montage (donc aussi sur plein-chargement),
alimentée par une route publique d'état.
**ID** : T-128 — additif, aucun changement de schéma, aucune migration.
**Niveau** : L
**Statut** : **CORRIGÉ (VALIDÉ)** — 2026-08-28.

## Périmètre (T-128)

- Route publique **`GET /api/maintenance-status`** → `{ active }` (runtime
  Node, lit le réglage via `isMaintenanceActive`, cache court).
- Logique pure **`src/lib/maintenance-gate.ts`** (`chooseMaintenanceGate`,
  `isMaintenanceBypassPath`) : redirige sauf si maintenance inactive, admin,
  ou chemin de la whitelist anti-verrouillage (`/maintenance`, auth, assets).
- Composant client **`src/components/maintenance-gate.tsx`** monté dans le
  layout racine : au montage, interroge la route et fait
  `window.location.replace("/maintenance")` si besoin ; inerte sinon.
- Le rôle admin est lu côté serveur (`getCurrentUser`) et passé en prop
  booléen. Les gardes RSC et les 503 API existants sont **conservés**
  (défense en profondeur).

## Sortie (validé — T-128)

- 🔨 typecheck 0 erreur · lint 0 · build ✓.
- 🧪 `npm test` **258/258** (40 fichiers ; +7 tests `maintenance-gate`).
- ▶️ `npm run smoke` **94/94**.
- ▶️ exécution : route d'état `{active:false}`→`{active:true}` ; simulation
  de la gate contre la vraie route (anonyme/non-admin → `/maintenance`,
  admin et pages auth/maintenance → restent, maintenance OFF → aucune
  redirection). Voir `REPORTS/validation_T-128_2026-08-28.md`.

> Voir `REPORTS/audit_fonctionnel_profond8_2026-08-28.md` (audit),
> `REPORTS/analyse_impact_T-128_2026-08-28.md` (§14).

---

## Tâche précédente — T-127 (audit n°7)

**Tâche :** Correctifs de l'audit fonctionnel n°7 — existence de la propriété
avant alerte/favori (404 au lieu de 500 FK), magic bytes sur les pièces
jointes de messagerie, filtre de période de l'export de facturation.
**ID** : T-127 — aucun changement de schéma, aucune migration (validations additives).
**Niveau** : L
**Statut** : **CORRIGÉ (VALIDÉ)** — 2026-08-28.

## Périmètre (T-127)

- **P1** : `POST /api/price-alerts` et `POST /api/wishlists` (ajout) vérifient
  que la propriété cible existe avant insertion → **404** propre au lieu d'un
  500 par violation de clé étrangère. Existence seulement (pas `status='active'`).
- **P2** : l'upload des **pièces jointes de messagerie** (`/api/uploads`)
  applique `sniffImageMime` (T-126) : rejet 400 d'un fichier non-image déguisé,
  et stockage du MIME réel (et non déclaré).
- **P3** : l'export CSV de facturation accepte des filtres optionnels
  `from`/`to` (YYYY-MM-DD, `from ≤ to`) validés → 400 sinon ; sans paramètre,
  export complet (historique).

## Sortie (validé — T-127)

- 🔨 typecheck 0 erreur · lint 0 · build ✓.
- 🧪 `npm test` **251/251** · ▶️ `npm run smoke` **94/94**.
- ▶️ preuves d'exécution P1/P2/P3 — voir `REPORTS/validation_T-127_2026-08-28.md`.

> Voir `REPORTS/audit_fonctionnel_profond7_2026-08-28.md` (audit),
> `REPORTS/analyse_impact_T-127_2026-08-28.md` (§14).

---

## Tâche précédente — T-126 (audit n°6)

**Tâche :** Correctifs de l'audit fonctionnel n°6 — validation des promotions
(pourcentage ≤ 100, dates cohérentes), sémantique du double vote utile (409),
vérification des magic bytes à l'upload d'images.
**ID** : T-126 — aucun changement de schéma, aucune migration (validations additives).
**Niveau** : L
**Statut** : **CORRIGÉ (VALIDÉ)** — 2026-08-28.

## Périmètre (T-126)

- **P1** : `createSchema` des promotions refuse à 400 un pourcentage > 100
  (type `percentage`) et une plage `validUntil <= validFrom` (deux `.refine()`
  Zod) ; garde miroir côté `promotion-form.tsx` ; garde PATCH si on décale la
  date de fin avant le début. Le calcul reste défensif (`Math.min`).
- **P2** : un double vote « utile » renvoie **409 Conflict** (vérification
  d'existence du vote avant le rate-limit) au lieu de 429 ; le 429 reste
  réservé au spam (rate-limit assoupli à 3/h).
- **P3** : upload d'image — nouveau helper pur `src/lib/storage/sniff.ts`
  (`sniffImageMime`) qui lit la signature réelle (JPEG/PNG/GIF/WebP) ;
  rejet 400 si le contenu n'est pas une vraie image, quel que soit le
  Content-Type déclaré.

## Sortie (validé — T-126)

- 🔨 typecheck 0 erreur · lint 0 · build ✓.
- 🧪 `npm test` **251/251** (39 fichiers ; +6 tests `src/lib/storage/sniff.test.ts`).
- ▶️ `npm run smoke` **94/94** · ▶️ preuves d'exécution P1/P2/P3 (voir
  `REPORTS/validation_T-126_2026-08-28.md`).

> Voir `REPORTS/audit_fonctionnel_profond6_2026-08-28.md` (audit),
> `REPORTS/analyse_impact_T-126_2026-08-28.md` (§14).

---

## Tâche précédente — T-125 (audit n°5)

**Tâche :** Correctifs de l'audit fonctionnel n°5 — modération des avis,
bouclage du parrainage, motif de suspension tracé, garde RSC de la page d'avis.
**ID** : T-125 — 1 migration additive, comportements finance/avis.
**Niveau** : S
**Statut** : **CORRIGÉ (VALIDÉ)** — 2026-08-28.

## Périmètre

- **P1** : modération des avis pilotée par réglage admin
  `reviews.requireModeration` (défaut `false` = publication immédiate
  historique ; `true` → avis `pending` alimentant la file `/dashboard/reviews`).
  Un auteur voit ses propres avis non approuvés (sans fuite).
- **P2** : bouclage du parrainage — migration `0017` (`users.referred_by`,
  `users.referral_rewarded_at`), code généré à l'inscription, `referralCode`
  accepté au register (non bloquant), champ + `?ref=` au formulaire
  d'inscription, récompense idempotente au séjour terminé (parrain +10 €,
  filleul +5 €, réglables dans `bestrewards.referral`).
- **P3** : le motif de suspension (`reason`) est journalisé dans l'audit.
- **P4** : page de dépôt d'avis en Server Component avec garde (connecté,
  UUID valide, réservation propre, séjour terminé) → `notFound()` sinon ;
  formulaire extrait dans `<ReviewForm/>`.

## Sortie (validé)

- 🔨 typecheck 0 erreur · lint 0 erreur (15 warnings préexistants) · build ✓.
- 🧪 `npm test` **245/245** (38 fichiers ; +5 tests `src/lib/referral.test.ts`).
- ▶️ `npm run smoke` **94/94** · `npm run ai:check` **20/20**.
- ▶️ E2E 3 rôles : parrainage (lien, récompense, idempotence), modération
  (pending/public/admin), motif d'audit, gardes RSC — voir
  `REPORTS/validation_T-125_2026-08-28.md`.

> Voir `REPORTS/analyse_impact_T-125_2026-08-28.md` (§14) et
> `REPORTS/analyse_conception_T-125_2026-08-28.md` (§15.1).
