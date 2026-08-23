# Analyse d’impact post-correction — T-103 coffre providers

## Effets constatés

| Prévu | Constat |
|---|---|
| Chiffrement AES-GCM | 🧪 round-trip et tag altéré refusé dans `provider-credentials.test.ts`. |
| Fallback env | 🧪 mail/paiement continuent à sélectionner leurs providers sans override DB. |
| Override DB | 🧪 test DB : Resend DB prioritaire ; factory retourne `ResendMailer`. |
| Non-divulgation | ▶️ API admin retourne metadata sans valeur ; ciphertext DB ne contient pas la clé test ; endpoint public Stripe retourne seulement `publishableKey`. |
| RBAC | ▶️ GET admin sans session = 403 ; PUT admin stocke ; DELETE confirmé revient au fallback. |
| Migration | ▶️ migration 0000→0009 exécutée sur DB fraîche ; colonnes coffre présentes. |
| Non-régression | 🔨 typecheck/build ; 🧪 211/211 avec DB+serveur ; ▶️ smoke 91/91. |

## Écarts et risques résiduels

- Les clés Stripe/Resend/S3 réelles ne sont pas testées contre les fournisseurs, car aucune clé fournisseur n’a été fournie. Les factories et le chiffrement sont testés avec valeurs de démonstration.
- La rotation de `CREDENTIALS_ENCRYPTION_KEY` n’est pas automatique. La perte de cette clé rend les overrides DB illisibles ; les variables env doivent rester sauvegardées.
- Chromium Playwright reste indisponible dans le sandbox réseau. Les contrôles HTTP et build ne sont pas présentés comme un test de saisie navigateur complet.

## Effets inattendus

La conversion des factories mail/paiement/upload en async a nécessité l’inventaire complet des appelants. Les tests ont confirmé qu’aucun handler ne gardait une factory synchrone.
