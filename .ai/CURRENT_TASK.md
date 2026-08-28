# 🎯 TÂCHE EN COURS

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
