# Analyse de conception — T-187

- **Date** : 2026-09-02

## Nature de la tâche

T-187 = **finition + audit**, pas de nouveau mécanisme :

1. **(a) Visuels dédiés** : le design de T-186 (résolveur piloté par la
   présence des fichiers) rend le remplacement des alias trivial —
   générer le JPG du même nom suffit. Aucune ligne de code touchée :
   preuve que le contrat de T-186 tenait sa promesse.
2. **(b) Purge artefacts** : SQL transactionnel avec gestion explicite
   des FK (`sessions`, `verification_tokens` avant `users`). Les tables
   ont été découvertes en exécutant les contraintes, pas en devinant.
3. **(c) Audit e-mails** : exécution réelle des 6 types transactionnels
   (register, forgot, booking, cancel, message × directions), trace
   `email_outbox` vérifiée (`sent`, `attempts=1`). Aucun défaut trouvé.

## Décision clé

Ne **pas** modifier `src/lib/mail/*` ni aucun émetteur : l'outbox T-105
(idempotente, retryable, `eventKey` unique) fait déjà bien le travail —
les échecs provider seraient visibles (`status=failed`, `lastError`),
aucun observé.

## Leçon consignée

Audit SQL à ne jamais jouer **pendant** un run vitest (même base de test
partagée) : interférence constatée (2 échecs transitoires), disparue au
run isolé — 479/479 ×2.
