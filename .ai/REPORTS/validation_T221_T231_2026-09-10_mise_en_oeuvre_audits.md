# Validation — T-221 → T-231 (audit n°2) et T-242 → T-244 (audit n°4)

- **Date** : 2026-09-10
- **Statut** : **CORRIGÉ (VALIDÉ)** — quatorze constats implémentés, testés et vérifiés au runtime.
- **Nature** : mise en œuvre des remarques d'analyse, **sans régression et sans casse de
  l'existant** (contrainte explicite de l'utilisateur).
- **Analyses sources** : `docs/analyse_2026-09-10_audit_runtime_inacheves.md` (A1→A11),
  `docs/analyse_2026-09-10_audit_runtime_profondeur.md` (N1→N3).
- **Rapports de tâche** : `REPORTS/analyse_impact_T-221_2026-09-10_mise_en_oeuvre_audits.md`,
  `REPORTS/analyse_conception_T-221_2026-09-10_mise_en_oeuvre_audits.md`.

## 1. Portes exécutées

| Porte | Commande | Résultat |
|---|---|---|
| Types | `npm run typecheck` | **0 erreur** |
| Lint | `npm run lint` (`--max-warnings 0`) | **0 erreur / 0 warning** |
| i18n | `npm run i18n:check` | **0 candidat** — catalogue FR/EN **1640** clés (verrou de test aligné) |
| Framework | `npm run ai:check` | **19 OK / 1 warn / 0 fail** — warn = R7 (voir §5) |
| Tests | `npx vitest run` | **691 tests / 117 fichiers — 0 échec** (+39 depuis 652) |
| CI complète | `npm run ci` | **verte** : typecheck → lint → i18n → ai:check → vitest → build → smoke |
| Smoke HTTP | inclus dans `npm run ci` | **95 / 95 assertions PASS, 0 FAIL** (login 3 rôles, RBAC, parcours réservation, pages par rôle) |

## 2. Vérifications runtime (serveur réel, port 3000)

### A11 / T-231 — codes de secours 2FA (parcours complet)

1. `POST /api/auth/register` → `200`.
2. `POST /api/auth/2fa/setup` (mot de passe) → `200 {secret}`.
3. `POST /api/auth/2fa/verify` (code TOTP calculé sur le secret) → `200 {enabled:true, backupCodes: 10}`.
4. `POST /api/auth/login` avec le **code de secours n°1** → `200` (connexion réussie).
5. Rejeu du **même** code → `401 {"error":"Ce code de secours a déjà été utilisé"}`.
6. `POST /api/auth/login` avec le **code n°2** → `200` ; code inconnu `ZZZZZ-ZZZZZ` → `401`.
7. `POST /api/auth/2fa/disable` avec un **code de secours** → `200 {enabled:false}`.
8. Contrôle en base : `two_factor_enabled=false`, `two_factor_secret` et
   `two_factor_backup_codes` **purgés**.
9. `POST /api/users/[id]/two-factor/reset` (admin) : purge + révocation de sessions +
   `audit_log.action = "user.2fa.reset"` (couvert par test d'intégration, 5/5).

### A10 / T-230 — suspension distincte de la suppression

1. `PATCH /api/users/[id]/suspend {suspended:true, reason}` → `200` ; en base
   `suspended_at` posé, `suspended_reason` = motif, **`deleted_at` reste NULL**, sessions révoquées.
2. `POST /api/auth/login` du compte suspendu → `401` avec le **motif** : « Ce compte est suspendu :
   Vérification runtime. Contactez le support. »
3. `PATCH … {suspended:false}` → `200` ; `suspended_at` remis à NULL, connexion à nouveau `200`.
4. Compte anonymisé (`DELETE /api/users/me`) : réactivation → **`409`** « compte supprimé
   (anonymisé) : non réactivable » ; suspension → **`409`** ; `deleted_at` intact.

### A7 / A8 — horaires, fuseau, labels

| Sonde | Résultat |
|---|---|
| `PATCH /api/users/me {timezone:"Europe/Paris"}` | `200` |
| `PATCH /api/users/me {timezone:"Mars/Olympus"}` | `400` « Fuseau horaire inconnu » |
| `PUT /api/properties/[id] {checkInFrom:"15:30", checkInUntil:"22:00", checkOutUntil:"10:30", timezone:"America/New_York"}` | `200`, valeurs persistées en base |
| `PUT` `{checkInFrom:"25:99"}` | `400` « Heure d'arrivée (début) invalide (HH:MM) » |
| `PUT` `{timezone:"Not/AZone"}` | `400` |
| `PUT` `{checkInFrom:"23:00"}` alors que la fin persistée est 23:00 | `400` « La fenêtre d'arrivée est vide… » (état résultant), valeur non écrite |
| `PUT` `{checkInUntil:"02:00"}` (fenêtre à cheval sur minuit) | `200` (accepté, pratique hôtelière) |
| `PUT` `{isEcoCertified:true}` par l'hôte | `403` « Modification des labels réservée à l'administration » |
| `PUT` `{isBestrewards:true}` par l'admin | `200`, label écrit |
| `POST /api/properties` par l'hôte avec `isPreferred:true` | `403`, **aucune annonce créée** |
| `POST /api/properties` horaires/fuseau valides | `201`, valeurs renvoyées |

### T-243 — purge technique

- Cron `GET /api/cron/price-alerts` appelé : réponse enrichie de `technicalPurge`
  (`sessionsPurged`, `emailsPurged`, `auditRows`, `oldestAuditAt`).
- Vérifié par test (2/2) : sessions expirées > 7 j supprimées, sessions récentes conservées,
  outbox `sent`/`failed` > 90 j purgée, `pending`/`sending` **jamais** touchés, idempotence.

### T-244 — stock vendable

- `GET /api/rooms/[id]/availability` renvoie `bookedCounts` (additif) : chambre témoin
  `58cfcf65…` (quantité 3, séjour 24→27/09/2026) → `23/09:0 · 24/09:1 · 25/09:1 · 26/09:1`.
- Page `/dashboard/rooms/[id]/calendrier` : `200`, trois occurrences de « reste 2 (1 réservé) »
  (`data-testid="remaining-<date>"`).

### T-242 — anonymisation

- Test d'intégration 3/3 : **0 occurrence** de l'adresse d'origine dans `users`, `bookings.guest_*`,
  `email_outbox.to`, `audit_log.metadata.targetEmail` ; agrégats comptables du séjour intacts
  (référence, dates, 220,00 €, commission 33,00 €, statut) ; compte tiers non touché ; idempotence.

## 3. Non-régression

- Aucune route supprimée, aucun contrat retiré : les évolutions sont **additives** (champs
  supplémentaires, colonnes nullable) ou des **refus explicites** sur des entrées qui étaient
  silencieusement acceptées à tort (`400`/`403`/`409`).
- Les règles d'affichage n'ont pas d'autorité métier : le tunnel de réservation reste seul juge du
  stock, `deleted_at`/`suspended_at` seuls juges de l'état du compte.
- i18n paritaire FR/EN (verrou de test 1640) ; smoke HTTP 95/95 en place.
- Base remise à l'état seed (8 users / 8 properties / 31 bookings / 22 avis) après chaque campagne ;
  comptes et objets de test supprimés (`verification_tokens`, `sessions`, `email_outbox` inclus).

## 4. Incidents rencontrés et corrigés pendant le chantier

1. **Bundle client / `pg`** : `availability-calendar.tsx` importait `room-stock.ts` (qui lie
   `@/db`) → « Can't resolve 'dns' », page calendrier `500`. Corrigé en isolant la règle pure dans
   `room-stock-rules.ts`.
2. **Rate-limiter** : les campagnes de sondes ont atteint la limite de connexions (429) ; le serveur
   de développement a été redémarré pour repartir d'un compteur vierge (limiteur en mémoire).
3. **Insertions i18n** : deux virgules manquantes détectées par `tsc` immédiatement après une
   insertion de bloc (corrigées dans la même passe).

## 5. Point framework

`ai:check` laisse **un warning R7** (`STATE.md` ne référence pas HEAD). La règle compare le contenu
du fichier de travail au SHA du commit courant : un commit qui met à jour `STATE.md` ne peut pas
citer son propre SHA. Le fichier porte donc la mention « à mettre à jour en fin de session », motif
explicitement toléré par la règle (warn, jamais fail). Toutes les autres règles sont vertes.
