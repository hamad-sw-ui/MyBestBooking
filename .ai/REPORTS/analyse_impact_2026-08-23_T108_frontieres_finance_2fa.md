# Analyse d’impact — T-108 : frontières publiques, finance admin et 2FA

- **Niveau** : C
- **Statut** : en cours
- **Origine** : BUG-035/036/037, AUD-108-01…06, AUD-108-18 et AUD-108-20.

## Objectif

Supprimer les fuites publiques/RSC, rétablir les frontières de publication et de
modération, empêcher les mutations bulk financières destructrices, rendre
l’archivage property atomique, recalculer les notes et supprimer le QR TOTP
externe sans modifier rétroactivement les bookings, snapshots ou secrets
provider.

## Surfaces

- pages publiques property/recherche et API property/reviews ;
- `PropertyCard`, projections Drizzle et serialisation RSC ;
- route property hôte/admin et transitions de publication ;
- admin bulk bookings/properties/reviews ;
- annulation/refund/promo/wallet/outbox ;
- users 2FA, migrations, composant Mon compte.

## Invariants non-régression

1. Les URLs active property, les cartes et les critères de recherche existants restent fonctionnels.
2. Un admin et le propriétaire conservent l’accès métier aux détails non publiés; un visiteur reçoit 404 sans énumération.
3. Les bookings historiques, references, rate plan snapshots et refunds existants ne sont pas réécrits.
4. Une annulation PSP, un email ou un refund ne se produit jamais sous transaction DB ouverte.
5. Une suppression UI de property devient un archivage explicite : aucun historique booking n’est hard-delete.
6. La 2FA existante demeure utilisable; une rotation ne désactive jamais le facteur actif avant validation du nouveau.
7. Aucun secret TOTP ou provider n’est envoyé à un service tiers.

## Risques / protections

| Risque | Protection |
|---|---|
| fuite d’un champ ajouté plus tard au schéma | DTO publics allowlistés, jamais `Property` Drizzle vers composant client |
| carte recherche fausse | prédicat de room unique pour capacité/prix/date et tarif dérivé de la même room |
| double remboursement bulk | commande cancellation persistante/idempotente, mêmes clés PSP/outbox |
| suppression partielle property | archive transactionnelle, aucun cleanup destructif |
| note property incohérente | helper agrégat partagé, exécuté dans transaction de suppression/modération |
| lockout 2FA | colonne pending additive, secret actif conservé jusqu’au verify |
| migration utilisateurs | nullable `two_factor_pending_secret`, fallback legacy de vérification |

## Preuves exigées

- HTTP anonyme : aucune propriété privée/draft/suspended ni champ privé dans API ou Flight ;
- property host : status refusé, admin transition auditable ;
- avis hidden/pending/rejected refusés au public ;
- fixture deux rooms : aucune carte si les critères ne sont pas satisfaits par une seule room ;
- bulk paid cancellation : état refund cohérent, raison, outbox ;
- bulk property : archive sans suppression de rate plan/room/history ;
- delete avis : total/moyenne recalculés ;
- 2FA : pas de QR externe, password + TOTP courant nécessaires pour reprovision, facteur actuel conservé ;
- migrations fraîche, typecheck/lint/tests/build/smoke/ai check.
