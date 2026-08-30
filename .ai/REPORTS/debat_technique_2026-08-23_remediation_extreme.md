# Débat technique — T-106

| Rôle | Position | Décision |
|---|---|---|
| Finance | paiement pending doit expirer et promo être restaurée | retenu |
| Sécurité | webhook inbox avant réponse 200 | retenu |
| Ops | outbox avec lease, pas status sending éternel | retenu |
| DBA | upload attaché doit avoir relation persistante | retenu |
| QA | quote annulation et tests crash | retenu |
| UX | texte review/support exact | retenu |
| Performance | cron batch borné | retenu |
| Produit | alert contexte de séjour | schema/API maintenant, moteur complet progressif |
| Relecteur | pas de suppression automatique de messages historiques | retenu |
| DevOps | provider errors codifiés | retenu |

## Décision

Rendre les effets externes retryables par états DB, puis réaligner les surfaces utilisateur. Aucun comportement existant n’est supprimé sans fallback.
