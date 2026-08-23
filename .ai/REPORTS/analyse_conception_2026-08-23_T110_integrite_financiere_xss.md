# Conception — T-110 intégrité refund, tokens et contenu public

## JSON-LD

Utiliser `safeJsonForScript(value)` qui encode `<`, `>`, `&`, U+2028/U+2029
après JSON.stringify. Il est appliqué à toute injection JSON-LD, pas à
l’affichage React normal.

## Annulation

La transaction persiste `cancelled`, frais et `refundStatus=pending` avant
toute requête PSP. Le worker/refund helper utilise une clé universelle
`booking-refund:<bookingId>` pour l’annulation normale ou la capture tardive.
Le cron reprend les pending. Ainsi un crash laisse un état supportable et
rejouable, pas un effet PSP invisible.

## Tokens

`consumeToken` devient une UPDATE conditionnelle RETURNING, atomique au niveau
PostgreSQL; aucun SELECT préalable ne peut être observé simultanément.

## Promesses

Une promesse sans processus est retirée/reformulée. `free_night` est refusé par
API et retiré du formulaire jusqu’à un calcul par nuit snapshoté.
