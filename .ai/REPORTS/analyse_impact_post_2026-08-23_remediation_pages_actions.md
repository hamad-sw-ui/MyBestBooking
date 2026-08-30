# Analyse post-correction — T-105

| Prévu | Constat |
|---|---|
| aide active | ▶️ articles réels, recherche filtrante et lien support rendus |
| promesses trompeuses | 🔍 garantie retirée, destination fake retirée, politique chambre contextualisée |
| outbox | ▶️ booking confirmé → 2 events email `sent`, marqueur booking présent |
| votes | ▶️ premier vote 200, second 429 et table unique persistante |
| fichiers orphelins | ▶️ upload privé créé puis cron → `orphanUploadsRemoved=1` |
| rate plans | ▶️ création, archive, sélection et snapshot booking testés |
| export | ▶️ CSV privé hôte téléchargé ; cellules formule neutralisées par code |
| migrations | ▶️ 0011 sur DB fraîche, 4 tables opérationnelles présentes |

## Limites

- idempotence fournisseur absolue nécessiterait idempotency key/outbox worker externe ; l’outbox DB couvre les retries applicatifs.
- tests Stripe/Resend/S3 réels requièrent des clés fournisseur.
- Playwright Chromium reste indisponible dans le sandbox.
