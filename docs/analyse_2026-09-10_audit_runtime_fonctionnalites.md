# Analyse profonde — scénarios et éléments fonctionnels inachevés ou mal pensés

- **Date** : 2026-09-10
- **Branche** : `arena/01a08b7d-mybestbooking`
- **Périmètre** : exécution réelle (pages, boutons, filtres, parcours) pour les 3 rôles (voyageur, hôte, admin), en dev **et** en build de production
- **Méthode** : inventaire statique (39 pages, 67 routes API, recherche de composants/routes orphelins), parcours HTTP multi-rôles (matrice 20 pages × 3 rôles), sondes API/SSR ciblées, lecture du code pour chaque anomalie, **expérimentations de correctif rebuildées et re-testées** (§2.1)
- **État du dépôt** : arbre identique à `HEAD` (`e0e5f23`) — aucune modification de code dans cette analyse ; la base de démonstration a été remise à l'état seed après les sondes

---

## 1. Synthèse

| # | Constat | Type | Sévérité | Vérifié |
|---|---|---|---|---|
| P1 | Toutes les pages « introuvables » (`notFound()`) répondent **HTTP 200** (soft-404) | Défaut système | **Élevée** (SEO + supervision) | dev + prod |
| P2 | `/dashboard/properties/[id]` est **100 % client** : pas de SSR, `notFound()` impossible, id invalide → écran d'erreur | Inachevé | **Élevée** | prod |
| P3 | La **modération des avis** (`settings.reviews.requireModeration`) n'est pas exposée dans `/dashboard/settings` | Inachevé | Moyenne | prod |
| P4 | Les réservations **passées** de `/mes-reservations` n'ont **aucune action** : ni contact, ni **facture/reçu** | Mal pensé | Moyenne | prod |
| P5 | Les **promotions** ne sont pas éditables en UI alors que `PATCH /api/promotions/[id]` existe | Inachevé | Moyenne | code + API |
| P6 | L'édition d'une **chambre** est enfouie dans la page Calendrier ; `/dashboard/rooms/[id]` → 404 | Mal pensé | Moyenne | prod |
| P7 | `/messages` masque le fil créé par « Contacter l'hôte » tant qu'aucun message n'est envoyé | Mal pensé | Faible | prod |
| P8 | La carte « **Factures** » de la facturation contient en réalité des **versements** | Mal nommé | Faible | prod |
| P9 | Code mort / surfaces fantômes (3 composants, 5 routes sans appelant) et audit non paginé | Hygiène/robustesse | Faible | code |
| P10 | La navigation admin (sidebar + mobile) **n'a pas d'entrée « Chambres »** alors que l'écran existe | Mal pensé | Faible | code |

**Ce qui n'est PAS un défaut** (vérifié sain, à préserver) : gardes de rôle (307 conformes sur 13 routes dashboard × 2 rôles), FSM de réservation + sélecteur de statut, éditeur de commission hôte, contrat bulk, i18n FR/EN (1532 clés, 0 candidat), messagerie (notification e-mail destinataire), cron (rappels, avis, alertes prix, expiration), wishlists, avis (création + agrégat + modération API), smoke 95/95, build 65 pages.

---

## 2. Constats détaillés

### P1 — Soft-404 : les pages introuvables répondent 200 (défaut systémique)

**Problème.** Toutes les pages qui appellent `notFound()` renvoient **HTTP 200** avec le corps de la page « Page introuvable ». Seules les URL réellement inconnues (aucune route) renvoient 404.

**Preuve (build de production, port 3100).**

| URL | Statut observé | Attendu |
|---|---|---|
| `/hebergement/inconnu-xyz` | **200** | 404 |
| `/dashboard/bookings/00000000-…-999` | **200** | 404 |
| `/dashboard/rooms/NONE/calendrier` | **200** | 404 |
| `/messages/00000000-…-999` | **200** | 404 |
| `/page-totalement-inexistante` | 404 | 404 |

**Cause racine identifiée et prouvée.** `src/app/loading.tsx` (racine) place **tout** l'arbre applicatif derrière une frontière `Suspense` : le shell est envoyé (statut 200 figé) **avant** que la page ne lève `notFound()`. Expérience : fichier déplacé + rebuild → `/hebergement/inconnu-xyz`, `/dashboard/bookings/<absent>`, `/dashboard/rooms/NONE/calendrier` repassent en **404** ; variante `(main)/loading.tsx` + `dashboard/loading.tsx` → le soft-404 **revient** (toute frontière située au-dessus d'une route `[id]` suffit).

**Solution non régressive (validée par rebuild).** Déplacer le squelette du niveau racine vers des `loading.tsx` **au niveau feuille**, uniquement sur les routes de liste sans enfant dynamique :
`(main)/recherche/`, `(main)/mes-reservations/`, `(main)/mes-favoris/`, `(main)/messages/`, `(main)/bestrewards/`, `dashboard/bookings/`… ⚠️ **jamais** `dashboard/bookings/loading.tsx` (il couvrirait `bookings/[id]`) : viser les feuilles pures (`dashboard/billing/`, `dashboard/analytics/`, `dashboard/settings/`, `dashboard/users/`, `dashboard/audit/`, `dashboard/promotions/`, `dashboard/reviews/`, `dashboard/properties/` est à proscrire car parent de `[id]`).
Test de contrôle effectué : avec `(main)/recherche/loading.tsx` + `dashboard/billing/loading.tsx`, les quatre URL introuvables sont **404**, tandis que `/recherche` et `/dashboard/billing` continuent de streamer leur squelette. Aucune ligne de logique métier n'est touchée.
**Variante minimale** si l'on veut zéro fichier : supprimer la racine `loading.tsx` (perte du spinner global, statuts corrects partout).
**Impact si non traité** : pages « introuvables » indexables (soft-404 SEO), impossible de détecter un lien cassé via le code HTTP (`smoke`, `site-audit`, supervision CDN), et cache/observabilité faussés.

### P2 — `/dashboard/properties/[id]` : écran d'édition entièrement client

**Problème.** La page d'édition d'hébergement est un composant client (`useParams()` + `fetch('/api/properties/:id')` + `fetch('/api/auth/me')`). Conséquences observées :
- pas de rendu serveur (spinner puis écran) ;
- **id malformé** (`/dashboard/properties/abc`) ou UUID absent → l'utilisateur voit l'**écran d'erreur** applicatif (statut 200), pas l'état « Hébergement introuvable » prévu (`prop.notFound`) ;
- le statut HTTP reste 200 dans tous les cas, donc P1 s'y ajoute ;
- le rôle admin est déterminé par un second aller-retour réseau, et l'état « introuvable » n'est atteignable que si l'API répond 200 sans `property`… ce qu'elle ne fait jamais (elle répond 404/400).

**Solution non régressive.** Garder le formulaire client à l'identique, mais l'envelopper dans un **composant serveur** (modèle déjà utilisé par `/mon-compte` ou `bookings/[id]`) : le serveur `isUuid()` + charge la propriété, appelle `notFound()` si absente, lit le rôle, puis passe `initialProperty`, `initialRooms`, `isAdmin` au client — qui perd simplement son `useEffect` de chargement initial. Les `PUT`/upload/`PATCH` restent inchangés, donc aucun risque sur l'édition.

### P3 — Modération des avis impossible à activer depuis l'interface

**Problème.** Le réglage `settings.reviews.requireModeration` (défaut `false`) pilote le statut initial des nouveaux avis (`pending` au lieu de `approved`), alimente la file « En attente » de `/dashboard/reviews`, et conditionne les libellés voyageur (« en attente »/« publié »). Or le panneau `/dashboard/settings` ne rend que les sections General, Billing, Bestrewards, Cancellation, EmailTemplates, Security, Providers : **aucun contrôle pour ce réglage**.

**Preuve.** `PATCH /api/admin/settings/reviews {"requireModeration":true}` → **200** (la clé existe, l'API fonctionne) ; `grep requireModeration src/components/admin/settings-panel.tsx` → aucun résultat ; base seed : 24 avis `approved`, 0 `pending`.

**Solution non régressive.** Ajouter une section « Avis » dans le panneau, sur le modèle exact des autres (`useState(initial)`, `saveSection("reviews", v, …)`, bouton Enregistrer), avec une case à cocher et libellés FR/EN. Aucune modification d'API ni de schéma : la clé, le défaut et les appelants existent déjà.

### P4 — Séjours passés : aucune action, donc aucun justificatif pour le voyageur

**Problème.** Dans `/mes-reservations`, seules les cartes « à venir » instancient `<BookingRowActions>` ; le bloc « Passées » n'affiche que les liens « Laisser un avis ». Le composant, lui, rend le lien **« Facture / Reçu »** dès que `paymentStatus === "paid"` — donc le voyageur ne peut **pas** télécharger de justificatif pour un séjour terminé, et l'API correspondante (`GET /api/bookings/[id]/invoice`, HTML imprimable, i18n, garde « payé ») n'est accessible que depuis le dashboard hôte/admin (auquel le voyageur n'a pas accès — proxy 307).

**Preuve.** 8 réservations `completed` payées pour `pierre.bernard@email.com` → HTML de `/mes-reservations` : 0 occurrence de `invoice`/`Facture`, 8 liens `avis/…`.

**Solution non régressive.** Ajouter `<BookingRowActions … messageArea="traveler">` (ou a minima le lien facture) dans les cartes passées : le composant est déjà utilisé ailleurs, sans nouveau code serveur.

### P5 — Promotions : API d'édition sans interface

**Problème.** `PATCH /api/promotions/[id]` accepte `name`, `isActive`, `maxUses`, `maxDiscount`, `validUntil` (avec garde date de fin > date de début, T-126) et **aucun écran ne l'appelle**. `PromotionsManager` n'offre qu'activer/désactiver/supprimer, plus `promotions/new`. Prolonger une campagne ou corriger un plafond oblige donc à supprimer/recréer la promotion → **perte de `currentUses`** (145/67/23/8 en base de démo).

**Solution non régressive.** Réutiliser `promotion-form` en mode édition (route `/dashboard/promotions/[id]` ou panneau en ligne dans la liste) branché sur le PATCH existant ; le formulaire de création et le contrat bulk restent intacts. À défaut, documenter l'API comme volontairement réservée à l'usage programmatique.

### P6 — Chambres : édition enfouie, route d'édition inexistante

**Problème.** La liste `/dashboard/rooms` ne propose qu'un bouton « Calendrier » par ligne ; le formulaire d'édition (`RoomEditSection` : nom, prix, quantité, capacité, enfants, activation) vit **en bas** de `/dashboard/rooms/[id]/calendrier`. `/dashboard/rooms/<uuid>` renvoie 404 (route absente). Un hôte cherchant à changer un prix doit deviner que l'édition se trouve dans le calendrier.

**Solution non régressive.** Deux options : (a) renommer l'action de ligne « Gérer » + lien d'ancre vers la section d'édition (1 ligne d'i18n, zéro logique) ; (b) créer `/dashboard/rooms/[id]` qui réutilise `RoomEditSection` (et déplace calendrier/rate-plans en onglets), en gardant `/calendrier` fonctionnel pour les liens existants.

### P7 — Messagerie : le fil « sans message » disparaît de la liste

**Problème.** `POST /api/conversations` crée le fil et `ContactHostButton` redirige vers `/messages/<id>` ; mais `GET /api/conversations` filtre `EXISTS (SELECT 1 FROM messages …)` (T-206/F9) : si le voyageur va sur `/messages` avant d'écrire, **son fil n'apparaît pas** — impression de conversation perdue.

**Preuve.** POST → `201` (id `7de2af34-…`) ; `GET /api/conversations` → `{"conversations":[]}` ; après un message → le fil apparaît ; `/messages/<id>` → 200 dans les deux cas.

**Solution non régressive.** Conserver le filtre pour les compteurs/dashboards, mais inclure dans la liste les fils **du voyageur courant** créés récemment (< 24 h) sans message, ou à défaut afficher un bandeau « brouillon non envoyé » sur la page de détail. Modification locale à `GET /api/conversations` (ou au rendu de `/messages`), sans toucher aux notifications.

### P8 — « Factures » qui sont des versements

**Problème.** `/dashboard/billing` : la carte « **Factures** » liste `listPersistedPayouts()` (versements) et son export pointe sur `/export-payouts`, avec la note « Les factures et exports seront disponibles après intégration du moteur comptable ». Il existe pourtant un **reçu/facture par réservation** (`src/lib/invoice.ts`, `GET /api/bookings/[id]/invoice`) — invisible depuis cet écran, et inaccessible au voyageur (cf. P4).

**Solution non régressive.** Renommer la carte « Versements / relevés » (i18n) et ajouter un accès aux reçus existants (soit le lien déjà présent sur les lignes de réservation, soit un rappel « reçus par réservation : voir Réservations → détail »). Aucune donnée ni calcul modifié.

### P9 — Code mort, routes sans appelant, audit limité

**Problème.**
- Composants jamais importés : `src/components/stripe-payment-form.tsx`, `payout-account-form.tsx`, `payout-request-button.tsx` (flux désactivés par T-207/T-209) → faux signal « paiement carte / versements actifs ».
- Routes sans appelant applicatif : `GET /api/admin/audit` (paginée, rate-limitée), `GET /providers/stripe`, `POST /webhooks/stripe`, `POST /api/bookings/[id]/payment` (410), `GET /api/cron/payouts` (410).
- `/dashboard/audit` charge en dur **les 100 dernières lignes** et filtre côté client, sans pagination, alors que l'API paginée existe.

**Solution non régressive.** Supprimer les composants orphelins (ou les marquer `@deprecated` et les lister dans `FEATURES.md` comme volontairement inactifs) ; brancher `/dashboard/audit` sur `/api/admin/audit` (recherche + pagination) ou assumer la limite 100 dans l'UI ; documenter les routes 410 comme contrat.

### P10 — Navigation admin sans « Chambres »

**Problème.** `adminLinks` (sidebar desktop **et** menu mobile) n'inclut pas `/dashboard/rooms`, alors que la page existe, affiche toutes les chambres à l'admin et lui réserve les actions groupées — l'écran n'est atteignable que par URL directe.

**Solution non régressive.** Ajouter l'entrée dans les deux listes `adminLinks` (icône déjà importée) ; aucun changement de droits.

---

## 3. Ce qui est sain (et pourquoi les correctifs ci-dessus sont sûrs)

- **Autorisations** : 13 routes dashboard × rôles → 307 conformes (hôte → admin-only, voyageur → tout le dashboard) ; les API renvoient 401/403 conformes (sondes sans cookie et cross-rôle).
- **Réservation** : FSM centralisée (`transitionError`), sélecteur de statut en liste (T-216), `markPaidOffline`, gardes date/paiement, audits `booking.status.update` — cohérents UI/API.
- **Commission** : éditeur hôte + propagation explicite (T-215), audits présents.
- **Bulk** : contrat `{entity, action, requested, succeeded, skipped[], failed[]}` stable, gate d'approbation respecté.
- **i18n** : FR = EN = 1532 clés, 0 candidat FR dur dans la surface UI scannée.
- **Fichiers/données** : aucune modification de schéma dans cette analyse ; base remise à l'état seed après sondes (8 comptes / 8 hébergements / 33 réservations / 24 avis / file e-mails vide / journal d'audit vide).

---

## 4. Plan d'action proposé (ordre et stratégie)

| Lot | Contenu | Risque | Régressions à vérifier |
|---|---|---|---|
| **Lot 1** | P1 : déplacer le squelette de chargement vers les routes feuilles (ou le retirer) | Faible (frontière Suspense) | statuts 404/200 sur 6 URL de contrôle ; `/`, `/recherche`, dashboard toujours rendus ; `smoke` + `site-audit` |
| **Lot 2** | P2 : wrapper serveur de l'édition d'hébergement + `notFound()` | Moyen | édition/upload/commission admin ; gardes de rôle ; 404 sur id invalide/absent |
| **Lot 3** | P3 : section « Avis » dans les paramètres (modération) | Très faible | `/dashboard/settings` complet ; POST avis → `pending` quand activé, `approved` sinon |
| **Lot 4** | P4 + P8 : actions des séjours passés (facture/reçu) ; renommage « Versements » | Faible | `/mes-reservations` (avis conservés), facture toujours 200 pour un paiement réglé, 403 sinon |
| **Lot 5** | P5 + P6 + P10 : édition promotion, entrée « Chambres », libellé « Gérer » | Faible | promotions (validation T-126), bulk rooms, navigation par rôle |
| **Lot 6** | P7 + P9 : liste des fils sans message, nettoyage du code mort, audit paginé | Faible | compteurs non-lus, notifications e-mail, `/dashboard/audit` |

**Portes de sortie communes** : `npm run typecheck` · `npm run lint` · `npm run i18n:check` (catalogue FR/EN à jour) · `npx vitest run` (642 tests) · `npx next build` · `npm run smoke` (95/95) · plus, pour le Lot 1, la **matrice de statuts** ci-dessus rejouée en production (`next start`) — c'est la preuve que le soft-404 est corrigé.

## 5. Annexe — commandes de reproduction

```bash
# Matrice de rôles (dev :3000)
for r in admin host cust; do curl -s -o /dev/null -w "%{http_code}" -b /tmp/$r.jar http://127.0.0.1:3000/dashboard/users; done

# Soft-404 (prod :3100, build courant)
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3100/hebergement/inconnu-xyz                 # 200 → doit être 404
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3100/dashboard/bookings/00000000-0000-4000-8000-000000000999

# Modération (réglage réel, sans UI)
curl -s -b /tmp/admin.jar -X PATCH http://127.0.0.1:3100/api/admin/settings/reviews \
  -H 'content-type: application/json' -d '{"requireModeration":true}'                                  # 200

# Facture d'un séjour payé (voyageur) — absente de /mes-reservations (P4)
curl -s -b /tmp/pierre.jar -o /dev/null -w "%{http_code}\n" "http://127.0.0.1:3100/api/bookings/<bookingId>/invoice"   # 200
```
