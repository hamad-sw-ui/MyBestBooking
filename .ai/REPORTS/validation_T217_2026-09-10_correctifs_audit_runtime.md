# Validation T-217 — correctifs P1–P10 de l'audit runtime (2026-09-10)

**Analyse d'origine** : `docs/analyse_2026-09-10_audit_runtime_fonctionnalites.md`
(commit `e8ecc71`), 10 constats P1–P10 + plan en 6 lots.
**Niveau** : L (implémentation de multiples correctifs ciblés, sans changement de
schéma). **Mandat** : implémenter les remarques **sans régression**, tout testé
avant de s'arrêter (règles `.ai/`).

---

## 1. Correctifs livrés

### Lot 1 — P1 : soft-404 systémique *(BUG-051)*

- **Cause racine** : `src/app/loading.tsx` **racine** plaçait tout l'arbre sous
  une frontière `Suspense` ; le shell partait en **HTTP 200** avant que la page
  ne lève `notFound()` (le client recevait l'UI 404 avec un statut 200).
- **Correctif** : suppression du `loading.tsx` racine, remplacé par un squelette
  partagé `src/components/page-loading.tsx` posé **au niveau feuille** sur onze
  routes de liste **sans enfant dynamique** : `(main)/recherche`, `mes-favoris`,
  `bestrewards`, `aide`, `reservation`, `dashboard/{analytics,audit,billing,reviews,settings,users}`.
- **Garde-fou documenté dans le fichier** : ne jamais poser de `loading.tsx` sur
  un segment parent d'une route `[id]` (`dashboard/promotions` a été
  volontairement exclu : `[id]` et `new` sont dessous). Les onze pages feuilles
  ont été vérifiées : aucune n'appelle `notFound()` → aucun soft-404 possible.
- **Preuve production (`next start`, port 3100, build du jour)** :

| URL | Avant | Après |
|---|---|---|
| `/hebergement/inconnu-xyz` | 200 | **404** |
| `/dashboard/bookings/00000000-…-999` | 200 | **404** |
| `/dashboard/rooms/NONE/calendrier` | 200 | **404** |
| `/messages/00000000-…-999` | 200 | **404** |
| `/page-totalement-inexistante` | 404 | 404 |
| `/dashboard/properties/abc` | 200 | **404** |
| `/dashboard/rooms/abc` | 200 | **404** |
| `/wishlists/share/inconnu` | 200 | **404** |

- **Non-régression** : 18 pages valides rejouées en production → 200
  (`/`, `/recherche`, `/aide`, `/mes-favoris`, `/bestrewards`, `/reservation`,
  `/dashboard`, `billing`, `analytics`, `audit`, `settings`, `users`, `reviews`,
  `promotions`, `rooms`, édition d'hébergement, calendrier chambre, `/messages`) ;
  le squelette feuille est bien streamé (markup `animate-spin` présent dans le
  flux initial de `/recherche`, `/dashboard/billing`, `/dashboard/audit`).
- **Effet de bord assumé et corrigé** : `/maintenance` renvoyait un **307 vrai**
  une fois le soft-redirect supprimé (page inactive → redirection `/`), ce qui
  faisait échouer à tort l'assertion smoke « 200 ». L'assertion accepte
  désormais les deux issues réelles (`200` si maintenance active, `307` sinon) —
  smoke **95/95** de nouveau.

### Lot 2 — P2 : édition d'hébergement rendue côté serveur *(BUG-052)*

- `src/app/dashboard/properties/[id]/page.tsx` était **entièrement client**
  (`useParams` + deux `fetch`) : aucun `notFound()` possible, identifiant
  malformé → écran d'erreur applicatif en 200.
- Découpage : `page.tsx` = RSC (garde de rôle, `isUuid()`, chargement
  propriété + chambres, `notFound()`, redirection du non-propriétaire) ;
  `property-edit-client.tsx` = formulaire client inchangé, amorcé par
  `initialProperty` / `initialRooms` / `isAdmin` (plus de `useEffect` de
  chargement ; `PUT`, upload et commission admin conservés tels quels).
- ▶️ hôte propriétaire → **200** avec le nom rendu côté serveur ; `abc` → **404** ;
  UUID absent → **404** ; aucun spinner résiduel.

### Lot 3 — P3 : section « Avis » (modération) *(BUG-053)*

- Le réglage `reviews.requireModeration` (lu par `POST /api/reviews` pour
  décider `pending`/`approved`) n'avait **aucun contrôle** dans
  `/dashboard/settings`.
- Ajout de `ReviewsSection` (modèle exact de `SecuritySection`) : bascule
  « Modération préalable des avis », enregistrement via
  `PATCH /api/admin/settings/reviews`, note explicitant le défaut
  historique (`false` = publication immédiate) et lien vers la file de
  modération. +6 clés FR/EN.
- ▶️ activation → `{"requireModeration":true}` 200 · `POST /api/reviews` →
  statut **`pending`**, avis visible dans `/dashboard/reviews` · désactivation →
  retour au comportement historique. Aucune API ni schéma modifié.

### Lot 4 — P4 + P8 : justificatifs voyageur et « Versements » *(BUG-054, BUG-055)*

- **P4** : les cartes « Passées » de `/mes-reservations` n'instanciaient pas
  `BookingRowActions`, donc aucun accès au **reçu/facture** pour un séjour
  terminé payé. Réutilisation du composant tel quel (aucun nouveau code
  serveur ; l'annulation reste masquée pour un statut clos).
  ▶️ `pierre.bernard@` : **8** liens `/api/bookings/<id>/invoice` (0 avant),
  8 liens d'avis conservés, aucun bouton d'annulation.
- **P8** : la carte « Factures » de `/dashboard/billing` listait
  `listPersistedPayouts()` — renommée **« Versements et relevés »** (FR/EN),
  badge « Aucun versement enregistré », texte d'état corrigé et **pointeur
  explicite vers les reçus par réservation** (+ lien « Voir les réservations »).
  ▶️ rendu vérifié ; l'export `/export-payouts` reste inchangé, `/export`
  (bookings) conservé pour `/dashboard/bookings`.

### Lot 5 — P5 + P6 + P10 : édition promo, accès chambre, navigation *(BUG-056, BUG-057, BUG-058)*

- **P5** : `PATCH /api/promotions/[id]` existait sans écran. Nouvelle page
  `/dashboard/promotions/[id]` (admin-only, `notFound()` sur id invalide/absent)
  + `PromotionEditForm` : champs modifiables par l'API uniquement (nom, date de
  fin, plafonds, actif), identité figée en lecture seule, rappel du nombre
  d'utilisations conservées. Extension **additive** de l'API : `null` accepté
  pour `maxUses`/`maxDiscount` (« illimité »), les valeurs numériques existantes
  sont inchangées. Lien « Éditer » ajouté dans la liste. Le formulaire de
  création n'a pas été touché.
  ▶️ `maxUses:null` → 200 avec `currentUses` 145 **préservé**, puis restauration
  → 200 ; page 200 / 404 conformes.
- **P6** : `/dashboard/rooms/<id>` (URL naturelle) renvoyait 404. Ajout d'une
  page de **redirection serveur** vers la surface d'édition réelle
  (`/dashboard/rooms/<id>/calendrier`, mêmes contrôles d'accès) + ancre
  `#room-edit` posée sur la section d'édition + second lien « Modifier l'unité »
  dans la liste des chambres (libellé « Calendrier » conservé).
  ▶️ `307` → `/calendrier`, `abc` → 404, ancre présente, liste 200.
- **P10** : `/dashboard/rooms` ajouté aux **deux** listes `adminLinks`
  (sidebar desktop + menu mobile) — icône déjà importée, aucun changement de
  droits. ▶️ lien présent dans le HTML de `/dashboard` (admin).

### Lot 6 — P7 + P9 : brouillon de fil, code mort, audit paginé *(BUG-059, BUG-060)*

- **P7** : `POST /api/conversations` crée le fil et redirige vers
  `/messages/<id>` ; la liste masquait les fils **sans message** (T-206/F9), donc
  un fil ouvert puis quitté devenait introuvable. Règle retenue (constante
  documentée, fonction pure testée) : un fil **vide** reste visible pendant
  **7 jours** après sa création (fenêtre de rattrapage), puis redevient masqué
  comme avant ; un fil avec message est toujours visible. Les compteurs/API
  (`GET /api/conversations`, badge non-lus) **gardent** le filtre T-206/F9.
  La fenêtre de 7 jours élargit volontairement la proposition initiale (24 h) :
  même intention, mais un fil ouvert avant un week-end reste rattrapable.
  ▶️ fil vide → visible dans `/messages` avec le libellé « brouillon », et
  toujours absent de `GET /api/conversations` (0 fil) ; +1 clé FR/EN.
- **P9** : les trois composants orphelins (`stripe-payment-form`,
  `payout-account-form`, `payout-request-button`) sont marqués
  `@deprecated` (flux retirés par T-207/T-209) et documentés dans
  `KNOWN_LIMITATIONS.md` → « Surfaces inactives », avec les routes sans
  appelant (`admin/audit` avant correctif, `providers/stripe`,
  `webhooks/stripe`, `bookings/[id]/payment` 410, `cron/payouts` 410).
  `/dashboard/audit` **branche désormais l'API paginée** `GET /api/admin/audit`
  (qui n'avait aucun appelant) : première page rendue côté serveur (100 entrées,
  requête inchangée), bouton « Charger plus » par offset, compteur d'entrées
  chargées/filtrées. Projection partagée `src/lib/audit-rows.ts` (testée) pour
  que serveur et client produisent la même forme. ▶️ page 200, API
  `?limit=1&offset=0` 200, libellés présents. +5 clés FR/EN.

---

## 2. Portes de sortie (toutes vertes)

| Porte | Résultat |
|---|---|
| `npm run typecheck` | ✅ 0 erreur |
| `npm run lint` | ✅ 0 erreur / 0 warning |
| `npm run i18n:check` | ✅ 0 candidat (catalogue **1559** clés, FR = EN) |
| `npx vitest run` (serveur dev actif) | ✅ **109 fichiers / 652 tests, 0 échec** (dont 10 nouveaux tests unitaires) |
| `npx next build` | ✅ 65 pages |
| `npm run smoke` | ✅ **95/95** (assertion `/maintenance` corrigée, cf. P1) |
| `npm run ai:check` | ✅ 19 OK / 1 warn (R7, levé par le commit `docs(state)`) / 0 fail |
| Matrice 404/200 en production | ✅ 8 URL invalides → 404 · 18 pages valides → 200 |
| Runtime ciblé (dev) | ✅ P2/P3/P4/P5/P6/P7/P8/P9/P10 voir §1 |

Tests ajoutés : `src/lib/conversation-visibility.test.ts` (7) et
`src/lib/audit-rows.test.ts` (3) ; compteur i18n mis à jour dans
`src/lib/ui-strings.test.ts`.

## 3. État de la base après session

Seed intact : 8 utilisateurs / 8 hébergements / 33 réservations / 24 avis ;
conversations, messages, alertes prix, journal d'audit, file e-mails et
wishlists remis à **0** ; `app_settings` ne contient que `general` (les clés
`reviews`/`security` créées par les sondes ont été supprimées) ; aucune
variation de schéma.

## 4. Limites résiduelles assumées

- Les trois composants `@deprecated` sont **conservés** (suppression
  volontairement écartée pour ne pas retirer un historique utile) : ils sont
  documentés comme inactifs.
- Les routes 410 (`bookings/[id]/payment`, `cron/payouts`) et
  `providers/stripe`/`webhooks/stripe` restent en place : elles constituent le
  contrat de compatibilité des anciens flux ; `KNOWN_LIMITATIONS.md` les liste.
- `/dashboard/audit` charge la première page (100) puis pagine à la demande :
  le filtrage reste local sur les entrées chargées (comportement historique
  conservé, la recherche API `?action=` existe pour un usage outillé).
- P7 : fenêtre de rattrapage fixée à 7 jours (constante exportée), au lieu des
  24 h proposées dans l'analyse — décision documentée ci-dessus.
