# Analyse d'erreurs — passe pré-compilation

**Date** : 2026-07-28 · **Type** : anticipation (aucun build disponible côté agent)
**Méthode** : recherche systématique de causes racines par analyse statique,
**avant** la première compilation, pour supprimer un cycle complet.

---

## Synthèse

| Indicateur | Valeur |
|---|---|
| **Erreurs totales anticipées** | **3** |
| **Causes racines** | **2** |
| **Erreurs dérivées** | **1** |
| **Faux positifs écartés** | 3 |
| **Recompilations économisées (estimation)** | **2** |

---

## Classement par cause racine

### 🔴 CR-1 — Doublon de ressource `drawable-nodpi`
- **Origine** : mon `git mv app/logo.png → res/drawable-nodpi/brand_logo.png`
  (session J0) a créé un second fichier alors que `app_logo.png` existait déjà.
- **Erreur directe** : 861 Ko dupliqués dans l'APK.
- **Erreur dérivée (E-1)** : ⚠️ `ic_launcher.xml` et `ic_launcher_round.xml`
  référencent `@drawable/app_logo`. Un nettoyage ultérieur de « l'ancien »
  fichier aurait cassé l'icône de l'application.
- **Statut** : ✅ **corrigé** — `brand_logo.png` supprimé, `app_logo.png` conservé.
- **Gravité évitée** : moyenne (APK alourdi, piège différé).

### 🔴 CR-2 — Test `aucune API superieure a l API 24` auto-contradictoire
- **Origine** : le test cherche `"java.time."`, `"java.util.Base64"`,
  `"readAllBytes()"` dans **tout le fichier source** — or mes propres
  commentaires citent ces API pour expliquer pourquoi elles sont bannies.
- **Erreur directe** : 🧪 le test **aurait échoué**, en signalant un faux défaut.
- **Statut** : ✅ **corrigé** — l'analyse porte désormais sur le **code seul**
  (commentaires de fin de ligne et blocs KDoc retirés). Vérifié par simulation :
  4/4 motifs absents du code.
- **Gravité évitée** : élevée. Un échec sur ce test aurait fait croire à une
  régression de compatibilité inexistante, et coûté une itération d'enquête.

---

## Faux positifs écartés (vérifiés, aucune action)

| # | Suspicion | Verdict |
|---|---|---|
| FP-1 | `R.drawable.ic_dialog_alert` / `ic_dialog_info` absents | 🔍 Ce sont des `android.R.drawable.*` — ressources **système**. Mon script d'analyse ne distinguait pas le préfixe. |
| FP-2 | Accolade déséquilibrée dans `BackupManagerTest.kt` | 🔍 `Regex("""\d{4}-\d{2}...""")` — les `{4}` `{2}` sont des quantificateurs dans une chaîne triple-quote. Classe correctement fermée ligne 457. |
| FP-3 | `AppCompat` encore référencé dans `themes.xml` | 🔍 Uniquement dans un **commentaire** expliquant pourquoi il n'est plus utilisé. |

> Ces trois faux positifs auraient consommé du temps d'enquête s'ils étaient
> apparus dans un journal de build. Les écarter maintenant fait partie du gain.

---

## Ordre de correction recommandé

Les deux causes racines sont **indépendantes** (ressources vs code de test) :
aucune ne conditionne l'autre.

| Ordre | Cause | Justification |
|---|---|---|
| 1 | CR-1 + CR-2 **dans la même itération** | Indépendantes, sans risque croisé — corrigées ensemble conformément à la règle §19.4 |

**Aucune recompilation intermédiaire nécessaire.**

## Estimation des recompilations économisées

| Scénario | Cycles |
|---|---|
| Sans cette passe | build 1 → doublon de ressource non vu · build 2 → échec du test API 24 → enquête → correction → build 3 |
| Avec cette passe | build 1 attendu propre |
| **Économie** | **2 cycles** (≈ 6–10 min chacun avec les caches, davantage à froid) |

---

## Reste à valider par compilation réelle

Ces points ont été vérifiés statiquement mais **seul un compilateur peut trancher** :

| Point | Vérification faite | Confiance |
|---|---|---|
| `ByteArray.inputStream(offset, length)` | signature `kotlin.io` confirmée | 🧠 élevée |
| `recoverCatching { throw }` typé `Nothing` | compatible `Result<File>` | 🧠 élevée |
| Smart-cast sur `var` nullable | contourné par copies locales `manifestRaw`/`metaRaw`/`dbRaw` | 🧠 élevée |
| `CipherOutputStream` fermant le ZIP | protégé par `NonClosingOutputStream` | 🧠 élevée |
| `@Serializable` + KSP sur `BackupManifest` | plugin serialization déjà appliqué | 🧠 élevée |
| Thème plateforme `@android:style/Theme.Material.Light.NoActionBar` | API 21+, existe | 🧠 élevée |

❓ **Hypothèse assumée** : je n'ai jamais compilé ce code. D'autres erreurs
peuvent apparaître. Le rapport post-build les classera selon la même méthode.
