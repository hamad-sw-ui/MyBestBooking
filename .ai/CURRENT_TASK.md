# Tâche courante

- **ID** : T-245 → T-252 (audit n°5 : exécution — parcours métier et fins de parcours)
- **Titre** : Pagination des listes, favoris multi-listes, dialogues de motif, journal du wallet,
  bandeau « tri ignoré », supervision des crons, message de conversation, hygiène T-207
- **Statut** : ✅ **IMPLÉMENTATION LIVRÉE ET VALIDÉE (2026-09-11)** — T-245, T-246, T-247, T-248
  (étapes 1-2), T-249, T-250, T-251, T-252. **Seule la décision produit de T-248 §3 reste ouverte**
  (consommation du wallet ou gel explicite) : elle est isolée et n'affecte aucune livraison.
- **Niveau** : S (passe d'analyse + correctifs de fin de parcours ; T-248 touche un solde monétaire et sera traité en dernier)
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_execution.md`
  (copie `.ai/REPORTS/analyse_runtime_n5_2026-09-11_execution.md`)
- **Rapports produits** : `.ai/REPORTS/analyse_impact_T245_T252_2026-09-11_execution.md` ·
  `.ai/REPORTS/analyse_conception_T245_T252_2026-09-11_execution.md`
- **Rapport de validation** : `.ai/REPORTS/validation_T245_T252_2026-09-11_execution.md` (livré, complété
  par `validation_T245_T250_2026-09-11_implementation.md`)

## Analyse n°5 (2026-09-11) — méthode et constats

Cinquième passe d'exécution : les scénarios métier ont été rejoués (promos, stop-sell de bout en
bout, réponse d'hôte publique, heure d'arrivée dans les e-mails, alertes prix, disponibilité de
chambre par l'hôte, favoris, messagerie) **et** des surfaces jamais sondées ont été attaquées
(volumétrie des écrans de liste, cycle de vie complet d'une liste de favoris, saisie des motifs de
modération, traçabilité du wallet, supervision des tâches planifiées). Moyens : matrice de rôles
(3 rôles), sonde d'endpoints, sonde de flux, 3 scripts de scénarios, analyse croisée des **66
endpoints appelés par l'UI** (0 manquant), contrôles SQL après chaque écriture. Base remise à l'état
seed : `bookings` 35, `email_outbox` 1, `review_votes` 0, `price_alerts` 0, `stop_sell` 0,
`host_reply` 0, `wishlists` 1, `conversations` 0.

| # | Constat | Tâche | Niveau |
|---|---|---|---|
| A1 | Favoris : multi-listes à moitié câblé (ordre non déterministe, pas de renommage, pas de choix/déplacement de liste) | T-246 | M |
| A2 | Aucune pagination sur 6 écrans de liste ; `GET /api/bookings` et `/api/messages` renvoient tout | T-245 | M |
| A3 | Motifs de modération en `window.prompt`, `moderationReason` optionnel côté API | T-247 | S |
| A4 | `sort` inconnu ignoré en silence (seul filtre sans bandeau T-175) | T-249 | S |
| A5 | Messagerie : « introuvable » et « interdit » → même 403 | T-251 | XS |
| A6 | Wallet : 4 familles d'écriture sans journal ; solde non dépensable depuis T-207 (O1) | T-248 | M |
| A7 | Crons sans trace d'exécution ni supervision | T-250 | S |
| A8 | Résidus T-207 : `applyWalletToTotal` sans appelant, `useWalletCredits` non documenté | T-252 | XS |

**Vérifié sain et à ne pas rouvrir** : `DELETE /api/price-alerts/[id]` (200/404/400) et UI
`/mes-favoris` complète ; `PUT /api/rooms/[id]/availability` avec `{ days: [...] }` par l'hôte
propriétaire ; `/api/auth/verify` n'est pas morte (lien des e-mails) ; stop-sell appliqué
(recherche 8 → 7, devis et réservation 409) ; réponse d'hôte publiée sur la fiche ; heure d'arrivée
dans les 2 e-mails ; promos 200/200/400/404 ; clamp `limit` 1–100 ; 0 bouton mort, 0
`TODO/FIXME`, 0 `href="#"` ; rétention technique (T-243) et export analytique (T-241) déjà livrés.

## Correctifs courts livrés (2026-09-11)

Trois constats de l'analyse ont été corrigés dans la foulée, sans toucher aux surfaces sensibles :

- **T-249 (A4) — bandeau « tri ignoré ».** `sortIgnored` ajouté à `SearchWarning` + liste blanche
  `SORT_VALUES` (`rating`/`price_asc`/`price_desc`/`popularity`), clé `search.warn.sortIgnored` FR/EN,
  verrou `ui-strings.test.ts` **1682 → 1683**. API inchangée (tolérance conservée, comme T-175).
- **T-251 (A5) — messagerie.** `checkParticipant` renvoie `{ kind: "not_found" | "forbidden" | "ok" }` :
  conversation absente → **404** « Conversation introuvable » (`code: CONVERSATION_NOT_FOUND`),
  tiers → **403** inchangé (`code: CONVERSATION_FORBIDDEN`), variante alignée sur `/messages/[id]`
  (404 si absente, redirection si non participant) ; traduction EN ajoutée dans `api-error.ts`.
- **T-252 (A8) — hygiène T-207.** `src/lib/wallet-currency.ts` + son test supprimés (aucun appelant
  applicatif) ; `useWalletCredits` (accepté puis ignoré) et la suppression documentés dans
  `KNOWN_LIMITATIONS.md` § « Surfaces inactives », avec renvoi à T-248 pour la décision produit.

Preuves : typecheck 0 erreur · tests ciblés 23/23 · `npm run ci` (voir `PROGRESS.md`) · runtime des
deux routes modifiées (404/403 messages, bandeau tri).

## Suite

- Ordre recommandé : **T-247 → T-245 → T-246 → T-250 → T-248** (T-248 en dernier : trancher d'abord
  la consommation du wallet — avoir au règlement sur place ou gel).
- Chaque correctif : `npm run ci` verte (typecheck · lint · i18n · ai:check · vitest · build · smoke)
  puis vérification runtime, avant commit `fix(...)`/`feat(...)`.
- Resynchronisation de `STATE.md` sur le HEAD final (R7) avant clôture de session.

## Livraison T-241 (2026-09-11) — audit n°3, volets F11 + F12 + F13

**(a) F11 — « supprimé » ≠ « suspendu ».** Déjà livré par T-230 : `users.suspended_at` distinct de
`deleted_at`, bouton **Réactiver** remplacé par « Compte anonymisé — non réactivable ». Vérifié en
base et dans les deux catalogues ; aucun code ajouté.

**(b) F12 — analytics.** Période `?from&to` (dates civiles, `src/lib/analytics-period.ts`), défaut
inchangé (30 derniers jours comparés aux 30 précédents), étendue bornée à 366 jours ; agrégats
partagés entre l'écran et l'export CSV (`src/lib/analytics.ts`) ; sélecteur + export localisé
`GET /api/dashboard/analytics/export`.

**(c) F13 — erreurs d'API.** `{ error, issues: [{ field, message }] }` traduits sur 20 routes
(`zodIssues`/`zodErrorResponse`) ; `.strict()` sur les schémas de mutation : un champ inconnu est
refusé en 400 au lieu d'un 200 silencieux.

## Suite

- Resynchronisation de `STATE.md` sur le HEAD final (R7) avant clôture.
- BACKLOG : plus aucun item 🔴/🟠 ouvert (T-235 → T-241 tous livrés).

## Livraison T-235 → T-239 (2026-09-11)

**T-235 (F4) — quota de réservation.** Garde-fou anti-abus **60/h avant** lecture du corps et
quota produit **10/h après** validation (une saisie invalide ne consomme plus le quota) ; clé
invité par cookie signé `mbb_guest` (repli IP) ; `429` + `Retry-After` + délai lisible, traduit ;
`KNOWN_LIMITATIONS.md` mis à jour.

**T-236 (F5) — heure d'arrivée estimée.** Validation `HH:MM` à l'entrée (plus d'erreur PostgreSQL
possible sur la colonne `time`) ; restitution sur la fiche hôte, dans l'espace voyageur et dans les
**4 e-mails** (demande + confirmation, FR/EN).

**T-237 (F6) — décision d'annonce.** Colonne additive `properties.review_reason` (migration
**0022**, appliquée) : motif persisté au rejet/suspension, effacé à l'approbation, affiché à
l'hôte ; notification idempotente via l'outbox avec interrupteurs admin dédiés et gabarits FR/EN.

**T-238 (F7) — wishlist partagée.** `noindex`/`nofollow` sur le lien partagé, notice de partage et
infobulle de rotation ; la rotation existante (`PATCH /api/wishlists`) est désormais **prouvée** :
ancien lien 404, nouveau lien 200.

**T-239 (F8) — désabonnement.** Jeton HMAC-SHA256 (`src/lib/unsubscribe.ts`), page publique
`/desabonnement` idempotente et `noindex`, pied d'opposition sur les alertes prix (seul envoi non
transactionnel) ; la page Confidentialité FR/EN dit désormais précisément ce qui est refusable.

## Suite

- **T-241** (F11/F12/F13) : finitions — distinction « supprimé »/« suspendu » (déjà couverte par
  T-230), analytics (sélecteur de période + export CSV), erreurs d'API (`issues` détaillées +
  schémas de mutation `.strict()`).
- Resynchronisation de `STATE.md` sur le HEAD final (R7) avant clôture de session.

## Livraison T-232 / T-233 / T-234 (2026-09-10)

**T-232 (F1 + F9 + F10) — dates et fuseaux.** Helper unique `src/lib/dates.ts` (date civile jamais
décalée vs instant à fuseau explicite) ; `pg` lit les colonnes `date` en chaînes ; fenêtres civiles
(analytics, calendriers, dashboard, tunnel, mon-compte, gestionnaire de réservations) ; les 7
derniers `toLocaleDateString` remplacés — **0 occurrence** dans `src/` ; `users.timezone` validé et
réellement lu comme fuseau d'affichage.

**T-233 (F2) — suspension d'hôte.** `src/lib/host-suspension.ts` : cascade transactionnelle et
idempotente `active ↔ suspended` depuis `PATCH /api/users/[id]/suspend` et `POST /api/admin/bulk` ;
filtres publics (recherche, fiche dont `metadata`, tunnel) ; cache du catalogue ancré sur
`globalThis` et invalidé à chaque changement, plus **garde de visibilité hors cache** sur la fiche.

**T-234 (F3) — expiration paresseuse.** Purge extraite dans `src/lib/booking-request-expiration.ts`
(le cron n'en garde que le branchement), exécutée **dans la transaction** de `POST /api/bookings` et
de `GET /api/bookings/quote`, bornée à la chambre et à la fenêtre, notifications **après** commit ;
`loadBookedCounts` ne compte plus une demande `pending` expirée (`now()` SQL).

**Preuves.** `npm run ci` verte : typecheck 0 · lint 0/0 · i18n 1640 · ai:check 19 OK / 1 warn (R7) /
0 fail · vitest **709 tests / 120 fichiers, 0 échec** · build · smoke **95/95**. Runtime : fiche
`200 → 404 → 404 → 200`, total d'annonces `8 → 0 → 8`, réservation `400` (« Hébergement non
disponible ») puis `201` ; demande expirée purgée par le tunnel (**201 au lieu de 409** — le `409`
du constat est reproduit en retirant le correctif), disponibilité `0/1 → 1/0`. Base restaurée au
seed exact (8 users / 8 annonces `active` / 34 réservations / 25 avis).

## Étape précédente — T-221 → T-231 (audit n°2) + T-242 → T-244 (audit n°4)

- **Statut** : CORRIGÉ (VALIDÉ) — 2026-09-10 : les 14 constats A1→A11 et N1→N3 sont implémentés, testés et vérifiés au runtime
- **Niveau** : C (données personnelles persistées — cf. §15.0 : en cas de doute, choisir le niveau le plus élevé)
- **Analyses sources** : `docs/analyse_2026-09-10_audit_runtime_inacheves.md` (A1→A11) et
  `docs/analyse_2026-09-10_audit_runtime_profondeur.md` (N1→N3, copie `REPORTS/analyse_runtime_n4_2026-09-10_profondeur.md`)
- **Rapports de cette tâche** : `REPORTS/analyse_impact_T-221_2026-09-10_mise_en_oeuvre_audits.md`
  (impact §14) et `REPORTS/analyse_conception_T-221_2026-09-10_mise_en_oeuvre_audits.md`
  (conception §15.1)

## Contexte

Quatrième passe d'analyse à l'exécution, orientée sur des surfaces jamais sondées :
cloisonnement multi-tenant (24 cas × 5 identités, second hôte et annonce brouillon créés pour la
mesure), cycle de vie des données personnelles après suppression de compte, rétention technique,
et écart entre le stock affiché au calendrier hôte et le stock réellement vendable.

Trois constats nouveaux en sortent — **T-242** (anonymisation partielle : l'identité survit dans
`bookings.guest_*`, `email_outbox.to`, `audit_log.targetEmail`), **T-243** (aucune purge des
sessions expirées, e-mails livrés et journaux d'audit) et **T-244** (le calendrier affiche le
stock déclaré sans retirer les séjours). Les sept autres constats de la campagne confirment avec
preuves chiffrées les tâches déjà planifiées T-227 et T-232 → T-236 / T-241.

## Livraison (implémentation)

Les quatorze constats sont **implémentés et validés** : A1 (échéance des demandes), A2 (séjours
échus non réglés), A3 (interrupteurs d'e-mails), A4 (parrainage réglable), A5 (notifications
d'avis), A6 (édition complète de chambre), A7 (horaires d'arrivée/départ + fuseau validés),
A8 (labels/badges réservés à l'admin en PUT et POST), A9 (libellé du fil par acteur), A10
(`suspended_at` distinct de `deleted_at`, migration `0021`, `409` sur compte anonymisé),
A11 (codes de secours 2FA hachés à usage unique + reset support `user.2fa.reset`), T-242
(anonymisation transactionnelle complète), T-243 (purge technique en cron), T-244 (« Reste
vendable » au calendrier hôte).

Preuves : `npm run ci` verte (typecheck 0 · lint 0 · i18n 0 · **vitest 691 tests** · build ·
smoke) ; `ai:check` ; vérifications runtime sur serveur réel (parcours 2FA complet, suspension /
réactivation / `409`, horaires et fuseau persistés, labels `403` hôte / `200` admin, calendrier
« reste 2 (1 réservé) »). Base remise à l'état seed (8 users / 8 properties / 31 bookings /
22 avis).

## Chantier d'origine (audit n°2, contexte conservé)

L'implémentation de **T-221 → T-231** est engagée dans l'arbre de travail, hors de ce livrable
d'analyse : A1 (échéance des demandes) et A2 (règlements échus) livrés, plus A3 (interrupteurs
d'e-mails), A4 (parrainage réglable), A5 (notifications d'avis) et A6 (édition complète de
chambre). Restent A7 (horaires d'arrivée/départ), A8 (badges administrables), A9 (libellé du fil),
A10 (`suspended_at`) et A11 (codes de secours 2FA).

## Livré par cette passe

1. **Analyse** : `docs/analyse_2026-09-10_audit_runtime_profondeur.md` + copie `.ai/REPORTS/` ;
   BACKLOG T-242 → T-244 ; PROGRESS et DEVLOG.
2. **Preuves positives** : matrice de permissions exhaustive, révocation de session souhaitée à
   toutes les entrées, restitution unique des bénéfices (promotion/wallet) à l'annulation,
   idempotence `email_outbox`, `POST /api/seed` fermé hors environnement démo, 404 sur brouillons
   et wishlists privées, aucune route orpheline hors tombeau 410 du paiement (T-207).
3. **Aucun code produit modifié** par cette passe ; base remise à l'état seed et sondes supprimées.
