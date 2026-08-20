# 🔐 MODÈLE — RAPPORT DE SÉCURITÉ

> Copier en `rapport_securite_<AAAA-MM-JJ>.md`.
> Obligatoire : à chaque modification touchant la crypto, les permissions, les
> accès ou la sauvegarde — et avant chaque release.

---

# Rapport de sécurité — AAAA-MM-JJ

**Périmètre** : <complet | ciblé sur X>
**Commit** : `<sha>`
**Version applicative** : `versionName` / `versionCode`

---

## 1. Synthèse

| Indicateur | Valeur |
|---|---|
| Vulnérabilités 🔴 critiques | |
| Vulnérabilités 🟠 majeures | |
| Vulnérabilités 🟡 mineures | |
| Évolution depuis le rapport précédent | |
| **Verdict release** | ✅ APTE / ⛔ NON APTE |

## 2. Chiffrement des données

- [ ] Base chiffrée SQLCipher, clé jamais en clair sur disque
- [ ] Dérivation de clé par KDF itératif avec sel aléatoire
- [ ] Clé protégée par AndroidKeyStore
- [ ] Aucun chemin de repli affaiblissant (ex. `ANDROID_ID`)
- [ ] Rekey testé, sans perte de données

**Constats** :

## 3. Authentification et contrôle d'accès

- [ ] PIN hachés avec sel, itérations conformes à l'état de l'art
- [ ] Comparaison à temps constant
- [ ] Verrouillage après tentatives, non contournable par redémarrage
- [ ] Rôles MANAGER/STAFF appliqués sur **toutes** les routes sensibles
- [ ] Aucune route sensible ajoutée sans protection

**Constats** :

## 4. Secrets

- [ ] Aucun secret en clair dans le code source
- [ ] Aucun secret dans les logs
- [ ] R8 activé en release
- [ ] Outils d'administration absents de l'APK client

```bash
git grep -inE "secret|api[_-]?key|password|token|salt\s*=\s*\"" -- '*.kt'
```

**Constats** :

## 5. Données personnelles

- [ ] Aucune donnée personnelle transmise hors de l'appareil sans action explicite
- [ ] Le contenu des SMS n'est pas exfiltré
- [ ] Les sauvegardes partagées restent chiffrées
- [ ] Une purge est possible (`purgeOldData`)
- [ ] `allowBackup` audité

**Constats** :

## 6. Permissions

| Permission | Justifiée ? | Usage réel | Dégradation si refusée |
|---|---|---|---|
| `RECEIVE_SMS` | | | |
| `READ_SMS` | | | |
| `CAMERA` | | | |
| `BLUETOOTH_CONNECT` | | | |
| `POST_NOTIFICATIONS` | | | |

- [ ] Aucune permission superflue
- [ ] Refus géré sans crash

## 7. Surface d'attaque

- [ ] Composants exportés protégés par permission
- [ ] `FileProvider` correctement borné
- [ ] Aucun `Intent` implicite exposant une donnée sensible
- [ ] Aucun deep link non validé

## 8. Intégrité et journalisation

- [ ] Actions sensibles tracées dans `action_logs`
- [ ] Le journal ne peut pas être effacé sans trace *(limitation connue)*
- [ ] Détection d'anomalies opérationnelle

## 9. Dépendances

- [ ] Aucune dépendance avec CVE connue
- [ ] Aucune bibliothèque de sécurité obsolète *(rappel : `android-database-sqlcipher` est déprécié)*
- [ ] Aucune dépendance alpha/beta sur les couches critiques

## 10. Vulnérabilités identifiées

| # | Gravité | Description | Fichier | Correctif proposé | Réf. |
|---|---|---|---|---|---|
| V1 | | | | | B-XXX |

## 11. Recommandations priorisées

1.
2.

## 12. Risques acceptés

| Risque | Justification | Validé par |
|---|---|---|
| | | |
