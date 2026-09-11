# Analyse d'impact — T-265 → T-270 (audit n°7, constats C1 → C6)

- **Date** : 2026-09-11 · **Branche** : `arena/01a0913d-mybestbooking` · **Niveau** : S (C5 : S+ migration additive)
- **Analyse source** : `docs/analyse_2026-09-11_audit_runtime_n7_fins_de_parcours.md` § 3
- **Décision** : implémentation des 3 lots (A : C1+C2 → T-265/T-266 · B : C3+C4 → T-267/T-268 · C : C5+C6 → T-269/T-270), instruction du 2026-09-11.

## Périmètre par tâche

| Tâche | Constat | Fichiers touchés |
|---|---|---|
| **T-265** (C1) | Confirmer une demande sur annonce suspendue / chambre désactivée | **nouveau** `src/lib/booking-availability.ts` · `src/app/api/bookings/[id]/route.ts` (branche confirmed) · test `route.t265.test.ts` |
| **T-266** (C2) | Remboursement hors plateforme « en cours » à vie | `src/app/(main)/mes-reservations/page.tsx` · `src/lib/ui-strings.ts` (+1 clé FR/EN) · `src/lib/mail/strings.ts` (+2 chaînes FR/EN) · `src/lib/mail/templates.ts` (param `refundLine`) · `src/lib/booking-cancellation.ts` (calcul de la ligne) · test email |
| **T-267** (C3) | Placeholder = photo d'une autre propriété | `public/seed-images/placeholder-property.jpg` (swap fichier) · `(main)/hebergement/[slug]/page.tsx` (état vide « pas de photos ») · `src/lib/ui-strings.ts` (+1 clé FR/EN) |
| **T-268** (C4) | Claim invité → `emailVerified` reste `false` | `src/app/api/auth/reset-password/route.ts` (1 ligne conditionnelle) · test |
| **T-269** (C5) | Timeline « confirmée » = `updated_at` | **migration** `drizzle/0026_bookings_confirmed_at.sql` · `src/db/schema.ts` (+colonne additive) · `PUT /api/bookings/[id]` (pose `confirmedAt`) · `dashboard/bookings/[id]/page.tsx` (repli) · `DATABASE.md` |
| **T-270** (C6) | `/messages` voyageur : 1+N requêtes, pas de fenêtre | `src/app/(main)/messages/page.tsx` (une requête de messages + `parsePageWindow` + `ShowMore`) · test |

## §14.1 — Les neuf questions

### T-265 (garde de disponibilité à la confirmation)

1. **Appelants directs** — `grep -rn 'method: "PUT"' src/components src/app --include=*.tsx` :
   `booking-row-actions.tsx` (5 PUT), `bulk/booking-settlement-cell.tsx` (1, `markPaidOffline`),
   `bulk/booking-status-select.tsx` (1, statut). Seul le couple **hôte/admin + statut `confirmed`**
   traverse la nouvelle garde ; `markPaidOffline` est traité **avant** la branche statut (retour
   anticipé) et n'est pas concerné.
2. **Indirectement** : `BookingStatusSelect` (dashboard hôte/admin) et le flux de paiement en
   ligne (410 depuis T-207) — ce dernier ne confirme plus rien ; `POST /api/bookings` (création de
   demande) n'est pas modifié.
3. **ViewModel** : n/a (server components + routes API).
4. **Écrans** : `dashboard/bookings` (statut), `mes-reservations` (actions voyageur — mais un
   voyageur ne passe jamais par `confirmed` : `transitionError` le refuse avant la garde).
5. **Workers/Services** : le cron `completeEligibleBookings` ne confirme pas (il clôt
   `confirmed → completed`) — non concerné ; `booking-request-expiration` annule les demandes
   expirées — non concerné.
6. **Tests existants** : `route.t203.test.ts` (markPaidOffline), `route.t206.test.ts`,
   `route.t216.test.ts` (audit de transition), `booking-lifecycle.test.ts` (transitions pures),
   `booking-confirmation.test.ts` (emails de confirmation). Aucun n'annule le statut du bien
   entre la création et la confirmation → **aucun test existant ne peut changer de résultat**.
7. **Nouveaux tests** : `route.t265.test.ts` — (a) demande pending + bien suspendu → confirm
   **409** « Hébergement non disponible » ; (b) hôte suspendu → 409 ; (c) chambre `isActive=false`
   → 409 « Chambre non disponible » ; (d) cas sain → 200 + `confirmedBy` posé (régression
   bloquée).
8. **Risques de régression** : un hôte qui confirme une demande sur un bien sain n'est jamais
   arrêté (mêmes prédicats que `POST /api/bookings` : `status='active'` + hôte non suspendu /
   supprimé + `rooms.isActive`). L'exception n'est jetée **sous le lock**, donc pas de fenetre de
   course ; la réponse 409 suit le pattern existant `BOOKING_*:`.
9. **À revérifier** : `PUT /api/bookings/[id]` complet (confirm sain, annulation, markPaidOffline,
   completed), e-mail de confirmation toujours émis au cas sain, cron d'expiration inchangé.

### T-266 (remboursement hors plateforme : affichage + e-mails)

1. **Appelants directs** — `grep -rn "refundPending\|refundStatus" src` : un seul affichage
   (`mes-reservations/page.tsx:299`), l'écriture (`booking-cancellation.ts:70`), la réconciliation
   PSP (`payment-events.ts`, no-op sans intent). La modification est **locale à la ligne 299**.
2. **Indirectement** : aucun autre écran ne lit `refundStatus` (vérifié par grep) ; le dashboard
   hôte n'affiche pas cet état (constat C2).
3. **ViewModel** : n/a.
4. **Écrans** : `/mes-reservations` seul (badge « Remboursement : X € — à traiter par
   l'hébergeur » au lieu de « en cours » quand `paymentMethodOffline`).
5. **Services** : `notifyBookingCancellation` — la ligne de remboursement est **ajoutée** au
   corps (voyageur **et** hôte) quand `refundStatus='pending'` ; elle n'est pas ajoutée aux
   annulations sans remboursement (demande non payée annulée) → aucun e-mail existant ne change
   dans ce cas.
6. **Tests existants** : `booking-cancellation-mail.test.ts` (T-150 : destinataires, langue,
   eventKeys — **pas** le corps) et `route.t216.test.ts` (annulation via la route). Aucun ne
   verrouille le corps des gabarits → pas de casse.
7. **Nouveaux tests** : test ciblé `notifyBookingCancellation` : annulation d'un booking payé
   offline → e-mail voyageur contient le montant + « hébergeur » (et pas « en cours ») ;
   annulation d'une demande non payée → aucun corps de remboursement.
8. **Risques** : la ligne est calculée **avant** l'appel template et n'est injectée que si
   non vide — un gabarit admin personnalisé (`pickEditable`) qui ne référence pas la ligne reste
   inchangé + la ligne s'y ajoute (contenu plateforme factuel, pas un placeholder `{…}` : aucun
   risque de variable orpheline rendue littérale). Le cas PSP conserve le libellé « en cours »
   (réconciliation cron existante).
9. **À revérifier** : `/mes-reservations` rendu complet (badge payé, échéance, actions), cycle
   d'annulation bout en bout (e-mails ×2), gabarits admin par défaut (réinitialisation),
   `booking-cancellation-mail` (T-150) inchangé.

### T-267 (placeholder neutre + état vide galerie)

1. **Appelants directs** — `grep -rn "placeholder-property" src` : 3 emplacements
   (`hebergement/[slug]/page.tsx:372,382`, `property-card-client.tsx:154`).
2. **Indirectement** : rien (chemin statique `public/`).
3. **ViewModel** : n/a.
4. **Écrans** : la fiche publique uniquement pour l'état vide ; la carte conserve son fallback
   unique (documenté : acceptable en carte — le swap de fichier la rend honnête).
5. **Services** : aucun.
6. **Tests existants** : aucun test ne référence le fichier placeholder (vérifié par grep) ;
   `reviews-page.t258.test.ts` rend la fiche d'un bien **avec** photos (non concerné).
7. **Nouveaux tests** : test RSC de la fiche — bien sans `mainImage` ni `images` → état « pas de
   photos » rendu, **aucun** `placeholder-property` dans le HTML ; bien avec images → galerie
   inchangée.
8. **Risques** : le swap de fichier n'a d'effet que sur les biens **sans photo** (les 8 annonces
   seed ont leurs propres photos) ; l'état vide n'est branché que sur la condition
   `!mainImage && images.length === 0` (exactement le cas du placeholder actuel) → zéro surface
   existante modifiée.
9. **À revérifier** : fiche d'une annonce seed (galerie 5 photos), fiche sans photo (état vide),
   carte de recherche (fallback unique, visuel neutre), `i18n:check`.

### T-268 (claim invité → emailVerified)

1. **Appelants directs** : `POST /api/auth/reset-password` — appelé par la page
   `reinitialiser` (mot de passe oublié, `claimGuest` absent) et par le claim invité
   (`claimGuest: true`). Seule la branche `claimGuest` change.
2. **Indirectement** : aucun autre code n'écrit `emailVerified` dans ce flux ; `resend-verification`
   et `verify` restent intacts.
3. **ViewModel** : n/a.
4. **Écrans** : `/mon-compte` (`ResendVerificationButton` disparaît pour les comptes réclamés —
   c'est l'objectif).
5. **Services** : aucun (aucun e-mail déclenché).
6. **Tests existants** : aucun test ne couvre `reset-password` (vérifié : pas de `route*.test.ts`
   dans `api/auth/reset-password/`) → pas de casse possible.
7. **Nouveaux tests** : `route.t268.test.ts` — token `guest_claim` consommé + mot de passe posé →
   `email_verified = true` en base ; flux historique (sans `claimGuest`) → `email_verified`
   inchangé.
8. **Risques** : le flag est posé **uniquement** quand le token a été livré **et suivi** dans la
   boîte revendiquée (le lien est dans l'e-mail de claim) — c'est la définition même de
   « vérifié ». L'inscription classique n'est pas touchée (elle reste `false` jusqu'au lien).
   La garde « profil invité sans mot de passe » de `POST /api/bookings` est indépendante.
9. **À revérifier** : flux mot de passe oublié complet (token `password_reset`), `/mon-compte`
   après claim, resend de vérification pour un compte non vérifié classique.

### T-269 (colonne `confirmed_at`)

1. **Appelants directs** — `grep -rn "confirmedBy" src` : écrit dans `PUT /api/bookings/[id]`
   (branche confirmed), lue… nulle part en dehors du schéma. La **nouvelle** colonne est écrite au
   même endroit et lue par la timeline (`dashboard/bookings/[id]/page.tsx:114`).
2. **Indirectement** : aucun export CSV/analytique ne lit `confirmed_by` (vérifié par grep) ;
   l'anonymisation T-242 ne touche pas les colonnes de date de réservation.
3. **ViewModel** : n/a.
4. **Écrans** : la timeline de la fiche réservation dashboard (l'étape « confirmée » porte
   désormais la vraie date ; les autres étapes n'ont pas changé).
5. **Services** : le cron `completeEligibleBookings` ne confirme pas (il clôt) — aucune écriture
   de `confirmedAt` ajoutée ; les lignes historiques restent `NULL`.
6. **Tests existants** : `route.t203/t206/t216/t241`, `booking-lifecycle*` — aucun ne verrouille
   l'absence de colonne (Drizzle ne lit que les colonnes du schéma) ; le schema est validé par
   `db:push` (idempotent `ADD COLUMN IF NOT EXISTS`).
7. **Nouveaux tests** : `route.t269.test.ts` — confirmation → `confirmed_at` posée ≈ now ;
   timeline (RSC) : après `markPaidOffline` (update → `updated_at` avancé), l'étape « confirmée »
   porte **toujours** la date de confirmation (régression bloquée).
8. **Risques** : migration **additive** (`ADD COLUMN IF NOT EXISTS` nullable) — aucun default,
   aucune réécriture de table ; le repli `confirmedAt ?? updatedAt ?? createdAt` reproduit
   exactement l'affichage actuel pour les lignes `NULL` (historiques).
9. **À revérifier** : fiche réservation (4 étapes), confirmation manuelle, `DATABASE.md` à jour,
   `db:push` propre, smoke (le seed ne pose pas `confirmed_at` → repli actif).

### T-270 (`/messages` : une requête + fenêtre)

1. **Appelants directs** : `src/app/(main)/messages/page.tsx` seul (page standalone ; le fil
   `messages/[id]` est une page distincte, non modifiée).
2. **Indirectement** : `conversation-visibility.ts` (règle pure, **inchangée** — elle reste le
   filtre JS de garde-fou) ; le compteur de conversations du header badge lit
   `conversations` directement (non concerné).
3. **ViewModel** : n/a.
4. **Écrans** : `/messages` (voyageur **et** hôte quand il visite la page voyageur) — même
   contrat de fenêtre que les 9 autres écrans (T-245/T-257) : 25 par défaut, `+25`, plafond 500,
   bandeau « N sur M », recherche sur la fenêtre affichée.
5. **Services** : aucun (pas d'API dédiée : la page lit la DB en RSC).
6. **Tests existants** : `conversation-visibility.test.ts` (règle pure, inchangée) ;
   `list-window.t257.test.ts` (côté dashboard — non concerné).
7. **Nouveaux tests** : `messages-window.t270.test.ts` (RSC, base réelle) — (a) ≤ 25 fils visibles
   → aucun bandeau ; (b) 26 fils → « 25 résultats affichés sur 26 » + lien « Afficher 25 de
   plus » ; (c) fil vide ancien (> 7 j) masqué (règle T-217/P7 conservée), fil vide récent
   visible ; (d) `?limit=` élargit.
8. **Risques** : la fenêtre borne le **chargement** (pas la donnée) : le tri `lastMessageAt desc`
   et le filtre de visibilité restent les mêmes ; le compteur total est calculé avec **la même
   condition** que la liste (`EXISTS(message) OR created_at > now()-7j` + participant) — le
   bandeau ne peut pas mentir (contrat T-257). Le dernier message reste chargé **en une requête**
   (`inArray` sur les ids de la fenêtre) → le rendu est strictement identique pour ≤ 25 fils.
   La recherche filtre désormais la fenêtre affichée (contrat T-245 des autres écrans).
9. **À revérifier** : `/messages` vide (EmptyState), `/messages/[id]` (fil), badge du header,
   recherche avec résultat, `?limit=25`/`?limit=500`, i18n (clés `list.window.*` existantes).

## §14.5 — Proportionnalité et plan de non-régression

- **Aucun contrat modifié** : transitions (`booking-lifecycle.ts` intact), colonnes existantes,
  contrats de fenêtre, journal wallet T-248 §3, gabarits admin (ajout seulement), API (mêmes
  requêtes/réponses, un `409` de plus sur un cas invalidé).
- **i18n** : +2 clés FR/EN (`bookings.refundManual`, `property.noPhotos`) → verrou
  `ui-strings.test.ts` **1768 → 1770** ; les e-mails passent par `mailStrings` (hors verrou).
- **Ordre des lots** : A (T-265, T-266) → B (T-267, T-268) → C (T-269, T-270) ; chaque lot :
  tests ciblés + typecheck + lint avant commit, chaîne `npm run ci` complète et vérification
  runtime en fin de chantier.
- **Choix documentés (écart d'implémentation par rapport à l'analyse)** :
  - C1 étape 2 : la garde défensive n'est **pas** étendue à `completed`/`no_show` — clôturer un
    séjour déjà passé est une écriture de comptabilité qui ne crée aucun nouveau séjour ; la
    bloquer après une suspension postérieure **empêcherait** l'hôte de solder ses séjours
    (régression workflow). La protection vise ce que l'audit qualifie de risque : un séjour
    **réalisable** sur un bien sanctionné (la confirmation).
  - C2 étape 3 : le badge dashboard hôte est reporté (l'e-mail hôte porte désormais le montant +
    la modalité ; le suivi « à rembourser » structuré reste une décision produit,
    `KNOWN_LIMITATIONS.md`).
  - C1 étape 3 : la notification à la suspension (annuler ou prévenir les demandes pending)
    reste une décision produit (choisir entre les deux change le contrat annulation/frais) —
    documenté dans `KNOWN_LIMITATIONS.md`.
