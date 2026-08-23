# Débat technique — T-109

## Produit

Un invité doit pouvoir accéder à son séjour sans comprendre un reset password.
Le claim explicite est plus clair que la création silencieuse d’un compte ou une
session anonyme persistante.

## Sécurité

Le token de claim réutilise le stockage hashé existant. Le lien seul permet de
choisir un mot de passe mais ne révèle ni bookingId ni données financières.
L’endpoint payment exige ensuite la session issue du claim.

## Fiabilité

Une tentative PSP est un effet durable : la reprise doit trouver le même intent
avec clé d’idempotence. Le webhook accepte plusieurs signatures de rotation mais
n’interprète que les types réellement consommés.

## Décision

Retenir claim token + endpoint resume propriétaire, sans queue externe. Les
notifications sont enqueued puis tentées immédiatement; le cron reste le retry.
