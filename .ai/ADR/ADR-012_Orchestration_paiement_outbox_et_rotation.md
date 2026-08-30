# ADR-012 — Orchestration paiement, outbox et rotation de clés

- **Date** : 2026-08-23
- **Statut** : accepté (implémentation T-107 en cours)
- **Contexte** : les transactions DB contenaient des appels fournisseurs. Les succès tardifs et les réponses réseau perdues pouvaient laisser une compensation ou un email ambigu. Le coffre provider ne supportait pas de rotation contrôlée.

## Décision

1. Valider et réserver le booking dans une transaction courte, puis créer/rattacher le PaymentIntent hors transaction avec une clé d’idempotence stable.
2. Conserver un TTL de réservation et faire reprendre par le cron les intents non rattachés avant expiration.
3. Compenser tout succès de paiement reçu après annulation par un remboursement idempotent, sans ressusciter le séjour.
4. Envoyer la clé outbox au mailer/provider et stocker l’identifiant fournisseur quand disponible.
5. Déchiffrer le coffre via keyring primaire + précédent temporaire et fournir un réchiffrement admin explicite, sans transmettre de clé dans HTTP.

## Conséquences

- Les handlers ont plus d’états persistants mais ne maintiennent plus de lock DB pendant une requête Internet.
- La sémantique exactly-once dépend de l’idempotence supportée par le fournisseur; Resend/Stripe reçoivent une clé déterministe.
- Une vraie rotation requiert une étape opérationnelle : configurer la nouvelle clé primaire, conserver l’ancienne dans `CREDENTIALS_ENCRYPTION_KEY_PREVIOUS`, lancer le réchiffrement, vérifier, puis retirer la précédente.
- Les validations de véritables comptes Stripe/Resend restent hors périmètre sans credentials de test.
