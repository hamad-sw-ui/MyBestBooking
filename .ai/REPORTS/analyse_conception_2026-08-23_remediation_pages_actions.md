# Conception — T-105 pages et actions

## Solutions évaluées

1. **Masquer les promesses non branchées** : faible risque mais ne délivre pas aide/garantie/outbox. Retenue seulement pour garantie prix et perks sans processus légal.
2. **Réparer chaque page localement** : rapide mais duplication des règles. Rejetée.
3. **Services et états persistants additifs** : outbox, vote, alert context, plan lifecycle, articles d’aide versionnés. Retenue.

## Décisions

- aide : articles internes structurés, recherche GET et liens/accordéons réels ;
- garantie prix : texte retiré tant que dossier de réclamation absent ;
- annulation : calcul affiché depuis politique effective/plan ;
- email : outbox persistante, worker cron idempotent ;
- votes : table unique ;
- upload : table d’objets temporaires/référencés et cleanup cron ;
- rate plan : PATCH deactivate/edit interdit si snapshot? autorisé mais historique snapshot ;
- recherche : `COUNT` cohérent ;
- alertes : dates/voyageurs optionnels puis devis disponible ;
- CSV safe ;
- provider health historisé sans secret.

## Rollback

Colonnes/tables restent inertes après revert. Les pages gardent leurs chemins existants et les fichiers historiques ne sont pas supprimés automatiquement.
