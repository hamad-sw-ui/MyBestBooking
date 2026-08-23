# ADR-014 — Claim invité, reprise payment et webhooks allowlistés

- **Date** : 2026-08-23
- **Statut** : accepté, T-109 en cours

## Décisions

1. Le profil invité est créé seulement dans le commit booking après validation.
2. Un token `guest_claim` hashé et expirant permet choix du mot de passe et
   session sans transmettre l’identifiant booking dans l’URL.
3. La reprise payment est propriétaire et utilise l’intent provider existant ou
   la même clé idempotente, jamais une nouvelle réservation.
4. Les webhooks Stripe acceptent une liste de signatures v1 et une allowlist de
   types métier.
5. Les notifications transactionnelles passent par outbox lorsque le flux est
   rejouable.

## Conséquences

Les comptes invités doivent être revendiqués par email. Sans accès à l’email,
le support suit une procédure vérifiée. Les validations Stripe réelles restent
hors périmètre sans credentials de test.
