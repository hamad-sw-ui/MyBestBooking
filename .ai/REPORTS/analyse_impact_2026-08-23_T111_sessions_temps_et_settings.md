# Analyse d’impact — T-111 sessions, temps et settings

- **Niveau** : S
- **Statut** : en cours
- **But** : aligner JWT/session remember, nettoyer facteurs TOTP à la suppression,
  borner périodes publiques/host et retirer les contrôles admin décoratifs.

## Invariants

- sessions existantes continuent de valider jusqu’à leur JWT courant;
- rememberMe devient réellement 30 jours, sans augmenter la durée standard 7j;
- aucun secret TOTP actif/pending ne survit à anonymisation;
- booking historique >365 nuits reste lisible, seules nouvelles demandes sont bornées;
- maintenance reste le seul toggle sécurité admin présenté car il est réellement consommé.

## Validation

- tokens JWT standard/remember, delete/anonymize facteurs, 366 nuits booking/search/availability,
  typecheck/lint/tests/build/smoke/ai check.
