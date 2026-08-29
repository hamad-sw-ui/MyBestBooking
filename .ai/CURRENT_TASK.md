# 🎯 TÂCHE EN COURS

**Tâche :** Audit fonctionnel profond n°18 (analyse profonde à l'exécution des
scénarios/éléments fonctionnels inachevés ou mal pensés ; explication du
problème et des solutions sans régression ; mise en œuvre selon le framework
`.ai/` ; tout tester avec succès avant de s'arrêter).

**Investigation (3 rôles + anonyme, DEV puis PROD).** Parcours vérifiés
bout-en-bout et **jugés sains** :
- alertes prix (DELETE bornée à l'utilisateur + UI mes-favoris) ;
- wallet en réservation (débit plafonné au total, **restitution intégrale à
  l'annulation** : 25 € débités puis rendus au cancel) ;
- machine d'états de séjour (customer annule seulement ; host clôture/no-show
  après check-out ; terminaux ; UI gardée par `canManageStay`) ;
- mode maintenance (PATCH settings/security objet complet → 503 écritures/promo,
  garde cliente `<MaintenanceGate/>`, bypass admin anti-verrouillage ; PUT→405
  et PATCH partiel→400 sont des comportements attendus) ;
- webhook Stripe (signature + inbox idempotente) ; export billing CSV
  (403 client / 200 CSV hôte) ; suspension utilisateur (auto-interdiction,
  sessions révoquées, login bloqué) ; formulaire d'avis (range min=1) ;
  actions voyageur (annuler/contacter hôte/facture/avis toutes câblées) ;
  page /maintenance accessible.

**Anomalie corrigée (A1 — i18n, dernier reliquat admin).** Les dernières routes
admin retournaient le message zod **brut en anglais** sur entrée invalide.
🔨 Passage par `frenchZodMessage()` (statut 400 conservé) :
`api/admin/bulk`, `api/admin/providers/[provider]` (POST + PATCH),
`api/admin/settings/[key]` (PATCH), `api/users/[id]/suspend` (PATCH).
400 → « Valeur invalide ou manquante ».

**ID** : T-140 — additif, aucune migration, aucune route d'écriture nouvelle.
**Niveau** : L
**Statut** : **CORRIGÉ (VALIDÉ)** — 2026-08-29.

## Sortie (validé — T-140)

- 🔨 `tsc` 0 · `eslint` 0. 🧪 `vitest` **288 passés (42 fichiers)**.
- ▶️ `smoke` **94/94** · `build` ✓ (Compiled successfully, **59 pages**) ·
  `ai:check` **18 OK · 2 warn · 0 fail** (warns R7/R17 = état de session,
  résorbés au commit final qui met à jour STATE/PROGRESS).
- ▶️ Exécution DEV (3000) **et PROD** (`next start` 3100, puis arrêté) :
  bulk payload invalide → 400 « Valeur invalide ou manquante » ; suspend
  payload invalide → 400 français ; maintenance activation 200 →
  `{active:true}` → POST booking 503 et promo publique 503 → désactivation 200.
- 🧹 Données de test nettoyées : **32 réservations**, wallet client **25,00 €**.
- Rapport : `.ai/REPORTS/validation_T-140_2026-08-29.md`.
