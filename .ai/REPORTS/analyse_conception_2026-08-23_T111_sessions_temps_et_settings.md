# Conception — T-111

- `createToken` reçoit une durée, utilisée aussi par session/cookie.
- Les anonymisations nullifient `twoFactorSecret` et `twoFactorPendingSecret`.
- `MAX_STAY_NIGHTS=365` est un helper partagé par booking/recherche/alertes/availability.
- Les switches notifications, durée session, password min et 2FA hosts non consommés sont retirés de l’UI admin plutôt que simulés. Maintenance reste fonctionnelle.
- Le chiffrement TOTP, FX/ledger et inventaire futur restent T-112/T-113 car ils nécessitent une architecture/migration plus large.
