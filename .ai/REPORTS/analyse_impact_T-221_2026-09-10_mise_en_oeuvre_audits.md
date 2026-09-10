# Analyse d'impact — T-221 → T-231 (audit n°2) + T-242 → T-244 (audit n°4)

- **Date** : 2026-09-10
- **Niveau** : **C (critique)** — données personnelles persistées, authentification (2FA),
  suspension de comptes, agrégats comptables.
- **Entrées** : `docs/analyse_2026-09-10_audit_runtime_inacheves.md` (constats A1→A11),
  `docs/analyse_2026-09-10_audit_runtime_profondeur.md` (constats N1→N3).
- **Nature** : mise en œuvre des remarques d'audit, **sans régression** — aucune fonctionnalité
  existante retirée, aucun contrat HTTP cassé (les ajouts sont additifs ou des refus explicites
  sur des cas qui étaient acceptés à tort).

## 1. Périmètre modifié

| Surface | Fichiers | Nature du changement |
|---|---|---|
| Schéma & migration | `src/db/schema.ts`, `drizzle/0021_user_suspension_and_backup_codes.sql`, `drizzle/meta/_journal.json` | Additif : `users.suspended_at`, `users.suspended_reason`, `users.two_factor_backup_codes`. Migration des suspensions existantes (`deleted_at` sans anonymisation → `suspended_at`). |
| Authentification | `api/auth/login`, `api/auth/2fa/{setup,verify,disable}`, `src/lib/backup-codes.ts`, `components/two-factor-section.tsx` | Codes de secours hachés à usage unique, acceptés à la connexion **et** à la désactivation ; messages suspension / suppression distincts. |
| Cycle de vie des comptes | `api/users/me` (DELETE), `api/users/[id]/suspend`, `api/users/[id]/two-factor/reset`, `api/admin/bulk`, `lib/account-anonymization.ts`, `components/admin/user-suspend-actions.tsx`, `components/bulk/users-manager.tsx`, `app/dashboard/users/page.tsx` | Suspension ≠ suppression ; anonymisation transactionnelle complète ; reset 2FA support tracé. |
| Hébergements | `api/properties` (**POST et PUT**), `api/properties/[id]`, `lib/timezone.ts`, `app/dashboard/properties/[id]/property-edit-client.tsx` | Horaires `HH:MM` + fuseau IANA validés, fenêtre d'arrivée non vide (état résultant), labels réservés à l'admin. |
| Réservations & stock | `api/rooms/[id]/availability`, `lib/room-stock.ts`, `lib/room-stock-rules.ts`, `components/availability-calendar.tsx`, `app/dashboard/rooms/[id]/calendrier/page.tsx` | Champ additif `bookedCounts` + colonne « Reste vendable ». Le tunnel reste l'autorité. |
| Rétention technique | `lib/technical-retention.ts`, `api/cron/price-alerts` | Purge : sessions expirées > 7 j, outbox `sent|failed` > 90 j. Mesure d'audit seulement. |
| Notifications & réglages | `lib/review-notifications.ts`, `api/reviews{,/[id]/moderate}`, `components/admin/settings-panel.tsx`, `lib/mail/templates.ts` | E-mails d'avis (publication/modération), interrupteurs de notifications, gabarit `twoFactorReset`. |
| Divers (A1/A2/A6/A9) | `dashboard/page.tsx`, `dashboard/bookings{,/[id]}/page.tsx`, `components/bulk/bookings-manager.tsx`, `components/booking-row-actions.tsx`, `components/room-edit-section.tsx` | Échéance de demande, filtre « Règlement », édition complète de chambre, libellé du fil par acteur. |
| i18n | `src/lib/ui-strings.ts` (+ `ui-strings.test.ts`) | +19 (T-221/222) · +22 (T-223/224) · +16 (A6) · +2 (T-244) · +1 (A9) · +11 (A7/A8) · +9 (A10/A11) = **1640 clés** FR/EN, verrou de test mis à jour. |

## 2. Ce qui pouvait casser, et pourquoi ça n'a pas cassé

1. **Facture et exports lisent `bookings.guest_*`** → l'anonymisation (T-242) réécrit uniquement les
   champs d'identité ; référence, dates, montants, devise, commission et statut sont intacts
   (vérifié par test : agrégats à 220,00 € / commission 33,00 € inchangés après suppression).
2. **Le 2FA est une porte d'entrée** → l'ajout des codes de secours **élargit** les voies de
   connexion ; il ne retire ni ne contourne le TOTP. Un code est à usage unique (marqué consommé
   dans la même requête) et stocké **haché** ; un code réutilisé est refusé explicitement.
3. **La suspension est utilisée par le back-office et le bulk** → les deux chemins écrivent
   désormais `suspended_at` ; la sémantique de `deleted_at` (suppression) reste celle de
   l'anonymisation. La migration rattache les suspensions existantes pour que l'UI admin ne change
   pas de sens après déploiement.
4. **Les colonnes `time` et `varchar` d'horaires pouvaient recevoir du texte libre** → la validation
   est ajoutée **en entrée** (POST/PUT), jamais en lecture : aucune donnée existante n'est rendue
   invalide, et les valeurs de repli (14:00 / 23:00 / 11:00) restent servies telles quelles.
5. **La lecture du calendrier ne doit pas embarquer `pg` côté client** (incident rencontré et
   corrigé pendant le chantier) → la règle de stock est isolée dans `room-stock-rules.ts`
   (module pur, sans `@/db`), `room-stock.ts` restant serveur.
6. **Le refus 403 sur un champ ignoré jusqu'ici** → un hôte qui envoyait un label recevait `200`
   sans écriture : le passage à `403` rend le refus visible sans casser d'appelant légitime (aucun
   écran hôte n'envoie ces champs).

## 3. Effets de bord assumés

- `GET /api/users/[id]/suspend`-like payloads renvoient deux champs supplémentaires
  (`suspendedAt`, `suspendedReason`) : additif, les clients tolèrent l'inconnu.
- `PATCH /api/users/[id]/suspend` réagit différemment sur un compte **anonymisé** : `200` avant
  (réactivation d'une coquille), `409` désormais. C'est le correctif même du constat A10.
- `POST /api/auth/2fa/verify` renvoie `backupCodes` : un client qui ignore ce champ fonctionne
  toujours (la 2FA est activée dans les deux cas).
- Le cron renvoie `technicalPurge` en plus : additif dans un JSON déjà tolérant.

## 4. Risques résiduels

| Risque | Gravité | Traitement |
|---|---|---|
| Un utilisateur perd codes de secours **et** téléphone | Moyenne | Reset support `POST /api/users/[id]/two-factor/reset` (tracé, sessions révoquées, e-mail d'information). |
| `audit_log` n'est pas purgé (croissance) | Faible | Mesure `auditRows`/`oldestAuditAt` dans le cron ; décision de rétention laissée explicite (CNIL/obligations comptables). |
| Fenêtre d'arrivée à cheval sur minuit | Faible | Acceptée volontairement (pratique hôtelière) ; seule la fenêtre vide est refusée. |
| Suppression d'un compte puis demande de restauration | Faible | `409` explicite + message « Restaurez une sauvegarde si nécessaire ». |

## 5. Preuves attendues (porte de sortie)

- `npm run typecheck` 0 · `npm run lint` 0 · `npm run i18n:check` 0 · **vitest 691 tests**.
- `npm run ci` verte (inclut build + smoke HTTP) ; `npm run ai:check`.
- Vérifications runtime sur serveur réel : parcours 2FA complet (activation → connexion par code de
  secours → non-réutilisation → désactivation), suspension/réactivation/`409`, horaires et fuseau
  persistés, labels `403` hôte / `200` admin, calendrier « reste 2 (1 réservé) ».
- Base remise à l'état seed (8 users / 8 properties / 31 bookings / 22 avis), sondes supprimées.
