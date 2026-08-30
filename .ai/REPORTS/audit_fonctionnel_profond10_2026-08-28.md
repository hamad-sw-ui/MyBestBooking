# Audit fonctionnel profond n°10 — MyBestBooking

- **Date** : 2026-08-28 · **Branche** : `arena/01a042cf-mybestbooking` (base T-129 `4644bc8`)
- **Méthode** : exécution réelle (dev, sessions customer/host/admin + anonyme), au-delà du HTTP 200 ; code relu. Aucun code de production modifié pendant l'audit ; données de test nettoyées.
- **Périmètre neuf** : messagerie (compteurs/navigation), compte client / **parrainage**, édition d'hébergement (onglet Photos), facturation hôte vs factures par réservation, machine à états des réservations (**clôture / no-show hôte**), alertes prix, recherche/favoris.

## Synthèse

Le back-end est globalement complet et sain (machine à états, RBAC, alertes, messagerie cœur). Quatre écarts concernent des **fonctionnalités livrées côté serveur mais inaccessibles ou incomplètes côté interface** — des « fonctionnalités fantômes » : l'utilisateur ne peut pas déclencher un parcours que l'API supporte pourtant.

| Ref | Sévérité | Sujet |
|-----|----------|-------|
| **P1** | 🟠 Moyenne | **Clôture d'un séjour / no-show inaccessible à l'hôte dans l'UI.** L'API autorise `confirmed→completed`/`no_show` par l'hôte (après départ) et la transaction verserait la fidélité, mais aucune page ne propose le bouton. Conséquence enchaînée : le **cron clôture automatiquement en `completed`** tout séjour `confirmed+paid` après `checkOut`, sans tenir compte d'un no-show → un voyageur non présenté reçoit quand même sa récompense fidélité/parrainage. |
| **P2** | 🟡 Basse-moyenne | **Le parrainage (T-125) est livré côté serveur mais jamais exposé.** `GET /api/users/me/referral` renvoie un code, le composant `<ReferralCard/>` existe, mais il n'est monté **nulle part** ; pire, l'onglet Notifications de « Mon compte » affiche « *Le programme de parrainage n'est pas encore ouvert* », en contradiction avec le back-end. |
| **P3** | 🟡 Basse | **Aucun badge « messages non lus » dans la navigation globale.** Les compteurs `unreadByUser`/`unreadByHost` sont corrects (incrément à la réception, remise à zéro à la lecture — vérifié) et affichés sur la page liste, mais l'utilisateur n'a aucun signal dans le header/sidebar : il ne sait pas qu'un message l'attend sans ouvrir la page. |
| **P4** | 🟡 Basse | **Onglet Photos de l'édition d'hébergement quasi inutilisable.** L'upload de photos (T-113) n'est branché que dans la page de **création** ; la page d'**édition** ne permet que de coller une URL de photo principale à la main. La galerie (`images[]`, acceptée par `PUT /api/properties`) n'est pas éditable et l'upload de fichier est absent. |

---

## P1 — Clôture de séjour / no-show sans bouton hôte + cron qui gratifie les no-show

### Preuves

- L'API est prête : `transitionError` (`src/lib/booking-lifecycle.ts`) autorise pour un **host** les transitions `confirmed→completed|no_show` **après la date de départ** (« Le séjour ne peut être clôturé qu'après la date de départ »), et `PUT /api/bookings/[id]` traite `completed` (transaction avec récompense fidélité/parrainage).
- Exécution : `PUT status=completed` par l'hôte **avant** départ → **400** « …après la date de départ » ✅ ; par le voyageur → **400** « Un voyageur peut uniquement annuler » ✅.
- **Mais** `src/components/booking-row-actions.tsx` (seul bloc d'actions du détail réservation hôte `dashboard/bookings/[id]`) ne propose que **Contacter / Facture / Annuler**. Aucun bouton « Terminer le séjour » ni « Marquer no-show ». Le bulk manager ne fait que `cancel`. Il n'existe aucun autre déclencheur UI.
- Le cron (`src/app/api/cron/price-alerts/route.ts`, `completeEligibleBookings`) passe automatiquement en **`completed`** toute réservation `confirmed` + `paid` dont `checkOut ≤ aujourd'hui`, et **verse fidélité + récompense parrainage** dans la foulée. Il n'y a pas d'état `no_show` posé au préalable possible (puisqu'aucun bouton), donc un voyageur qui ne s'est pas présenté est gratifié comme s'il avait séjourné.

### Impact

- L'hôte ne peut pas gérer ses fins de séjour depuis l'interface (tout repose sur le cron).
- Gratification fidélité/cashback/parrainage versée pour des **no-show** (perte financière et faux indicateurs : avis/séjours).

### Solution sans régression

1. **Boutons hôte dans `BookingRowActions`** (visibles seulement `messageArea==="dashboard"`, rôle hôte/admin, statut `confirmed`, et `checkOut` passé pour `completed`) :
   - « Terminer le séjour » → `PUT status:"completed"` ;
   - « Marquer non-présentation » → `PUT status:"no_show"` (avec confirmation).
   Les gardes serveur (`transitionError`) restent la source de vérité ; l'UI ne fait qu'appeler l'API existante.
2. **Ne pas casser le cron** : on conserve l'auto-complétion (filet de sécurité), mais on le rend **no-show aware de façon optionnelle** — le plus simple et non bloquant : si l'hôte a marqué `no_show` avant le passage du cron, la réservation n'est plus `confirmed` et le cron l'ignore naturellement (déjà le cas via le statut terminal). Aucune migration nécessaire.
3. **Gratification** : la récompense fidélité/parrainage ne doit être versée qu'en `completed` (jamais en `no_show`). Vérifier que `loyaltyAwardedAt` n'est posé que pour `completed` (le cron et la route `completed` le font déjà ; un `no_show` manuel n'a pas de chemin de gratification). C'est déjà le cas — il suffit de donner le bouton.

---

## P2 — Parrainage livré mais invisible (et message contradictoire)

### Preuve

- `GET /api/users/me/referral` (client connecté) → **200** `{"code":"ZSAN42LX"}` ; anonyme → **401**.
- L'inscription accepte `referralCode` et `?ref=` (T-125) ; la récompense est versée au séjour (cron).
- `src/components/referral-card.tsx` existe (affiche code + bouton copier + lien d'inscription) mais **n'est importé ni monté nulle part** (grep : aucun import hors le fichier lui-même).
- `src/app/(main)/mon-compte/page.tsx`, onglet Notifications, affiche : « *Le programme de parrainage n'est pas encore ouvert : aucun avantage ne sera promis…* » — contredit par l'API.

### Impact

Fonctionnalité d'acquisition (parrainage) entièrement opérante côté serveur mais **inutilisable par l'utilisateur** : il ne peut ni voir ni partager son code.

### Solution sans régression

- Monter `<ReferralCard/>` dans « Mon compte » (onglet **BestRewards**, naturellement, ou un onglet dédié) — il gère déjà chargement/erreur/copie en autonome.
- Retirer/remplacer la mention « pas encore ouvert » de l'onglet Notifications par un lien vers la carte parrainage.
- Aucune modification d'API ; le composant existe et est testé.

---

## P3 — Pas de badge messages non lus dans la navigation

### Preuve

- Cœur messagerie sain à l'exécution : envoi customer → `unreadByHost=1` ; host répond → `unreadByUser=1` ; lecture (`GET /api/messages`) → remis à **0** ; admin non-participant → **403** ; création idempotente.
- Les compteurs sont affichés sur la liste `/messages` (badge « N nouveaux »).
- Mais le **header** (`src/components/layout/header.tsx`) et le **dashboard sidebar/mobile** (`dashboard-sidebar.tsx`, `dashboard-mobile-header.tsx.tsx`) pointent vers `/messages` **sans aucun compteur**. Aucun endpoint ne renvoie un total non-lu global (le compteur par conversation existe dans `GET /api/conversations`).

### Impact

L'utilisateur ne voit pas qu'il a des messages en attente quand il navigue ailleurs → temps de réponse dégradé, messages manqués.

### Solution sans régression

- Petit composant client `<UnreadMessagesBadge/>` qui `fetch("/api/conversations")` et additionne `unreadByUser` (côté voyageur) / `unreadByHost` (côté hôte, selon le rôle) ; affiche une pastille si > 0. Monté à côté des liens « Messages » du header et des sidebars.
- Additif, aucune route nouvelle (réutilise `GET /api/conversations`), aucune donnée sensible exposée (l'endpoint filtre déjà par participant).

---

## P4 — Édition d'hébergement : onglet Photos incomplet (pas d'upload, galerie non éditable)

### Preuve

- La **création** (`dashboard/properties/new`) propose bien l'upload de fichier via `POST /api/properties/upload` (T-113).
- L'**édition** (`dashboard/properties/[id]/page.tsx`, onglet Photos) ne contient qu'un champ « Photo principale (URL) » à coller à la main + un texte « Ajoutez des URLs d'images supplémentaires… » **sans champ correspondant**. Le `PUT` envoie bien `images: property.images`, mais aucune UI ne permet de modifier ce tableau ni d'uploader.
- `PUT /api/properties/[id]` accepte pourtant `mainImage` **et** `images: string[]`.

### Impact

Un hôte ne peut pas ajouter de photos après création (deuxième écran le plus important d'une annonce) sans bidouiller une URL ; la galerie reste figée sur ce qui a été saisi à la création.

### Solution sans régression

- Réutiliser le gestionnaire d'upload de la page création dans l'onglet Photos de l'édition : `<input type=file>` → `POST /api/properties/upload` → ajoute l'URL retournée à `property.images` (et définit `mainImage` si vide) ; miniatures + suppression (retrait du tableau) ; sauvegarde via le `PUT` existant.
- Aucun changement d'API (upload et PUT existent déjà) ; purement UI.

---

## Zones vérifiées SAINES (à ne pas régresser)

- **Machine à états** : `completed` avant départ → 400 ; voyageur ne peut que annuler → 400 ; transitions client/host/admin correctes ; `cancelBooking` unifié route individuelle/bulk.
- **RBAC édition propriété** : customer `PUT` sur propriété d'autrui → **403** ; GET hôte renvoie bien property + rooms ; pages billing host 200 / customer 307.
- **Factures** : `GET /api/bookings/[id]/invoice` renvoie 200 (reçu/facture) sur réservation payée, accès owner/host/admin, lien présent dans les actions de réservation. La page facturation hôte affiche honnêtement « factures légales indisponibles » pour la **compta périodique** (distinct des reçus par réservation).
- **Alertes prix** : propriété inexistante → **404** (T-127), alerte valide → **201**, suppression → 200 ; schéma `maxPrice` validé.
- **Messagerie cœur** : compteurs non-lus incrémentés/remis à zéro, isolement des non-participants (403), idempotence des conversations.
- **Recherche/favoris** : pagination serveur (`limit/total/pages`), favoris branchés (`PropertyCardClient`), pages 200.
- **Annulation / wallet / remises** : corrigés et validés en T-126/T-127/T-129 (non revérifiés ici pour ne pas dupliquer).

## Aucune donnée de test résiduelle

- Conversation de test `f440206c-…` (2 messages) supprimée.
- Réservation de test FSM `MBB-2026-2OLTBT` supprimée.
- Alerte de prix de test `4990f0d4-…` supprimée.
