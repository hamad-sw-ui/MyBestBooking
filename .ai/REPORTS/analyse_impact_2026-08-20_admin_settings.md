# 📊 Analyse d'impact — T-021 Panel d'administration configurable

- **Date** : 2026-08-20 (Session 7)
- **Tâche** : T-021 — Panel d'administration configurable
- **Niveau** : **S** (nouvelle table, nouveaux endpoints, refactor safe des
  callers, aucun changement de contrat public existant)
- **Auteur** : Arena Agent Mode

## §14 — 9 questions obligatoires

### 1. Quoi

Introduire un **panneau d'administration configurable** qui permet à un
utilisateur `role='admin'` de modifier — sans redéploiement — les réglages
runtime jusqu'ici codés en dur ou uniquement au seed :

- Général : nom du site, email support, email partenaires, devise défaut,
  langue défaut.
- Fiscalité : taux de TVA appliqué au subtotal des bookings (aujourd'hui
  `0.10` en dur dans `POST /api/bookings`).
- Commissions : taux global par défaut, éventuellement grille par type de
  property (garde-fou : les valeurs de `properties.commissionRate` déjà en
  DB restent prioritaires par property, la settings ne s'applique qu'aux
  nouvelles propriétés sans valeur explicite).
- BestRewards : seuils de niveaux (aujourd'hui `5` et `15` en dur dans
  `POST /api/bookings`) et libellés.
- Grille d'annulation : pourcentages par politique × jours (aujourd'hui en
  dur dans `src/lib/cancellation.ts`).
- Notifications : activer/désactiver chaque type d'email.
- Sécurité : force minimale des mots de passe (déjà validée dans schema
  Zod register/change-password, réutilisée), durée session, mode
  maintenance.
- Providers : *lecture seule* — affiche l'état (configuré ou non) de
  Stripe, Resend, S3 sans révéler les clés.

Corollaire (dans la même tâche, endpoints déjà livrés) : ajouter le bouton
**Suspendre / Réactiver** dans `/dashboard/users` (endpoint
`PATCH /api/users/[id]/suspend` existe depuis T-016 mais l'UI est
manquante).

### 2. Où

Nouveaux fichiers :

- `src/db/schema.ts` — ajout de `appSettings` (key TEXT PK, value JSONB,
  updatedAt, updatedBy).
- `drizzle/0005_app_settings.sql` — migration.
- `src/lib/settings.ts` — module `getSetting` / `setSetting` / `DEFAULTS`
  avec cache en mémoire par process (invalidé après `setSetting`).
- `src/lib/settings.test.ts` — tests unitaires (merge des defaults,
  invalidation cache, validation Zod des payloads).
- `src/app/api/admin/settings/route.ts` — `GET` liste (masquant les
  secrets) + `PATCH` par clé (admin only, log dans `console.info`).
- `src/components/admin/settings-section.tsx` — composant client
  générique (formulaire JSON schema-driven).
- `src/components/admin/user-suspend-actions.tsx` — bouton client
  suspend/réactiver.
- `.ai/REPORTS/analyse_impact_2026-08-20_admin_settings.md` — ce
  document.
- `.ai/REPORTS/analyse_conception_2026-08-20_admin_settings.md` — §15.1.
- `.ai/ADR/ADR-007_admin_settings.md` — décision d'introduire une table
  `app_settings` versus fichier JSON versus env vars.

Fichiers modifiés :

- `src/app/api/bookings/route.ts` — remplacer les constantes en dur
  (`0.10`, `5`, `15`) par des lectures de settings avec **fallback aux
  valeurs actuelles** si settings absents.
- `src/lib/cancellation.ts` — accepter une grille optionnelle en
  paramètre ; l'API existante `computeCancellationFee(policy, total, days)`
  garde sa signature et sa sémantique → **zéro régression tests**.
- `src/app/api/bookings/[id]/route.ts` — passer la grille depuis settings
  au calcul de `cancellationFee` (défaut = valeurs actuelles).
- `src/app/dashboard/settings/page.tsx` — refactor : nouvelle UI branchée.
- `src/app/dashboard/users/page.tsx` — ajouter la colonne actions +
  composant client suspend.

### 3. Pourquoi

Réponse à la question utilisateur : *« est-ce qu'il y a une page pour les
configurations du côté admin qui empêche de passer par le code ? »* La
réponse actuelle est **non**. Toute modification de TVA, seuil
BestRewards ou grille d'annulation exige aujourd'hui une PR + rebuild +
redéploiement. Cette tâche livre l'écran de contrôle attendu.

Valeur ajoutée mesurable :

- Réduit le time-to-change d'un paramètre commercial de « 1 PR » à
  « 1 clic admin ».
- Élimine 3 constantes magiques (`0.10`, `5`, `15`) au profit de valeurs
  documentées et auditables.
- Couvre le bouton *Suspendre* qui manquait à l'UI users (endpoint T-016).

### 4. Appelants

`grep -rn` des points modifiés :

- `subtotal \* 0\.1` : 1 occurrence, `src/app/api/bookings/route.ts:162`.
- `bestrewards` seuils `5` / `15` : `src/app/api/bookings/route.ts:308`.
- `computeCancellationFee(` : appelée dans
  `src/app/api/bookings/[id]/route.ts` (1 site) et par les tests
  `src/lib/cancellation.test.ts` (10 assertions).
- `daysUntil` (utilitaire de cancellation) : idem.
- `PATCH /api/users/[id]/suspend` : appelé nulle part côté UI aujourd'hui
  (endpoint dormant depuis T-016).

### 5. Contrat public

- **Nouvelle** table `app_settings` — additive, ne casse rien.
- **Nouveaux** endpoints `/api/admin/settings` (GET/PATCH) — additifs.
- `computeCancellationFee(policy, total, days)` garde sa signature et
  ses valeurs par défaut → aucun test existant n'échoue. Une nouvelle
  fonction `computeCancellationFeeWithGrid(policy, total, days, grid)`
  est exposée pour les callers qui veulent piloter par settings.
- `POST /api/bookings` : la réponse ne change pas, seule la source des
  constantes change (avec le même résultat par défaut).

### 6. Migration

- Migration Drizzle `0005_app_settings.sql` créée et appliquée via
  `npm run db:push` (dev) ou `drizzle-kit migrate` (prod).
- Aucun backfill nécessaire : quand `getSetting(k)` ne trouve pas la
  clé, il retourne la valeur `DEFAULTS[k]` qui reproduit **exactement**
  le comportement actuel (0.10 TVA, [5,15] BestRewards, grille
  cancellation identique).
- Aucune rotation de secret, aucune invalidation de cache utilisateur.

### 7. Sécurité

- Toutes les routes `/api/admin/settings` exigent `getCurrentUser()` +
  `role === 'admin'` (403 sinon). Pattern déjà utilisé par les autres
  endpoints admin (`/api/users/[id]/suspend`, `/api/properties/[id]/validate`).
- **Aucun secret** exposé : les settings de type « provider » (Stripe,
  Resend, S3) sont *read-only via env vars* et l'endpoint renvoie
  uniquement `{configured: true|false}` — jamais la clé.
- Payload PATCH validé par Zod : whitelist stricte des clés autorisées,
  chaque valeur validée contre son schéma (bornes numériques, longueurs).
- Log de modification : `console.info("[settings] admin=%s key=%s
  value=%o", user.email, key, value)` — traçable dans les logs Vercel /
  systemd. Pas de PII sensible dans les valeurs.
- Rate-limit admin léger (`admin:settings:${user.id}` : 30/min).
- Le mode maintenance, s'il est activé, ne doit **pas** bloquer les
  routes `/api/admin/*` (sinon l'admin s'exclut lui-même) — condition
  explicite dans le middleware (à ajouter avec le mode maintenance,
  point reporté au backlog car hors périmètre S de cette tâche).

### 8. Test

- Unitaire `src/lib/settings.test.ts` :
  - `getSetting('billing.taxRate')` sans row en DB → renvoie 0.10.
  - `setSetting` puis `getSetting` → nouvelle valeur.
  - Invalidation cache après `setSetting`.
  - Zod refuse une TVA négative ou > 1.
- Unitaire `src/lib/cancellation.test.ts` inchangés (assurance de
  non-régression sur la grille par défaut).
- Nouveau `computeCancellationFeeWithGrid` : 4 assertions (grille
  personnalisée écrase les défauts, fallback si `null`).
- Manuel ▶️ :
  1. Login `admin@mybestbooking.com`, `/dashboard/settings`, changer
     TVA de 10 % à 20 %, valider.
  2. Créer une réservation → `taxes` du body reflète 20 %.
  3. Restaurer 10 %, refaire une réservation → 10 %.
  4. Cliquer *Suspendre* sur un utilisateur customer → il ne peut plus
     se connecter (401 login).
  5. Cliquer *Réactiver* → connexion OK.

### 9. Rollback

- **Front-end** : simple `git revert` du commit — la page redevient
  présentationnelle.
- **API** : `git revert` — les endpoints disparaissent. Aucun caller
  externe.
- **Schéma** : la table `app_settings` est additive et peut rester en
  place sans dommage. Rollback complet possible via
  `DROP TABLE app_settings;` si vraiment nécessaire.
- **Callers refactorés** : tous les nouveaux appels `getSetting(k)` sont
  compatibles descendants (renvoient les defaults = valeurs actuelles).
  Un rollback partiel du seul refactor de `src/app/api/bookings/route.ts`
  suffit à revenir au comportement d'origine sans toucher au reste.
