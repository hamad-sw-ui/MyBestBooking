# Débat technique — T-108

## Sécurité

Une API publique filtrée ne suffit pas si une Server Component sérialise le
modèle Drizzle complet au Client Component. L’allowlist est obligatoire et doit
être testée sur la réponse Flight/HTML, pas seulement JSON.

## Finance

Bulk annulation est une commande métier, non une mise à jour de statut. Le PSP
reste hors transaction, mais les états refund/outbox permettent la reprise.
Archiver les properties est préféré au hard delete parce que les bookings sont
un registre opérationnel et financier.

## Produit

L’archivage doit être nommé honnêtement dans l’UI; garder le libellé
« Supprimer » serait une interaction trompeuse. Le propriétaire perd seulement
la publication, pas ses données ni ses snapshots.

## 2FA

La saisie manuelle locale est moins fluide qu’un QR distant mais est sûre. Une
bibliothèque QR locale peut être ajoutée ultérieurement sans modifier le contrat
API; elle ne doit jamais appeler un domaine tiers. Le mot de passe + TOTP actuel
est retenu pour les opérations sensibles.

## Décision

Appliquer la conception retenue avec migration additive, tests négatifs RBAC,
scénarios DB de bulk, et ne valider aucune intégration fournisseur réelle sans
credentials test.
