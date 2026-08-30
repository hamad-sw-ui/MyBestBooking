# Conception — T-103 : coffre de configuration providers

- **Niveau** : C
- **Prérequis** : analyse d’impact T-103.

## 1. Objectif

Offrir une configuration admin utile des integrations existantes — Stripe, Resend et S3 — sans diminuer la sécurité des secrets ni casser le déploiement par variables d’environnement.

## 2. Solutions possibles

### A. Stocker les clés en clair dans `app_settings`

- Avantage : très rapide, réutilise le panel existant.
- Défauts : admin DB, backup, log ou API peuvent exposer des secrets ; impossibilité de démontrer une séparation cryptographique.
- **Rejetée** : incompatible avec la nature C de la tâche.

### B. Écrire les clés dans `.env` depuis le navigateur

- Avantage : comportement proche d’un hébergeur.
- Défauts : impossible/sans intérêt en serverless, accès filesystem dangereux, pas de redéploiement garanti, violation des pratiques de secrets.
- **Rejetée**.

### C. Coffre PostgreSQL chiffré AES-256-GCM, master key hors DB

- Avantage : l’admin dispose d’une UI ; DB ne contient jamais le clair ; intégrations existantes peuvent résoudre DB puis env ; metadata seulement en lecture.
- Défauts : une master key d’environnement est nécessaire ; rotation demande une procédure contrôlée ; requêtes async.
- **Retenue**.

### D. Gestionnaire externe exclusif (Vault/Secrets Manager)

- Avantage : sécurité opérationnelle supérieure à grande échelle.
- Défauts : dépendance et compte fournisseur non disponibles ; ne répond pas à l’UI demandée sans SDK/API supplémentaire.
- **Reportée** : le coffre C reste compatible avec une migration future vers Vault.

## 3. Architecture retenue

```text
Admin HTTPS /dashboard/settings
  └─ PUT /api/admin/providers/[provider] (admin + audit)
       └─ validation allowlistée par provider
       └─ AES-256-GCM avec CREDENTIALS_ENCRYPTION_KEY (env)
       └─ provider_credentials (ciphertext + iv + tag)

Runtime server-only
  └─ resolveProviderCredentials(provider)
       ├─ override DB déchiffrée si master key disponible
       └─ fallback variables d’environnement existantes
  └─ getMailer / getPaymentProvider / getUploader async

GET admin providers
  └─ metadata uniquement : configured, source, updatedAt, fields présents
```

Les champs Stripe : secret, webhook, clé publique. Resend : API key, expéditeur. S3 : endpoint, region, bucket, access key, secret key, base URL publique.

## 4. Compatibilité

- aucune clé existante n’est migrée depuis `.env` ; l’admin peut les saisir explicitement s’il souhaite les gérer via UI ;
- l’absence de coffre ou de master key conserve strictement le comportement env/local actuel ;
- la configuration web ne propose que les providers réellement intégrés : un « provider arbitraire » ne serait pas automatiquement utilisable et serait trompeur.

## 5. Risques

- **Critique** : master key perdue => credentials DB illisibles. Mitigation : documenter backup/rotation, garder env fallback possible.
- **Élevé** : clés entrées depuis navigateur. Mitigation : admin authentifié, HTTPS production, jamais rerendues ni journalisées.
- **Moyen** : cache. Mitigation : invalidation explicite et TTL court.

## 6. Plan de développement

1. schéma/migration et crypto server-only + tests ;
2. resolver, conversion async des factories et appelants ;
3. endpoints admin RBAC/audit ;
4. interface paramètre providers ;
5. migration fraîche, tests, runtime et documentation.

## 7. Retour arrière

Revert applicatif : les overrides chiffrées restent inertes ; les factories retombent aux env. La table est additive et aucune donnée utilisateur n’est supprimée.
