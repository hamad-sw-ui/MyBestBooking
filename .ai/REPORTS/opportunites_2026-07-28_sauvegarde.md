# Opportunités d'amélioration — Chaîne de sauvegarde

**Date** : 2026-07-28
**Composants analysés** : `BackupManager` · `MainRepository` (sauvegarde) ·
`ClosureScreen` · `SettingsScreen` · `RestorationWizardScreen` · `BackupWorker` · `ExportUtil`
**Contexte** : `analyse_impact_2026-07-28_branchement_backupmanager.md`

> 🚫 Aucune de ces opportunités ne sera implémentée sans arbitrage explicite.
>
> **Classification §18 (ajoutée le 2026-07-28)** — aucune n'est 🔴 Bloquante ni
> 🟠 Critique : **aucune n'interrompt la roadmap**. Toutes versées au backlog.
>
> | Catégorie | Opportunités |
> |---|---|
> | 🟡 Importante | O-04 (architecture), O-05 (mémoire), O-08 (testabilité), O-09 (traçabilité), O-10 (cache), O-13 (UX critique mais non bloquante) |
> | 🔵 Confort | O-01, O-02, O-06, O-07, O-11, O-12 |
> | ⚪ Cosmétique | O-03 |

---

## Synthèse

| Axe | Opportunités | Gain estimé |
|---|---|---|
| Simplification | O-01, O-02 | −60 lignes, 1 point de vérité |
| Réduction du code | O-01, O-02, O-03 | ≈ −90 lignes |
| Performances | O-06 | export plus rapide sur grosse base |
| Mémoire | O-05 | pic mémoire divisé par ~2 à la restauration |
| Batterie | O-07 | worker quotidien inutile évité |
| Lisibilité | O-03, O-04 | — |
| Testabilité | O-04, O-08 | chemins A/B/C testables sans UI |
| Sécurité | O-09, O-10 | — |
| Maintenabilité | O-01, O-02, O-11 | — |
| Expérience utilisateur | O-12, O-13 | — |
| Architecture | O-04, O-11 | prépare J5 |

**13 opportunités** — 🔴 2 · 🟠 6 · 🟡 5

---

## Détail

### O-01 — Factoriser le partage de fichier *(5 duplications)*

| | |
|---|---|
| **Axe** | Simplification, maintenabilité |
| **Constat** | 🔍 *observé* — `FileProvider.getUriForFile` + `Intent.ACTION_SEND` répétés **5 fois** : `MainRepository:895`, `ClosureScreen:204`, `ClosureScreen:228`, `ExportUtil`, `MainViewModel` |
| **Proposition** | Une fonction unique `shareFile(context, file, mimeType, title)` dans `ExportUtil` |
| **Gain** | ≈ −40 lignes, un seul point à corriger en cas de changement de `FileProvider` |
| **Coût** | Faible (< 1 h) |
| **Priorité** | 🟠 |
| **Risque** | Faible — comportement identique |
| **Backlog** | B-147 |

### O-02 — Fusionner les deux implémentations d'export CSV

| | |
|---|---|
| **Axe** | Simplification, réduction du code |
| **Constat** | 🔍 *observé* — `ClosureScreen:218 exportToCsv()` et `ExportUtil:11 exportSalesToCsv()` font la même chose ; la version de `ClosureScreen` n'exporte pas les lignes de vente et vit dans un Composable |
| **Proposition** | Supprimer celle de `ClosureScreen`, utiliser `ExportUtil` via le ViewModel |
| **Gain** | −25 lignes, corrige une violation MVVM, un seul format de CSV |
| **Coût** | Faible |
| **Priorité** | 🟠 |
| **Risque** | Faible — le format CSV change légèrement (plus complet) |
| **Backlog** | B-148 |

### O-03 — `BackupManager` : extraire les utilitaires Base64

| | |
|---|---|
| **Axe** | Lisibilité, réduction du code |
| **Constat** | 🔍 *observé* — 45 lignes de Base64 maison dans `BackupManager` (nécessaire : `java.util.Base64` = API 26, `android.util.Base64` indisponible en test JVM) |
| **Proposition** | Déplacer dans `utils/Base64Compat.kt`, réutilisable par `SecurityUtil` qui utilise `kotlin.io.encoding.Base64` (expérimental) |
| **Gain** | −45 lignes dans `BackupManager`, une seule implémentation Base64 |
| **Coût** | Faible |
| **Priorité** | 🟡 |
| **Risque** | Faible |
| **Backlog** | B-149 |

### O-04 — 🔴 Extraire un `BackupRepository`

| | |
|---|---|
| **Axe** | Architecture, testabilité |
| **Constat** | 🔍 *observé* — la logique de sauvegarde est dispersée : `MainRepository` (3 fonctions), `ClosureScreen` (1 fonction locale), `BackupWorker`, `SetupScreen` |
| **Proposition** | `BackupRepository` dédié, regroupant les 5 chemins |
| **Gain** | Testable sans UI ; allège `MainRepository` (992 l.) ; prépare J5 |
| **Coût** | Moyen (une session) |
| **Priorité** | 🔴 |
| **Risque** | Moyen — touche 4 fichiers |
| **Dépendances** | Idéalement après Hilt (J4) |
| **Backlog** | **B-145** *(déjà créée — issue du débat, avis de l'Architecte reporté à J5)* |

### O-05 — Restauration en flux plutôt qu'en mémoire

| | |
|---|---|
| **Axe** | Mémoire |
| **Constat** | 🔍 *observé* — `importBackupWithPassword` charge l'entrée `database.enc` **entièrement en mémoire** (`readAllBytesCompat`) avant déchiffrement, alors que l'export, lui, est en flux |
| **Proposition** | Déchiffrer directement depuis le `ZipInputStream` |
| **Gain** | 🧠 *déduit* — pic mémoire ÷ 2 environ. Sur une base de 50 Mo et un appareil à 1 Go de RAM, c'est la différence entre fonctionner et provoquer un OOM |
| **Coût** | Moyen — le ZIP doit être parcouru dans l'ordre, et l'AAD (manifeste) doit être lu en premier |
| **Priorité** | 🟠 |
| **Risque** | Moyen — nécessite de garantir l'ordre des entrées |
| **Backlog** | B-150 |

### O-06 — Mesurer avant d'optimiser l'export

| | |
|---|---|
| **Axe** | Performances |
| **Constat** | ❓ *hypothèse* — un export sur base de 50 Mo pourrait dépasser 10 s (PBKDF2 + chiffrement + ZIP + copie). **Jamais mesuré.** |
| **Proposition** | Test de performance instrumenté, puis décision (indicateur de progression / `ForegroundService`) |
| **Gain** | Décision fondée plutôt que supposée |
| **Coût** | Faible |
| **Priorité** | 🟠 |
| **Risque** | Nul |
| **Backlog** | **B-146** *(déjà créée — issue du débat)* |

### O-07 — `BackupWorker` : éviter les sauvegardes identiques

| | |
|---|---|
| **Axe** | Batterie, usure du stockage |
| **Constat** | 🔍 *observé* — le worker copie la base **et** son miroir chaque jour, même si aucune vente n'a eu lieu |
| **Proposition** | Comparer un hash rapide (taille + date de modification) et ne recopier qu'en cas de changement |
| **Gain** | Évite 2 copies quotidiennes inutiles sur les jours sans activité |
| **Coût** | Faible |
| **Priorité** | 🟡 |
| **Risque** | Faible — attention à ne pas manquer un changement réel |
| **Backlog** | B-151 |

### O-08 — Rendre testables les chemins de sauvegarde

| | |
|---|---|
| **Axe** | Testabilité |
| **Constat** | 🔍 *observé* — **aucun test** ne couvre les 5 chemins ; `ClosureScreen:198` est une fonction de fichier dans un Composable, non testable |
| **Proposition** | Toute la logique dans le repository ; l'UI ne fait qu'appeler |
| **Gain** | Chemins A/B/C testables sans appareil |
| **Coût** | Moyen — inclus dans le plan de branchement |
| **Priorité** | 🔴 |
| **Risque** | Faible |
| **Backlog** | intégré à B-101 |

### O-09 — Journaliser les opérations de sauvegarde dans `action_logs`

| | |
|---|---|
| **Axe** | Sécurité, traçabilité |
| **Constat** | 🔍 *observé* — `syncToCloud` journalise (`CLOUD_SYNC`), mais **ni** `backupDatabase`, **ni** `restoreDatabase` |
| **Proposition** | Tracer export et restauration, avec le rôle de l'utilisateur |
| **Gain** | Une restauration écrase toutes les données : c'est l'opération la plus destructive de l'application, elle doit laisser une trace |
| **Coût** | Faible |
| **Priorité** | 🟠 |
| **Risque** | Nul |
| **Backlog** | B-152 |

### O-10 — Purger les fichiers de cache après partage

| | |
|---|---|
| **Axe** | Sécurité, stockage |
| **Constat** | 🔍 *observé* — `syncToCloud` écrit `caisse_cloud_sync_<ts>.db` dans `cacheDir` et **ne le supprime jamais**. Chaque export laisse une copie de la base |
| **Proposition** | Purger les exports antérieurs à N heures au démarrage |
| **Gain** | Évite l'accumulation de copies de la base (chiffrées, mais présentes) |
| **Coût** | Faible |
| **Priorité** | 🟠 |
| **Risque** | Faible — ne pas supprimer un fichier en cours de partage |
| **Backlog** | B-153 |

### O-11 — Nommer explicitement les formats

| | |
|---|---|
| **Axe** | Maintenabilité, architecture |
| **Constat** | 🧠 *déduit* — la coexistence de deux formats produira des `if (isZip)` disséminés |
| **Proposition** | `sealed interface BackupFormat { Encrypted; LegacyRaw }` + `detect(File)` |
| **Gain** | Un seul point de décision, testé |
| **Coût** | Faible |
| **Priorité** | 🟠 |
| **Risque** | Nul |
| **Backlog** | **B-141** *(déjà créée)* |

### O-12 — Afficher la date de la dernière sauvegarde

| | |
|---|---|
| **Axe** | Expérience utilisateur |
| **Constat** | 🔍 *observé* — rien n'indique à l'utilisateur quand a eu lieu sa dernière sauvegarde |
| **Proposition** | Afficher « Dernière sauvegarde : il y a 3 jours » dans les Paramètres, en rouge au-delà de 7 jours |
| **Gain** | Pour un commerçant sans serveur, savoir que sa dernière sauvegarde date de 3 semaines est une information vitale |
| **Coût** | Faible |
| **Priorité** | 🟠 |
| **Risque** | Nul |
| **Backlog** | B-154 |

### O-13 — Vérifier le mot de passe par double saisie à l'export

| | |
|---|---|
| **Axe** | Expérience utilisateur, sécurité |
| **Constat** | 🧠 *déduit* — une faute de frappe au moment de l'export rend l'archive **définitivement** irrécupérable |
| **Proposition** | Champ de confirmation, ou bouton « afficher le mot de passe » |
| **Gain** | Supprime le mode d'échec le plus probable du système |
| **Coût** | Faible |
| **Priorité** | 🔴 |
| **Risque** | Nul |
| **Backlog** | B-155 |

---

## Opportunités écartées

| Opportunité | Motif de rejet |
|---|---|
| Compresser la base avant chiffrement | Une base SQLCipher est déjà chiffrée, donc incompressible. Gain nul, complexité ajoutée. |
| Réduire les itérations PBKDF2 pour accélérer | Échanger de la sécurité contre du confort. Explicitement rejeté par l'Expert Performance lui-même. |
| Chiffrer aussi le miroir externe | Impossible sans mot de passe : le worker n'a pas d'interface (contrainte structurelle). |
| Sauvegarde incrémentale | Complexité sans commune mesure avec le gain pour des bases de quelques dizaines de Mo. |

---

## Recommandation

**Indissociables de la tâche en cours** *(déjà au backlog)* : O-04→B-145,
O-06→B-146, O-08, O-11→B-141

**À verser au backlog** : O-01 (B-147), O-02 (B-148), O-03 (B-149),
O-05 (B-150), O-07 (B-151), O-09 (B-152), O-10 (B-153), O-12 (B-154), O-13 (B-155)

**Décision du responsable (2026-07-28)** : **O-13 / B-155 reste au backlog.**
Motifs retenus : ce n'est ni un prérequis fonctionnel, ni un blocage de
sécurité, ni nécessaire au branchement de `BackupManager`. Amélioration UX
intégrable plus tard.

**Arbitrage** : ☑ rendu — aucune opportunité n'interrompt la roadmap.
