# ADR-007 — Panel d'administration configurable (table `app_settings`)

- **Date** : 2026-08-20 (Session 7)
- **Statut** : accepté
- **Niveau** : S
- **Tâche associée** : T-021
- **Rapports liés** :
  `REPORTS/analyse_impact_2026-08-20_admin_settings.md`,
  `REPORTS/analyse_conception_2026-08-20_admin_settings.md`

## Contexte

Un utilisateur avec `role='admin'` ne pouvait modifier **aucun** paramètre
runtime sans passer par une PR + rebuild + redéploiement. La page
`/dashboard/settings` était présentationnelle (bandeau info + boutons
`disabled`). Les constantes commerciales sensibles (TVA 10 %, seuils
BestRewards 5/15, grille d'annulation) vivaient en dur dans
`src/app/api/bookings/route.ts` et `src/lib/cancellation.ts`. Trois
options ont été considérées : fichier JSON versionné (Option A), variables
d'environnement (Option B), table `app_settings` (Option C), service
dédié type Redis (Option D). Détails et éliminations dans le rapport de
conception.

## Décision

Introduire une **table `app_settings`** (key TEXT PK, value JSONB,
`updated_by` uuid, `updated_at`), servie par un module utilitaire
`src/lib/settings.ts` qui :

- expose `getSetting(key)` et `setSetting(key, value, updatedBy)`,
- valide chaque payload par un schéma Zod strict,
- retourne des **valeurs par défaut identiques au comportement actuel**
  quand la clé n'existe pas encore en DB (garantie zéro régression),
- cache les lectures 60 s en mémoire par process (invalidé sur écriture).

Les modifications passent par les endpoints admin
`GET /api/admin/settings` et `PATCH /api/admin/settings/[key]`, protégés
par `role === 'admin'` + rate-limit. Aucun secret n'est ni stocké ni
retourné par ces endpoints — les credentials (Stripe, Resend, S3) restent
pilotés par env vars, l'endpoint renvoie uniquement `{configured: bool}`.

## Alternatives écartées

- **Option A — fichier JSON versionné (`config/settings.json`)** :
  modifiable uniquement par PR + rebuild — ne répond pas au besoin
  « sans passer par le code ».
- **Option B — variables d'environnement** : redéploiement requis à
  chaque changement — inacceptable pour un panneau d'admin.
- **Option D — service dédié (Redis / Consul / LaunchDarkly)** :
  complexité et coût opérationnel disproportionnés à ce stade (mono-app,
  mono-DB). Sera reconsidéré si scale horizontal.

## Conséquences

- **Positives** :
  - Un admin peut modifier TVA, seuils BestRewards, grille d'annulation
    et autres paramètres runtime en direct depuis `/dashboard/settings`.
  - Trois constantes magiques (`0.10`, `5`, `15`) éliminées.
  - Audit trail natif (`updated_by`, `updated_at`).
  - Signature `computeCancellationFee(policy, total, days)` **inchangée**
    → zéro cassure des 10 tests existants.
  - Rollback trivial (table additive, defaults = valeurs actuelles).

- **Négatives** :
  - Une lecture DB supplémentaire par requête (mitigée par cache 60 s).
  - Multi-lambda Vercel : chaque instance a son cache. Acceptable — 60 s
    de délai de propagation entre instances lors d'un changement admin.
  - Une nouvelle surface d'API à sécuriser (mitigée par role admin +
    Zod + rate-limit).

- **À suivre** :
  - Si la plate-forme passe à un déploiement horizontal exigeant une
    propagation temps réel, migrer le cache vers Redis pub/sub.
  - Si le nombre de settings dépasse ~30 clés, refactorer vers un
    schéma tabulaire (une ligne par sous-clé) pour faciliter les
    requêtes analytiques.
  - Si un besoin multi-tenant apparaît, ajouter `tenant_id` à la PK.

## Preuves de mise en œuvre (§16)

- 🔍 Impact et conception rédigés avant implémentation
  (`REPORTS/analyse_impact_2026-08-20_admin_settings.md`,
  `REPORTS/analyse_conception_2026-08-20_admin_settings.md`).
- 🔨 `npm run typecheck` OK après implémentation.
- 🧪 Nouveau `src/lib/settings.test.ts` (defaults, roundtrip, Zod
  refuse valeurs hors bornes) + `src/lib/cancellation.test.ts` inchangé
  (garantit zéro régression sur la grille par défaut).
- ▶️ Login admin → `/dashboard/settings` → modifier TVA de 10 % à 20 %
  → créer une réservation → `taxes` reflète 20 % → restaurer 10 %.

## Signatures

- Auteur : Arena Agent Mode
- Validé par : responsable (utilisateur camerounais Yaoundé)
