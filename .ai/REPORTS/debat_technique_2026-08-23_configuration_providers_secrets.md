# Débat technique — T-103 : configuration secrets providers

| Rôle | Position | Objection / alternative |
|---|---|---|
| Architecte | Coffre chiffré DB + fallback env, interfaces provider dédiées. | Ne pas construire un gestionnaire générique sans consumer runtime. |
| Expert sécurité | AES-256-GCM, master key hors DB, GET metadata seulement, audit des mutations. | Une clé master en DB ou app_settings annulerait la protection. |
| Expert PostgreSQL | Table additive avec unique `(provider, name)` et metadata de rotation. | Ne pas stocker des JSON de secrets qui rendent les rotations partielles difficiles. |
| Dev Next.js | Factories async server-only, jamais de secret dans props RSC. | Adapter tous les appelants, sinon erreur silencieuse. |
| QA | Vecteurs tamper/clé invalide et tests non-admin indispensables. | Un simple test de sauvegarde ne prouve pas l’absence de fuite. |
| DevOps | Env reste la racine de confiance ; prévoir procédure de rotation. | Une UI ne remplace pas Vault pour les organisations régulées. |
| UX | Formulaires vides à l’édition, état/source/date visibles, suppression confirmée. | Ne jamais préremplir ou masquer partiellement une clé. |
| Performance | Cache court des credentials déchiffrés. | Invalidation à la mutation, aucun cache client. |
| Relecteur | Refuser la sauvegarde si master key absente. | Un fallback clair en DB serait une faille critique. |
| Produit | Configurer les providers connus est utile immédiatement. | Les autres APIs doivent être ajoutées avec leur intégration, pas comme champ décoratif. |

## Décision

Le coffre AES-GCM server-only est retenu. Les variables d’environnement restent compatibles et peuvent être utilisées en production comme racine de secours. Le panel admin gère uniquement Stripe, Resend et S3 car ce sont les providers réellement consommés. La validation Stripe live reste dépendante de clés fournisseur, sans prétendre être validée dans le sandbox.
