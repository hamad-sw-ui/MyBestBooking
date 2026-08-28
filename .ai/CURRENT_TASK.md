# 🎯 TÂCHE EN COURS

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
