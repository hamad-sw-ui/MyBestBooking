# Analyse post-correction — T-106

| Risque | Constat |
|---|---|
| payment pending | ▶️ booking expiré traité par cron : cancelled/failed, stock libéré |
| webhook avant booking | ▶️ événement inbox reçu sans booking puis traité par cron après insertion |
| outbox | 🔍 lease `claimedAt`, retries stale, failed après attempts max |
| attachment | 🔍 transaction message/upload + delete attached 409 prévu |
| quote annulation | 🔍 route lecture seule + confirmation UI avec frais/remboursement |
| votes | 🧪 unique DB maintenu |
| support/perks | 🔍 textes réalignés |
| provider logs | 🔍 codes de diagnostic non sensibles |

## Limites

- Contexte alerte prix est accepté et persisté mais moteur de devis par séjour reste une évolution suivante ; UI continue de dire prix de base.
- Outbox exactly-once fournisseur dépend encore d’idempotency key provider, non universelle.
- Stripe/Resend/S3 réels nécessitent des clés test externes.
