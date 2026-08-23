# Analyse d’impact — T-105 : remédiation pages et actions

- **Niveau** : C
- **Motif** : outbox transactionnelle, votes persistants, uploads/cron, modifications de schéma, promesses commerciales et reporting.

## Surface

| Sujet | Fichiers principaux |
|---|---|
| aide / garantie | `/aide`, fiche property, home |
| annulation exacte | fiche property, rate plans, booking rules |
| outbox | booking confirmation, mailer, cron, schema |
| votes | reviews helpful, schema, fiche property |
| uploads | storage, messages, cron |
| rate plan CRUD | route rate-plans, calendar UI, booking snapshot |
| recherche/pagination | recherche page, requêtes SQL |
| alertes | price alerts, cron, schema, UI |
| CSV | billing export |
| provider tests | provider schema/routes/settings UI/audit |

## Contrats protégés

- URLs existantes et APIs booking/messages/favoris restent compatibles ;
- migrations additives ;
- anciens messages/alerts restent lisibles ;
- aucune promesse produit n’est rendue visible sans traitement réel.

## Risques

- outbox double-envoi : unique event/key et états atomiques ;
- votes double : unique index DB ;
- cleanup upload : ne supprimer que les fichiers non référencés ;
- total recherche : requête identique aux filtres ;
- contexte alerte : migration nullable, fallback prix base historique ;
- CSV : neutraliser formules sans altérer les montants.

## Validation exigée

Tests DB pour outbox/votes/cleanup/rate plan, tests purs CSV/recherche, migration fraîche, pages aide, smoke, build et tests complets.
