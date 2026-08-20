# ADR-002 : Sécurisation du remplacement physique de la base de données

## Contexte
L'application MobileCaisse est une application hors-ligne où la base de données Room (SQLCipher) contient l'intégralité des données financières. La restauration d'une sauvegarde nécessite le remplacement du fichier `.db` sur le disque.

## Problème
Une copie directe vers le fichier de base actif (`caisse_database`) est risquée :
1. Si l'application crash ou si le disque est plein pendant la copie, la base est corrompue et l'application ne peut plus démarrer.
2. Le mode `WRITE_AHEAD_LOGGING` (WAL) utilise des fichiers `-wal` et `-shm` qui peuvent être incohérents avec la nouvelle base s'ils ne sont pas purgés.

## Solutions envisagées
- **Solution A** : Fermer la base et copier directement le fichier (Risqué).
- **Solution B** : Utiliser l'API `backup` de SQLite (Non disponible via Room simplement).
- **Solution C** : Copier d'abord vers un fichier de staging, vérifier l'intégrité (taille), fermer la base, écraser le fichier original, et purger les journaux WAL/SHM.

## Solution retenue
**Solution C**.

## Arguments
- **Atomiité simulée** : La destruction de l'ancienne base n'intervient qu'après validation de la copie locale vers staging.
- **Intégrité** : La purge des fichiers `-wal` et `-shm` est garantie pour éviter toute corruption par des résidus de l'ancienne base.
- **Robustesse** : La base n'est fermée que pendant la phase finale de remplacement, réduisant la fenêtre d'indisponibilité.

## Conséquences
- Nécessite un espace disque temporaire double (base + staging).
- Oblige au redémarrage de l'application (Splash) après succès pour réinitialiser les singletons DAO.

## Date
2024-05-22

## Références
- `MainRepository.restoreDatabase`
- `BUG-011`, `B-140`
