# Analyse d'impact — T-187 (visuels dédiés + purge + audit mails)

- **Date** : 2026-09-02

## Changements

1. **3 JPG** (`public/seed-images/dest-tunis.jpg`, `hero-home.jpg`,
   `placeholder-property.jpg`) remplacent les alias de T-186 — mêmes noms
   de fichiers → détection automatique par `seedImageUrl`, **aucun code
   modifié**.
2. **Purge base** : artefacts d'audit supprimés (compte test, réservation,
   conversation, message, mails, token reset pending) ; FK sessions +
   verification_tokens gérées explicitement.
3. **Aucun changement de code applicatif** (aucun risque de régression
   introduit) — T-187 est une tâche finition + audit.

## Impacts

| Surface | Impact | Maîtrise |
|---|---|---|
| Home / destinations / fallbacks | Visuels dédiés remplacent les alias | Probes : statique 200, optimizer 200 (`227→129 Ko`) |
| Base démo | 100 % conforme au seed, zéro trace de test | Vérifications SQL post-purge (0 restant) |
| E-mails transactionnels | Aucun — audit seul | 6 types exécutés, tous `sent` |
| Sécurité | Token de reset non consommé supprimé | purge ciblée par `purpose` |

## Hors périmètre

- Les 14 mails résiduels des runs smoke restent (traces système
  légitimes, pas des artefacts d'audit).
