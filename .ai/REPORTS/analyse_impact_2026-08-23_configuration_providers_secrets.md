# Analyse d’impact — T-103 : configuration web chiffrée des providers

- **Date** : 2026-08-23
- **Niveau** : **C**
- **Justification** : clés Stripe/Resend/S3, chiffrement persistant, migration PostgreSQL, privilèges admin et sélection des providers runtime.

## Objectif

Permettre à un administrateur de configurer Stripe, Resend et S3 depuis `/dashboard/settings`, sans afficher ni stocker les secrets en clair, tout en conservant les variables d’environnement comme fallback et racine de sécurité.

## §14 — neuf questions

### 1. Appelants directs observés

Commandes exécutées :

```bash
grep -RIn "getPaymentProvider\|getProviderStatus\|RESEND_API_KEY\|getMailer\|S3_SECRET" src
```

Résultat : `getPaymentProvider` est appelé par booking, annulation et webhook ; `getMailer` par auth, booking, messages et cron ; `getUploader` par uploads. `getProviderStatus` alimente le dashboard admin et l’API admin settings.

### 2. Dépendances indirectes

- `src/lib/payment/{index,mock,stripe}.ts` ;
- `src/lib/mail/{index,resend-mailer}.ts` ;
- `src/lib/storage/{index,s3}.ts` ;
- dashboard settings et `SettingsPanel` ;
- `recordAudit` et admin settings RBAC ;
- `.env.example`, `KNOWN_LIMITATIONS.md`, `SECURITY.md`, migrations Drizzle.

### 3. Écrans affectés

- `/dashboard/settings`, administrateur uniquement ;
- les parcours réservations, email et uploads indirectement, après sauvegarde d’un provider ;
- aucun écran voyageur ne doit recevoir une valeur secrète.

### 4. Services/tâches affectés

Les factories mail/paiement/upload deviennent asynchrones afin de résoudre une configuration chiffrée depuis PostgreSQL. Les handlers existants devront attendre ces factories. Le cron prix utilise aussi le mailer.

### 5. Contrats et données

- nouvelle table additive `provider_credentials` : provider, clé, ciphertext AES-GCM, iv, auth tag, auteur/date ;
- nouveaux endpoints admin `/api/admin/providers` et `/api/admin/providers/[provider]` ;
- les clés ne figurent jamais dans les JSON GET ; seuls état, source et date sont exposés ;
- `CREDENTIALS_ENCRYPTION_KEY` reste une variable d’environnement obligatoire pour écrire/lire le coffre web ; elle n’est jamais saisissable dans l’UI.

### 6. Tests existants

- `payment/index.test.ts`, `mail/index.test.ts`, `storage/local.test.ts`, `settings.test.ts`, tests admin bulk et 2FA ;
- aucun test ne couvre à ce jour le chiffrement d’une clé provider ou la non-divulgation via API.

### 7. Tests à ajouter

1. AES-GCM : round-trip, clé master absente/invalide, ciphertext/tag modifié ;
2. resolver : valeur DB prioritaire, fallback env, cache invalidé ;
3. endpoint admin : non-admin 403, GET sans secret, PUT/DELETE chiffrés ;
4. providers : Resend/Stripe/S3 sélectionnés après sauvegarde ;
5. migration fraîche et smoke de la page settings.

### 8. Risques de régression

| Risque | Parade |
|---|---|
| Exposer une clé via logs/API/RSC | type metadata sans valeur, redaction, aucune valeur dans props client |
| Perdre les installations `.env` existantes | fallback env si aucune override DB |
| Clé master indisponible | UI lecture seule, PUT 503 explicite ; aucun fallback en clair |
| Cache d’un ancien secret | invalidation locale après mutation ; TTL court |
| DB compromise | AES-256-GCM, master hors DB, authentification du ciphertext |
| Provider cassé par factory async | inventaire complet d’appelants + typecheck/tests runtime |

### 9. Revérification finale

- admin settings, RBAC, audit ;
- booking/mock/Stripe pending, emails de reset et upload local ;
- migration fraîche ;
- typecheck, lint, Vitest, build, smoke et ai:check.
