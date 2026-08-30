# Analyse d’impact — T-110 : intégrité refund, tokens et contenu public

- **Niveau** : S (P0)
- **Statut** : en cours
- **Origine** : BUG-040, AUD-110-01/02/03/05.

## Corrections visées

1. JSON-LD script-safe contre sortie de balise depuis données hôte.
2. Annulation persistée avant tout PSP : refund pending repris par cron après crash.
3. Token claim/reset consommé atomiquement.
4. Suppression des promesses commerciales non supportées et de l’option promo
   `free_night` approximative.

## Non-régression

- même HTML JSON-LD valide pour les moteurs; seules les séquences dangereuses
  sont encodées;
- snapshots booking et calcul de frais sont conservés;
- une annulation garde l’inventaire libéré et expose refund pending plutôt que
  de prétendre un remboursement inexistant;
- liens reset/claim existants et tokens non concurrents restent compatibles;
- promos percentage/fixed amount inchangées; free_night existante est refusée
  honnêtement, non réinterprétée.

## Tests obligatoires

- payload JSON-LD `</script>` n’injecte pas de balise;
- cancellation mock refunds et crash-simulation DB `pending` reprise par cron;
- deux consumes token : un seul userId;
- promo free_night API/UI refusés; percentage/fixed conservés;
- typecheck/lint/tests/build/smoke/ai check.
