# 🎯 TÂCHE EN COURS

## Identifiant

- **ID** : T-024 (avec T-025 et suivi audit produit)
- **Titre** : Audit log global + templates emails éditables + suivi audit
- **Niveau** : **S** (2 tâches S enchaînées + 3 écarts mineurs)
- **Ouverte le** : 2026-08-20 (Session 7, finale)
- **Statut** : **CORRIGÉ (VALIDÉ)**

## Contexte

Réponse à la demande utilisateur « continuez jusqu'à ce que tout ce qui
reste soit implémenté et testé avec succès ». Trois chantiers menés
d'une traite en respectant le framework (impact/conception/preuves) :

1. **T-024** — table `audit_log` globale (identifiée dans le rapport
   d'audit §8.1).
2. **T-025** — templates emails éditables (identifié §8.1).
3. **3 écarts mineurs** de l'audit produit corrigés :
   - `helpfulCount` non incrémenté → nouvel endpoint
     `POST /api/reviews/[id]/helpful`.
   - `users.timezone` non exposé en UI → ajouté au `<ProfileForm>`.
   - `properties.commissionRate` non modifiable → autorisé via
     `PUT /api/properties/[id]` (admin only, host reste bloqué).

## Livrables

### T-024 — Audit log global

- Table `audit_log` (`drizzle/0006_audit_log.sql`) : id, actor_id,
  actor_email (copie), action, entity_type, entity_id, metadata jsonb,
  created_at + 2 index.
- `src/lib/audit.ts` : `recordAudit(entry)` best-effort (ne throw
  jamais) + whitelist `AUDIT_ACTIONS`.
- `src/lib/audit.test.ts` : 5 tests unitaires (insertion, actor null,
  fallback si DB down, whitelist).
- Hooks dans 4 handlers : `admin/settings/[key]` (before+after),
  `reviews/[id]/moderate` (from→to), `users/[id]/suspend`
  (suspend/reactivate), `properties/[id]/validate` (validate/reject/suspend).
- Endpoint `GET /api/admin/audit` avec filtres `action`, `since`,
  `limit`, `offset` (admin only, rate-limit 60/min).
- Page `/dashboard/audit` (RSC, tableau chronologique 100 dernières).
- Lien « Journal d'audit » ajouté à la sidebar admin (desktop + mobile).

### T-025 — Templates emails éditables

- Section `emailTemplates` dans `src/lib/settings.ts` (Zod strict +
  DEFAULTS reproduisant l'existant → zéro régression).
- `src/lib/mail/render.ts` : `renderTemplate({name})` +
  `escapeHtml()` anti-XSS.
- `src/lib/mail/render.test.ts` : 10 tests (escape, substitution,
  placeholders inconnus, injection HTML, chaîne vide).
- Refactor `src/lib/mail/templates.ts` : les 4 templates deviennent
  `async`, lisent settings, échappent HTML strictement.
- 3 callers mis à jour (`register`, `forgot-password`, `bookings POST`).
- Section « Templates emails » dans `<SettingsPanel>` : sujet + corps
  éditables par template, liste des variables disponibles.
- Test bonus : injection HTML dans `firstName` → échappée dans le
  HTML final (empêche XSS).

### Écarts audit

- `POST /api/reviews/[id]/helpful` : auth requise, rate-limit 1/24h
  par user+review (approx anti-double-clic).
- `<ProfileForm>` : ajout select fuseau horaire (UTC, Europe/Paris,
  Africa/Douala, Africa/Casablanca, etc.).
- `PUT /api/properties/[id]` : schéma Zod accepte `commissionRate`,
  garde admin-only en tête de handler.

## Preuves (§16)

- 🔍 `REPORTS/analyse_impact_2026-08-20_audit_log.md`.
- 🔍 `REPORTS/analyse_conception_2026-08-20_audit_log.md`.
- 🔍 `REPORTS/analyse_impact_2026-08-20_email_templates.md`.
- 🔍 `REPORTS/analyse_conception_2026-08-20_email_templates.md`.
- 🔨 `npm run typecheck` ✅ 0 erreur.
- 🔨 `npm run build` ✅ succès (nouveaux endpoints listés :
  `/api/admin/audit`, `/api/reviews/[id]/helpful`, `/dashboard/audit`).
- 🔨 `npm run lint` ✅ 0 error (15 warnings cosmétiques préexistants).
- 🧪 `npm test` : **155 passed / 155** (+16 tests : audit ×5, render
  ×10, mail XSS ×1).
- 🧪 `npm run ai:check` : **15 OK · 2 warn attendus · 0 fail**.
- ▶️ Admin PATCH billing → nouvelle ligne
  `action=setting.update entity=setting:billing` visible dans
  `/api/admin/audit` et `/dashboard/audit`.
- ▶️ Admin PATCH review status → 2 nouvelles lignes (hidden puis
  approved). Log complet visible dans le tableau.
- ▶️ Customer sur `/api/admin/audit` → **403**.
- ▶️ PATCH emailTemplates avec subject vide → **400 Zod**.
- ▶️ PATCH emailTemplates `bookingConfirmation.subject`
  `"🎉 Réservation {bookingReference} confirmée"` → POST /api/bookings
  → mail généré contient `Subject: 🎉 Réservation MBB-2026-6A3XN2 confirmée`.
- ▶️ Injection HTML testée : `firstName = "<script>alert(1)</script>"`
  → HTML mail contient `&lt;script&gt;` (échappé), pas `<script>` (test
  automatisé).
- ▶️ `POST /api/reviews/[id]/helpful` : 200 (helpfulCount=1), 2e appel
  → 429, anonyme → 401.
- ▶️ PATCH /api/users/me `{timezone:"Africa/Douala"}` → 200 avec
  `timezone` dans la réponse.
- ▶️ Admin PUT `/api/properties/[id] {commissionRate:"18.00"}` → 200,
  DB reflète 18.00. Host essaie → **403 « Modification de commission
  réservée à l'admin »**.
- ▶️ 14 URL testées (public + dashboard admin) → toutes **200**, zéro
  régression.

## Non-régression

- 139 tests précédents inchangés, +16 nouveaux = **155/155**.
- Signatures publiques inchangées : `getSetting`, `computeCancellation…`,
  `PATCH /api/users/me`, `PUT /api/properties/[id]` (juste étendu).
- DEFAULTS `emailTemplates` reproduisent exactement le sujet historique
  (« Vérifiez votre email — MyBestBooking » etc.).
- Layout HTML des emails inchangé (branding, boutons, tableau récap).

## Étape suivante

Rien de bloquant restant. Backlog V1 non urgent : dark mode, i18n EN,
2FA TOTP, wallet BestRewards utilisable, comparateur, carte
géographique, coverage mesurée, CI GitHub Actions (workflow prêt à
installer manuellement).
