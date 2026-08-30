# Analyse de conception — T-156 (audit n°28, solutions sans régression)

**Date :** 2026-08-30 · **Contrainte :** additif, pas de migration, pas de
changement de contrat API public, cas EUR identiques, fallback FR.

## 1. Annulation par l'hôte (P1)

**Décision.** `cancelBooking(bookingId, reason, actor)` avec
`actor: "customer" | "host" | "admin"` :
- `customer` → **comportement actuel** (grille, frais, emails) ;
- `host`/`admin` → `cancellationFee = 0`, `refundAmount = total`,
  `cancellationReason` forcé serveur (`"Annulée par l'hébergeur"` /
  `"Annulée par l'administrateur"`), emails avec libellé selon l'acteur.

**Alternatives rejetées.**
- Bloquer l'annulation hôte (403) : supprime une capacité opérationnelle
  réelle (défaut d'accueil, double réservation).
- Grille inversée (frais à la charge de l'hôte) : nouveau modèle
  comptable hors périmètre, non demandé.

**Détails.**
- Le `quote` (`GET /cancellation`) : ajouter le cas hôte du bien (et
  admin) → `fee: 0` + `byHost: true` — le UI hôte affiche
  « Remboursement intégral au voyageur ».
- `booking-row-actions` : bouton « Annuler » de la vue hôte → dialogue
  dédié + envoi sans `cancellationReason` client (raison serveur) ;
  la vue voyageur garde son flux (quote, frais, confirmation).
- Emails : `templates.bookingCancellation` gagne un champ `actor`
  optionnel (`host` → « Votre hébergeur a annulé… », aucun frais) —
  champ additif, anciens gabarits inchangés.

## 2. Identité voyageur en mode connecté (P2)

**Décision.** Dans `POST /api/bookings`, si `user` est connecté :
`guestFirstName/LastName/Email/Phone/Country := identité du compte`
(le payload client n'est pas utilisé, y compris si `guestEmail` diffère —
aucune fuite vers un tiers). Le guest mode (`user == null && isGuestBooking`)
garde sa logique actuelle (email libre + garde 409 compte existant).

**Alternative retenue pour l'UI.** Compte connecté → étape 2 « Vos
informations » en lecture seule (mention du compte) ; factorisation
d'une constante `reservation.bookingAs` dans `ui-strings` (fr/en).

**Option métier (hors périmètre défaut).** Case « réserver pour un
proche » : confirmation à l'email du proche + copie au compte — à
arbitrer séparément, sans changer le défaut (identité compte).

## 3. i18n (P2) — vagues

1. **Vague 1 (publique)** : fiche propriété (libellés réservation,
   disponibilités, contact, prix par nuit) + `help-center` (articles
   `{fr,en}`) via `makeT` ; clés ajoutées dans `ui-strings.ts`.
2. Garde-fou CI **warn** : `"use client"` + accents FR sans `makeT`.
3. Vagues suivantes : actions de réservation, calendrier, dashboards
   (suivi par inventaire du rapport : 52 composants).

**Risque nul côté FR** : les clés `fr` reprennent les textes actuels
mot pour mot ; l'EN reste best-effort (fallback fr).

## 4. Devise d'affichage anonyme (P2)

**Décision.** Sélecteur de devise dans le formulaire de recherche
(EUR/USD/GBP/XAF) ; préférence `localStorage` (même mécanisme que la
langue), priorité compte > localStorage > plateforme > locale serveur
(`fr → EUR`, `en → USD` — dernier recours XAF). Le champ caché
`displayCurrency` et la conversion serveur (`priceBoundToStorage`)
restent le contrat — aucun changement d'API.

**Alternatives rejetées.** Modifier `defaultCurrency` (impact global) ;
convertir l'affichage des cartes (déjà dans la devise de la chambre —
conservé).

## 5. P3

- **Hygiène** : `scripts/purge-sim-data.ts` — requêtes ciblées (users
  `@t.local`/`@test.local`, bookings aux prénoms des scenarios, outbox,
  uploads) dans l'ordre FK, `--dry-run` par défaut ; le smoke garde son
  nettoyage réentrant.
- **Settings PATCH** : merge partiel sur la valeur persistée (lecture →
  fusion → validation zod → écriture) ; réponse d'erreur sans `issues`.
- **409→400 capacité** : seulement si l'équipe valide l'alignement ;
  message inchangé, un test mis à jour.
