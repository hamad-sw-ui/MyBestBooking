# Audit fonctionnel profond n°29 — MyBestBooking
**Date** : 2026-08-30 · **Objet** : analyse profonde des scénarios et éléments fonctionnels à l'exécution (pages, boutons, fonctionnalités) inachevés et/ou mal pensés, avec **implémentation sans régression** et **validation complète**.

> Continuité : l'audit n°28 (`.ai/REPORTS/audit_fonctionnel_profond28_2026-08-30.md`) avait produit 7 findings sans implémentation. Le cycle n°29 les **re-confirme à l'exécution**, les **implémente** (additif, sans migration, contrat API public inchangé) et **valide** par tsc + vitest + harnais + probes + ai:check.

---

## 1. Méthode et périmètre vérifié

### 1.1 Crawl complet (read-only, 4 rôles)
`.data/a29/crawl.mjs` — 40 pages × 4 rôles (anonyme, customer, host, admin) + 30 endpoints API × 4 rôles, AbortSignal 30 s, merge par rôle, sessions réelles (logins 200).

| Poulet | Vérifications | Erreurs |
|---|---|---|
| Pages | 160 | **0** (`application error`, 5xx, type-error) |
| APIs | 120 | **0** |

Logs : `.data/a29/pages-run.log`, `.data/a29/apis-run.log`, sessions `{customer,host,admin}.jar`.

### 1.2 Probes runtime (implémentation)
`.data/a29/probes.mjs` — **30 contrôles, 0 échec** :

| Contrôle | Résultat |
|---|---|
| Quote annulation hôte → 200 `{actor:"host", fullRefund:true, cancellationFee:"0.00"}` | ✅ |
| Quote admin → 200 `{actor:"admin", fullRefund:true}` | ✅ |
| Quote voyageur → 200, **sans** `actor`/`fullRefund` (contrat inchangé) | ✅ |
| PUT annulation par l'hôte (sans `cancellationReason` client) → 200 | ✅ |
| `cancellationFee="0.00"`, `refundAmount=391.61` (total), `status=cancelled` | ✅ |
| Raison persistée = « Annulée par l'hébergeur » (jamais le libellé client) | ✅ |
| PATCH settings partiel → merge (`siteName` modifié, `supportEmail` conservé) | ✅ |
| PATCH settings Zod invalide → 400 `{error:"Ce champ est requis"}` **sans `issues`** | ✅ |
| POST booking capacité 5 adultes / chambre 2 → **400** « Cette chambre accepte au maximum 2 adultes » | ✅ |

---

## 2. Findings et solutions implémentées

### 🔴 F1 — P1/T-156 : annulation par acteur (hôte/admin ≠ voyageur)
**Problème (audit n°28, re-confirmé)** : `cancelBooking` appliquait la grille de politique **sans connaître l'acteur** → l'annulation par l'hôte facturait le voyageur (preuve : 277,38 €) et le bouton hôte était inopérant (quote → 403).

**Solution implémentée** :
- `CancellationActor = "customer" | "host" | "admin" | "system"` dans `src/lib/booking-cancellation.ts` ; `cancelBooking(id, reason, actor)` → hôte/admin = **fee 0 + remboursement intégral** + raison **forcée serveur** (« Annulée par l'hébergeur » / « …administrateur »).
- `notifyBookingCancellation(outcome, actor)` → mail plateforme `bookingCancelledByOperator` (fr/en, « Remboursement intégral ») au lieu du template « frais appliqués ».
- Quote `GET /api/bookings/[id]/cancellation` autorisé à l'**hôte du bien** + admin → 200, champs **additifs** `actor`/`fullRefund` (absents pour le voyageur → aucun client existant cassé).
- Routes : `PUT /api/bookings/[id]` (`actorFor(role, isOwner)`), `admin/bulk` (`"admin"`), UI `booking-row-actions.tsx` (branche hôte/admin : confirmation « remboursement intégral », PUT sans raison client ; flux voyageur intact).

**Preuves** : probes (tableau §1.2) · 🧪 `src/lib/booking-cancellation-actor.test.ts` (4 tests : host/admin/customer/outbox) + `cancellation/route.test.ts` (4 tests : host/admin/customer/403).

### 🟠 F2 — P2/T-157 : identité voyageur en mode connecté
**Problème** : en mode connecté, `POST /api/bookings` persistait les champs `guest*` **du payload** — un compte pouvait réserver sous un nom/email tiers ; la confirmation partait vers cet email.

**Solution** : `bookingGuestIdentity(user)` (nouveau `src/lib/booking-identity.ts`, fonction pure) — un compte connecté réserve sous **SON** identité (`firstName/lastName/email.toLowerCase()/phone/country`) ; payload invité ignoré. Guest mode anonyme (`!user && isGuestBooking`) inchangé. UI étape 2 en lecture seule + encart « Réservé au nom de votre compte » (`reservation.bookedAs`).

**Preuves** : 🧪 `src/lib/booking-identity.test.ts` (3 tests : null → guest mode, normalisation email, défauts FR/phone) · **corrige au passage** `route.test.ts` : les mocks `getCurrentUser` partiels `{id, role}` provoquaient un 500 (email undefined) — remplacés par l'identité complète (8/8 tests verts).

### 🟠 F3 — P2/T-158 : i18n de la fiche propriété (vague 1)
**Problème** : en compte/langue EN, la fiche publique restait en partie FR (boutons, tooltips, formulaire d'avis, métadonnées).

**Solution (localisation complète, additive)** :
- `property-booking-card.tsx` : tooltip « conversion indicative » ;
- `review-helpful-button.tsx` : « Utile / Merci / connexion requise » ;
- `price-alert-button.tsx` : libellés « Suivre le prix (base/séjour) » + formulaire « M'alerter si… » ;
- `property-header-actions.tsx` : favori (ajout/retrait/confirmation), partage, lien copié ;
- `reviews/review-form.tsx` : tout le formulaire (critères, type de voyage, textareas, publication, toasts) ;
- fiche : bouton « Réserver », breadcrumb, badge Éco, bannière de confiance (4 items) ;
- **métadonnées** (`generateMetadata`) : `<title>`/description 404 localisés — via nouvel ordre `getServerLocale()` : compte > **cookie `mybb:ui-language`** (posé par le script d'init `<html lang>`) > plateforme ; le SSR anonyme EN fonctionne ensuite (RSC, soft navigation).
- `src/lib/ui-strings.ts` : ~60 clés fr/en ajoutées, dictionnaire par `makeT` inchangé.
- **Centre d'aide (`/aide`) bilingue** : `help-center.tsx` réécrit — 8 articles
  traduits fr/en (recherche sur le texte affiché dans la langue active),
  hero/CTA/états vides via `t()` ; métadonnées de la page localisées via
  `getServerLocale()` (cookie `mybb:ui-language` → `<title>Help and FAQ`
  prouvé au runtime).
- **Garde-fou CI i18n (warn)** : `scripts/check-i18n.mjs` + `npm run
  i18n:check` — signale les libellés FR en dur de la surface UI
  (**460 lignes / 66 fichiers** d'inventaire), warn-only par défaut
  (exit 0, `--strict` disponible) ; hors périmètre : données/mails/settings.

**Preuve** : 🧪 suite `ui-strings`/`ui-currency` (même mécanisme) ; crawl pages 200 ; fiche : 0 libellé FR résiduel (grep accents) · `/aide` : 200 + title FR sans cookie / **EN avec cookie** ; `npm run i18n:check` exit 0.

### 🟠 F4 — P2/T-158 : devise d'affichage publique
**Problème (audit n°28)** : recherche anonyme en FCFA **sans sélecteur** — un visiteur européen tapait « 100 » (0,15 €) et n'obtenait rien.

**Solution** : `CurrencySelector` (EUR/USD/GBP/XAF) dans `search-price-filter.tsx` ; persistance `localStorage["mybb:ui-currency"]` ; priorité **compte > localStorage > plateforme** (`hasUserCurrency`) ; champ caché `displayCurrency` et conversion serveur **inchangés** (1:1 EUR intact).

**Preuves** : 🧪 `src/lib/ui-currency.test.ts` (options ⊆ devises convertibles, clé stable, EUR numériquement identique) · `UI_CURRENCY_OPTIONS` = source unique partagée (`src/lib/i18n.ts`).

### 🟢 F5 — P3/T-159 : hygiène des artefacts de simulation
**Problème** : les runs laissent users/réservations de scénarios (`%@t.local`, prénoms « Racer/ParaFix/Gdpr… ») qui polluent dashboards.

**Solution** : `scripts/purge-sim-data.mjs` (dry-run par défaut, `--apply` réel ; FK order messages→conversations→sessions→tokens→votes→reviews→alerts→bookings→wishlists→users). Exécuté : **0 ligne de test restante** (le `cleanup_db` du harnais couvrait déjà le run courant).

### 🟢 F6 — P3/T-159 : PATCH settings par section
**Problème** : PATCH écrasait la section entière ; erreurs Zod exposées avec `issues` internes (anglais).

**Solution** : merge additif `{...previous, ...body}` (envoyer la section entière reste accepté — identité) ; validation du résultat complet ; erreur → `{error: frenchZodMessage(...)}` seul. **Preuves** : probes §1.2 + 🧪 `admin/settings/[key]/route.test.ts` (2 tests : merge + absence d'`issues`).

### 🟢 F7 — P3/T-159 : cohérence 400/409
**Problème** : chambre 2 adultes / 5 demandés → 409 (conflit d'état) alors que la demande est invalide **par construction**.

**Solution** : `BookingRuleResult.code` (`dates|capacity|min_stay|unavailable|bad_price`) ; `dates/capacity/min_stay/bad_price` → **400** (`BookingInputError`) ; `unavailable` (stop-sell/complet) conserve **409** (`BookingRuleError`). **Preuve** : probe capacité → 400 (message français).

### 🟢 F8 — P3 : corrections de tests mal pensés (inventés pendant la validation)
1. `properties/[id]/route.test.ts` : « property non-BR → 15 » testait en réalité le seed `hotel-le-magnifique` **BR** (→ 17). Corrigé : propriété dédiée non-BR (15) **+** test explicite seed BR (15 + 2 = 17) ; contrat vérifié sur le seed.
2. `bookings/route.test.ts` : mocks auth partiels (voir F2).
3. Aucune régression comportementale : les routes et valeurs n'ont **pas** changé (tests T-153/T-154d inchangés dans leurs attentes chiffrées).

### 🟡 F9 — P3 : 3 warnings statiques xtreme (audit n°12) — **justifiés, non modifiés**
`maintenance-gate.tsx` et `unread-messages-badge.tsx` : fetch sans état loading/feedback visible — **volontaire** (gate invisible par design ; badge = 0 tant que non chargé ; un état loading rendrait une pastille « 0 » ou un flash). Ajouter un feedback serait une régression UX. Documenté, comportement inchangé.

---

## 3. Validation complète

| Contrôle | Résultat |
|---|---|
| `npx tsc --noEmit` | ✅ 0 erreur |
| `npx vitest run` | ✅ **57 fichiers · 390/390 tests** (dont +16 nouveaux : identity 3, actor 4, quote 4, settings 2, devise 4, tests corrigés) |
| `python3 scripts/run_all_sims.py` | ✅ **5/5 · 396 assertions · 0 KO** (smoke 94 · surface 68 · deep 80 · xtreme 83+3WARN · paranoid 71) |
| `node .data/a29/probes.mjs` | ✅ 30/30 |
| `node scripts/check-i18n.mjs` (garde-fou i18n) | ✅ exit 0 (warn-only) · inventaire 460 lignes/66 fichiers |
| Probe `/aide` SSR | ✅ 200 · `<title>` FR sans cookie → **EN avec cookie `mybb:ui-language=en`** |
| `npm run ai:check` | **19 OK · 1 warn (R7 HEAD différé, motif toléré) · 0 fail** |

**Non-régression vérifiée** : cas EUR numériquement identiques (test `ui-currency`) ; `displayCurrency` et contrats API existants intacts ; quote d'annulation : champs `actor/fullRefund` **uniquement pour hôte/admin** (voyageur = réponse historique) ; aucune migration de schéma, aucun changement de colonne ; reservation page : section invité en lecture seule **seulement si connecté**.

**Fichiers modifiés** (points clés) : `booking-rules`, `booking-cancellation`, `booking-identity`(*), `bookings/route`, `bookings/[id]/route`, `bookings/[id]/cancellation/route`, `admin/bulk/route`, `admin/settings/[key]/route`, `mail/strings+templates`, `use-display-currency`, `i18n` (+`UI_CURRENCY_OPTIONS`), `server-locale`, `layout` (cookie langue), `ui-strings`, `currency-selector`(*), `search-price-filter`, `property-booking-card`, `review-helpful-button`, `price-alert-button`, `property-header-actions`, `reviews/review-form`, `booking-row-actions`, `reservation/page`, `hebergement/[slug]/page` (métadonnées + libellés), `purge-sim-data`(*) — (*) nouveaux fichiers.

## 4. Clôture
- Rapport : ce fichier. Tâches : T-156, T-157, T-158, T-159 → BACKLOG/TRACEABILITY marqués implémentés et validés.
- Branche : `arena/01a052ed-mybestbooking` (commit de clôture : voir `.ai/STATE.md`).
