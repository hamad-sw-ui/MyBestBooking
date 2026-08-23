# Conception — T-108 : frontières publiques, finance admin et 2FA

## Décisions

### Projections publiques allowlistées

Un module `public-property` retourne des DTO nommés, sans champ interne. Les
pages RSC et APIs publiques n’exportent plus d’inférence Drizzle complète vers
le client. Les projections propriétaire/admin restent séparées.

### Recherche par room réellement éligible

Les contraintes capacité, prix et dates sont appliquées dans un même prédicat
SQL corrélé à une room. Le prix rendu est celui de la room éligible la moins
chère, jamais un `MIN` de toutes les rooms.

### Annulation de domaine unique

Une commande de cancellation calcule les frais depuis snapshot/politique,
produit la mutation persistante, libère les avantages si besoin, appelle le
PSP hors transaction et émet l’email via outbox. Bulk et route individuelle
l’emploient; les autres transitions booking restent inchangées.

### Archive property plutôt que purge

Le bouton bulk delete archive property. Les rooms/rate plans/bookings restent
pour audit, les chemins publics filtrent status active. Ce comportement est
réversible par action admin explicite et évite les FK/cleanup partiels.

### Rotation TOTP en deux phases

`twoFactorPendingSecret` est ajouté. Setup exige mot de passe courant et, si
2FA active, le TOTP courant. Verify promeut le pending en secret actif. Disable
exige également password + TOTP. L’UI n’utilise plus aucun QR externe et permet
la saisie manuelle du secret.

## Alternatives rejetées

- masquer les champs après sérialisation client : trop tard, le Flight les contient ;
- garder hard delete avec cascades bookings : perte légale/financière ;
- faire bulk annulation via fetch HTTP interne : auth/cookies et reprise non fiables ;
- réécrire le secret TOTP actif avant validation : risque lockout ;
- garder qrserver.com avec un secret "temporaire" : le secret est le facteur, donc non exportable.
