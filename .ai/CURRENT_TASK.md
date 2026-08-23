# 🎯 TÂCHE EN COURS

**Tâche :** Corriger les pages, promesses et actions restantes identifiées par l’audit profond.
**ID** : T-105
**Niveau** : **C** — outbox, votes DB, uploads, alertes, recherche, migrations.
**Statut** : **CORRIGÉ (VALIDÉ)**

## Livré

- aide interactive avec articles et recherche ; garantie prix retirée ; politique
  annulation contextualisée ;
- outbox email persistante/retryable, votes utiles DB, cleanup upload cron ;
- rate plan archivable, sélection/snapshot booking ;
- recherche enrichie/paginée, export CSV sécurisé, provider test historisé ;
- promesses destinations et BestRewards réalignées sur le réel.

## Preuves

- 🔨 typecheck/build, lint 0 erreur ;
- 🧪 **215/215** DB + serveur ;
- ▶️ migration 0011, outbox sent, votes 200/429, cleanup, rate plan, CSV ;
- ▶️ smoke **91/91**, ai:check 18 OK / 0 fail.

## Limites

Appels fournisseurs réels et Chromium Playwright restent externes au sandbox.
