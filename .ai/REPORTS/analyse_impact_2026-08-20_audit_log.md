# 📊 Analyse d'impact — T-024 Audit log global

- **Date** : 2026-08-20 (Session 7, suite)
- **Tâche** : T-024 — Table `audit_log` globale
- **Niveau** : **S** (nouvelle table additive, nouvel endpoint admin,
  helper serveur, hooks dans handlers existants sans changement de
  contrat)
- **Auteur** : Arena Agent Mode

## §14 — 9 questions obligatoires

### 1. Quoi

Remplacer les `console.info("[settings] ...")` et `[reviews] ...`
locaux — qui disparaissent avec les logs plate-forme — par une **table
`audit_log`** persistée. Chaque action admin sensible (settings,
modération avis, suspend user, validation property) écrit une ligne
`{actorId, action, entityType, entityId, before?, after?, at}`.

Nouvel écran `/dashboard/audit` (admin only) qui affiche le journal
paginé.

### 2. Où

Nouveaux fichiers :

- `src/db/schema.ts` — table `auditLog`.
- `drizzle/0006_audit_log.sql` — migration additive.
- `src/lib/audit.ts` — `recordAudit(entry)` helper (best-effort, ne
  fait jamais échouer l'action métier).
- `src/lib/audit.test.ts` — 5 tests unitaires (types acceptés,
  fallback silent).
- `src/app/api/admin/audit/route.ts` — `GET` paginé admin only.
- `src/app/dashboard/audit/page.tsx` — RSC, liste chronologique.
- `.ai/REPORTS/analyse_impact_2026-08-20_audit_log.md`.
- `.ai/REPORTS/analyse_conception_2026-08-20_audit_log.md`.

Modifiés :

- `src/lib/settings.ts` — `setSetting` appelle `recordAudit`.
- `src/app/api/reviews/[id]/moderate/route.ts` — `recordAudit` après
  update.
- `src/app/api/users/[id]/suspend/route.ts` — `recordAudit`.
- `src/app/api/properties/[id]/validate/route.ts` — `recordAudit`.
- `src/components/layout/dashboard-sidebar.tsx` — lien « Audit »
  (admin only).

### 3. Pourquoi

- Rapport `audit_produit_2026-08-20_session_7.md` §8.1 identifie ce
  besoin dès qu'il y a plus d'un admin.
- Écrit dans le rapport de conception T-021 (« À suivre » ADR-007) :
  la traçabilité `updated_by` sur `app_settings` est insuffisante
  pour d'autres catégories.
- Obligation de traçabilité DSA/GDPR : chaque modération d'avis, chaque
  suspension d'utilisateur doit être auditable.

### 4. Appelants

`grep -rn "console.info\|console.log" src/lib src/app/api | grep -iE "admin\|settings\|reviews\|suspend\|validate"` :

- `src/lib/settings.ts:setSetting` — écrit `console.info`.
- `src/app/api/admin/settings/[key]/route.ts` — `console.info`.
- `src/app/api/reviews/[id]/moderate/route.ts` — `console.info`.
- `src/app/api/users/[id]/suspend/route.ts` — pas de log actuel.
- `src/app/api/properties/[id]/validate/route.ts` — pas de log actuel.

Aucun autre caller externe. `recordAudit` est nouveau, personne ne
l'appelle encore hors des 4 sites ajoutés.

### 5. Contrat public

- Nouvelle table `audit_log` — additive.
- Nouvel endpoint `GET /api/admin/audit` — additif.
- Nouvelle page `/dashboard/audit` — additive.
- Aucun endpoint existant ne change sa signature ou son statut.
- `recordAudit` est **best-effort** : si l'insertion DB échoue, le
  handler métier n'échoue pas (fallback log stderr).

### 6. Migration

- `drizzle/0006_audit_log.sql` : CREATE TABLE simple.
- Pas de backfill (les logs historiques restent dans les journaux
  plate-forme).
- Rollback : `DROP TABLE audit_log;` — sans impact sur les autres
  tables.

### 7. Sécurité

- Écriture : **serveur uniquement**, via `recordAudit` — jamais
  exposé côté client.
- Lecture : `/api/admin/audit` gardé par `role='admin'` (403 sinon).
- Aucune PII sensible stockée : uniquement `userId` (déjà en table
  users), `entityType`, `entityId`, `action`, `metadata` JSONB
  optionnel (limité à des champs métier non secrets).
- Aucun mot de passe, aucun token, aucun secret ne transite dans
  `metadata`.
- Rate-limit sur `/api/admin/audit` : 60/min (lecture).
- FK `actor_id → users(id) ON DELETE SET NULL` : conserver
  l'historique même si le compte admin est supprimé.

### 8. Test

Unitaires (`src/lib/audit.test.ts`) :

- `recordAudit` avec métadonnées → row insérée.
- Insertion échoue (DB coupée simulée) → ne throw pas, log stderr.
- Types acceptés : action, entityType, entityId, actorId nullable.

Manuel ▶️ :

1. Admin change TVA à 20 % → 1 nouvelle ligne
   `action='setting.update' entityType='setting' entityId='billing'`.
2. Admin masque un avis → ligne `action='review.moderate'`.
3. Admin suspend user → ligne `action='user.suspend'`.
4. Admin valide property → ligne `action='property.validate'`.
5. `/dashboard/audit` liste les 4 dernières lignes, ordre desc.
6. Customer → 403 sur `/api/admin/audit`.

### 9. Rollback

- `git revert` du commit → les hooks disparaissent, la table peut
  rester (additive) ou être droppée. Aucun impact fonctionnel.
- Chaque hook est indépendant : rollback partiel possible.
