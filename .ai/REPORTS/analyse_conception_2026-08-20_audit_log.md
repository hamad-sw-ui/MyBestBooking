# 🧠 Conception — T-024 Audit log global

- **Date** : 2026-08-20 (Session 7, suite)
- **Auteur** : Arena Agent Mode
- **Statut** : conception validée avant implémentation

## Problème

Voir `analyse_impact_2026-08-20_audit_log.md`. Traçabilité éclatée
entre `console.info` (perdus au restart), `updated_by` sur
`app_settings`, aucun log formel sur suspend/validate/moderate.

## Options considérées

### Option A — table `audit_log` centrale — **retenue**

- ➕ requêtable (SQL / dashboard), triable, filtrable.
- ➕ conservée à travers les restarts.
- ➕ un seul point d'écriture (`recordAudit`) → grep facile.

### Option B — service externe (Datadog, Papertrail)

- ➖ dépendance externe, credentials à gérer.
- ➖ pas requêtable par l'admin end-user.

### Option C — fichier `.log` local

- ➖ perdu au redéploiement Vercel/serverless.

Choix : **Option A**.

## Architecture retenue

```
Handler admin (setSetting, moderate, suspend, validate)
        │
        │ après succès de la mutation métier
        ▼
recordAudit({ actorId, action, entityType, entityId, metadata? })
        │
        │ best-effort : try/catch, log stderr si échec
        ▼
INSERT INTO audit_log (...)
        │
        ▼
GET /api/admin/audit (admin only, pagination)
        │
        ▼
/dashboard/audit (RSC + liste chronologique + filtre par action)
```

### Schéma `audit_log`

```sql
CREATE TABLE audit_log (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id     uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_email  varchar(255),          -- copie pour survie même si user supprimé
  action       varchar(64) NOT NULL,  -- 'setting.update', 'review.moderate', 'user.suspend', 'property.validate'
  entity_type  varchar(32),           -- 'setting' | 'review' | 'user' | 'property'
  entity_id    varchar(64),           -- id de la ressource, string pour souplesse
  metadata     jsonb,                 -- { before?, after?, reason?, key? }
  created_at   timestamp NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_log_created ON audit_log (created_at DESC);
CREATE INDEX idx_audit_log_action  ON audit_log (action, created_at DESC);
```

### API `recordAudit`

```ts
export interface AuditEntry {
  actorId: string | null;
  actorEmail?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown> | null;
}
export async function recordAudit(entry: AuditEntry): Promise<void>;
```

Best-effort : ne throw jamais, `console.error` en cas d'échec.

## Plan de migration

1. Schéma + migration 0006.
2. `src/lib/audit.ts` + tests.
3. Hook dans les 4 sites (settings, moderate, suspend, validate).
4. Endpoint `/api/admin/audit`.
5. Page `/dashboard/audit`.
6. Lien sidebar admin.
7. Tests + manuel ▶️.
8. Docs.

## Débat multi-rôles §15.2

Non requis (niveau S, consensus rôles).
