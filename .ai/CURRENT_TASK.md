# 🎯 TÂCHE EN COURS

**Tâche :** Audit fonctionnel profond n°20 (T-144) — scénarios inachevés/mal
pensés à l'exécution, explication + solution sans régression.

**Environnement restauré** (re-clone) : branche réalignée sur origin (T-143),
dépendances réinstallées, `.env.local` recréé, Postgres embarqué démarré,
`db:push`, `POST /api/seed` (3 comptes + 8 propriétés). Données d'audit
nettoyées (conversations/messages/résa smoke/disponibilité de test).

**Anomalie corrigée (P2).** `POST /api/messages` acceptait un message composé
uniquement d'espaces (`content:"   "`, zod `min(1)` ne trim pas) → bulle vide
stockée, alors que l'UI l'empêche déjà. 🔨 Dans `src/app/api/messages/route.ts`
: `trimmedContent = data.content.trim()` ; 400 « Le message ne peut pas être
vide » si pas de texte **et** pas de pièce jointe ; stockage
`trimmedContent || "(pièce jointe)"`. Message d'espaces → 400 (DEV + PROD),
message normal → 201, pièce jointe seule reste acceptée.

**Flux vérifiés SAINS :** partage wishlist (soft-404 token invalide),
disponibilités chambre (401 client, 400 négatif/date/stock>capacité, messages
français, stopSell 200), vérif email + activer-compte (messages d'erreur
clairs), conversations (401 anon, 404 propriété absente, 400 hôte sans
réservation, idempotence), permissions messages, déconnexion (307 → 401).

**ID** : T-144 — additif, 1 fichier, aucune migration/route.
**Niveau** : L
**Statut** : **CORRIGÉ (VALIDÉ)** — 2026-08-29.

## Sortie (validé — T-144)

- 🔨 `tsc` 0 · `eslint` 0. 🧪 `vitest` **288 passés (42 fichiers)**.
- ▶️ `smoke` **94/94** · `build` ✓ (Compiled successfully, **59 pages**) ·
  `ai:check` **19 OK · 1 warn · 0 fail**.
- ▶️ DEV + PROD (`next start` 3100, arrêté) : message vide → 400.
- Rapport : `.ai/REPORTS/validation_T-144_2026-08-29.md`.
