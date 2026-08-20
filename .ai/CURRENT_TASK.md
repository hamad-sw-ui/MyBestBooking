# 🎯 TÂCHE EN COURS

## Identifiant

- **ID** : T-015 (dernière de la Session 5) — clôture de session
- **Titre** : Clôture Session 5 après T-011 → T-015
- **Niveau** : **S** (§15.0-bis maintenance / mise à jour docs)
- **Ouverte le** : 2026-08-20 (Session 5, phase finale)

## Contexte

Session 5 a livré 5 tâches majeures qui ont doublé la couverture
✅ de FEATURES.md (28 % → ~48 %) et ont mécanisé la détection
des manques via R14-R17. Ce commit consolide.

## Livrables consolidés

### T-011 — Framework v1.1.0 (C, §15.0-bis)
Nouveau scope « complétude produit ». ADR-006, FEATURES.md,
PRODUCT_ACCEPTANCE.md, R14-R17, tag 🎯 PROMISED, Playwright installé,
BACKLOG réécrit. **17 règles automatisées** (vs 13 avant).

### T-012 — Disponibilité + chevauchement (S)
Transaction Drizzle avec SELECT FOR UPDATE dans POST /api/bookings.
Retourne 409 si `room.quantity` saturé sur les dates. Migration
0002 avec index dédié. hasOverlap() pur + 7 tests unitaires + 4
tests intégration DB.

### T-013 — Emails transactionnels (S)
Interface Mailer + 2 adaptateurs (ConsoleMailer dev, ResendMailer
prod). 4 templates HTML+text. Tokens SHA-256 hashés (24h/1h). 3
endpoints /api/auth/{verify,forgot-password,reset-password}. 3
pages front. Câblés dans register + booking. Migration 0003.
Rate-limits + anti-énumération. 12 nouveaux tests.

### T-014 — Uploads d'images (S)
Interface Uploader + LocalUploader (public/uploads/) + S3Uploader
(signature v4 manuelle sans SDK, compat R2/S3/DO/MinIO).
POST /api/uploads (multipart, MIME whitelist, 5MB, rate-limit 20/h).
Composant `<ImageUploader>` client. 5 nouveaux tests.

### T-015 — 6 endpoints mutations (S)
POST /api/conversations, GET+POST /api/messages,
POST /api/reviews/[id]/reply, POST /api/properties/[id]/validate,
GET /api/wishlists/shared/[token], GET/POST /api/promotions,
PATCH/DELETE /api/promotions/[id]. R14 : 5 tables sans endpoint
→ 3 restantes (2 pour T-018 calendrier, 1 acceptable).

## Statut

**CORRIGÉ (INSPECTION)** — 5 tâches vagues 1+2 livrées et testées.
Passage à VALIDÉ après validation responsable.

## Métrique produit

- FEATURES.md ✅ : 28 % → **~48 %**
- Bugs applicatifs ouverts : 0 (BUG-003 paiement dans
  KNOWN_LIMITATIONS)
- Tests automatisés : 43 → **71** (+65 %)
- Migrations Drizzle versionnées : 1 → 3
- Framework : 13 règles → 17 règles

## Prochaine session

- **T-016** (S) : UI qui branche les endpoints T-015 (formulaires,
  application promo dans le tunnel, page wishlist share, dashboard
  admin validate, réponse hôte avis)
- **T-017** (S) : SEO complet + a11y sweep + `next/font`
- **T-018** (S) : éditeur calendrier hôte (rate_plans + room_availability)
- **T-019** (S) : tests d'intégration + Playwright E2E des PAR
- **T-020** (C) : Stripe test-mode — attente credentials
