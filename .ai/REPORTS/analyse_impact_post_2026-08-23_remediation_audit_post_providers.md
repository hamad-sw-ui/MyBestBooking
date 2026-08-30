# Analyse post-correction — T-104

## Résultats observés

| Risque prévu | Effet réel |
|---|---|
| Confirmation Stripe sans email | ▶️ service confirmation marqué en DB après booking mock et après webhook mock `pending → confirmed`. |
| Attachment publique | ▶️ upload renvoie `url:null`, clé privée `uploads/...`; participant obtient 200, outsider 403. |
| S3 remove cassé | 🧪 test clé `uploads/...` appelle DELETE ; traversal bloqué ; ACL `public-read` absente. |
| Rate plan décoratif | ▶️ plan créé hôte, sélection API checkout, snapshot/discount/petit-déjeuner stockés dans booking. |
| Provider mauvaise config silencieuse | ▶️ test explicitement non configuré répond 422 sans valeur secrète. |
| Search prix incohérent | 🔍 bornes min/max maintenant imposées dans le même EXISTS de chambre ; UI expose voyageurs, équipement, tri et pagination. |
| Export hôte absent | ▶️ export CSV privé des bookings payés non annulés téléchargé ; facture légale reste explicitement hors périmètre. |

## Écarts / limites

- La garantie exactly-once d’un email vers un fournisseur externe nécessiterait une outbox/idempotency-key fournisseur complète. Le verrou DB et marqueur persistent empêchent les doublons normaux de webhook ; une erreur réseau après acceptation fournisseur reste un risque connu.
- Les fichiers historiques utilisant `attachmentUrl` ne sont plus servis publiquement et demandent réimportation privée : choix de sécurité explicite.
- Tests Stripe/Resend/S3 réels restent dépendants de clés fournisseur de test, absentes du sandbox.

## Validation

- migration fraîche 0010 ;
- typecheck/build ;
- Vitest DB+serveur ;
- smoke HTTP ;
- tests API runtime attachment, rate plan, webhook email et provider non configuré.
