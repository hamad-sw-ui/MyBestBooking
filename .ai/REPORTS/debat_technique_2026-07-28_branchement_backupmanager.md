# Débat technique — Branchement de `BackupManager`

**Date** : 2026-07-28 · **Réf.** : B-101 / BUG-017 · **Niveau** : C
**Conception débattue** : `analyse_conception_2026-07-28_branchement_backupmanager.md`

**Question soumise** :
> Faut-il retenir la **solution C** (corriger B-013/B-140/B-141, puis brancher
> A/B/C avec coexistence de deux formats), ou une autre approche ?

---

## 1. Avis des rôles

### 🏛️ Architecte logiciel — ⚠️ réservé
- **Recommandations** : profiter du branchement pour sortir la logique de fichier
  de `ClosureScreen:198` — une fonction d'I/O dans un Composable est une dette qui
  se propage.
- **Objections** : la solution C ajoute des fonctions à `MainViewModel`, déjà à
  586 lignes. On aggrave un problème qu'on prévoit de traiter en J5.
- **Risques** : le ViewModel devient un point de passage obligé de plus en plus
  difficile à découper.
- **Alternatives** : créer dès maintenant un `BackupRepository` séparé plutôt que
  d'étendre `MainRepository`. *Anticipe J5 sur un périmètre restreint.*

### 📱 Développeur Android senior — ✅ pour
- **Recommandations** : `rememberSaveable` pour le mot de passe saisi, sinon une
  rotation d'écran perd la saisie en plein export.
- **Objections** : PBKDF2 à 100 000 itérations bloque ~300 ms sur un appareil
  d'entrée de gamme — hors thread principal impérativement, avec indicateur de
  progression.
- **Risques** : l'utilisateur tape deux fois sur « Exporter » pendant le calcul et
  déclenche deux exports concurrents.
- **Alternatives** : désactiver le bouton pendant l'opération via `BackupUiState`.

### 🅺 Expert Kotlin — ✅ pour
- **Recommandations** : `BackupUiState` en `sealed interface`
  (`Idle`/`Working`/`Success`/`Error`) plutôt qu'un booléen et une chaîne d'erreur.
- **Objections** : `Result<T>` est déjà utilisé dans `BackupManager` ; ne pas
  introduire un second mécanisme d'erreur au niveau du repository.
- **Risques** : mélanger `Result` et exceptions rendrait les chemins d'erreur
  imprévisibles.
- **Alternatives** : `Result` jusqu'au ViewModel, converti en `BackupUiState` à
  la frontière UI.

### 🎨 Expert Jetpack Compose — ⚠️ réservé
- **Recommandations** : un seul `BackupPasswordDialog` paramétré (export vs
  import), pas trois copies.
- **Objections** : l'assistant de restauration passe de 2 à 3 étapes. Ajouter une
  étape à un parcours déjà anxiogène (« ATTENTION : cette opération supprimera
  toutes vos données ») augmente le taux d'abandon.
- **Risques** : un commerçant qui abandonne la restauration en cours reste sans
  ses données.
- **Alternatives** : fusionner la saisie du mot de passe et la confirmation en un
  seul écran, avec l'aperçu `peekMetadata()` (date, boutique) comme réassurance —
  l'utilisateur voit *ce qu'il restaure* avant de confirmer.

### 🗄️ Expert Room — ❌ **contre en l'état**
- **Recommandations** : B-013 (checkpoint WAL) **avant tout branchement**, sans
  discussion.
- **Objections** : 🔍 *observé* — `MainRepository.restoreDatabase:803` appelle
  `db.close()` **avant** la copie, sans remettre `AppDatabase.INSTANCE` à `null`.
- **Vérification faite après le débat** — 🔍 *observé* : `getDatabase()`
  (`AppDatabase.kt:138-142`) teste `if (it.isOpen)` et **remet lui-même
  `INSTANCE = null`** si la base est fermée. Le singleton **se ré-ouvre donc
  correctement**. Mon objection initiale était **infondée** : elle est conservée
  ici pour la traçabilité du raisonnement, mais **corrigée**.
- **Objection qui subsiste** : entre `db.close()` et la fin de la copie, toute
  autre coroutine appelant `getDatabase()` rouvre la base **sur un fichier en
  cours de réécriture**. 🧠 *Déduit* — fenêtre de concurrence réelle, aggravée
  par le fait qu'aucun verrou ne protège l'opération.
- **Risques** : **Élevé** (et non Critique). Corruption possible en cas d'accès
  concurrent pendant la restauration.
- **Alternatives** : B-140 (restaurer dans un fichier temporaire, remplacer
  ensuite) réduit la fenêtre au strict minimum ; y ajouter un verrou pendant le
  remplacement.

> ⚠️ **Point nouveau, absent de la conception** : fenêtre de concurrence pendant
> la restauration. Le singleton, lui, est bien géré — hypothèse initiale invalidée.

### 🔐 Expert Sécurité — ⚠️ réservé
- **Recommandations** : le mot de passe ne doit jamais transiter par un `Log`, ni
  rester dans un `State` après usage. Utiliser `CharArray` effacé après
  dérivation serait l'idéal ; `String` est acceptable si la portée est courte.
- **Objections** : la solution C laisse `syncToCloud` (copie brute) en place
  jusqu'à l'étape 11. Pendant cet intervalle, **deux chemins d'export coexistent**,
  dont un non protégé — l'utilisateur peut choisir le mauvais.
- **Risques** : faux sentiment de sécurité.
- **Alternatives** : dès l'étape 7, **masquer** l'ancien bouton plutôt que de le
  laisser accessible ; le supprimer réellement à l'étape 11.

### 🧪 Expert QA — ❌ **contre en l'état**
- **Recommandations** : écrire les tests de non-régression des 5 chemins **avant**
  de toucher au code.
- **Objections** : 🔍 *observé* — aucun test ne couvre les chemins actuels. On
  s'apprête à modifier un mécanisme de sauvegarde sans savoir s'il fonctionne
  aujourd'hui. Comment prouver l'absence de régression sans état de référence ?
- **Risques** : **Élevé.** Une régression sur D ou E passerait inaperçue jusqu'à
  ce qu'un utilisateur en ait besoin — c'est-à-dire au pire moment.
- **Alternatives** : à défaut de tests automatisés (chemins D/E difficiles à
  simuler), exiger un **protocole manuel écrit et exécuté avant/après**, consigné
  dans `REPORTS/`.

### ⚡ Expert Performance — ⚠️ réservé
- **Recommandations** : mesurer la durée réelle de l'export sur une base de
  50 Mo avant de valider.
- **Objections** : PBKDF2 (~300 ms) + chiffrement en flux + écriture ZIP + copie
  vers le cache. Sur une base volumineuse et un appareil lent, l'export peut
  dépasser 10 s sans retour visuel.
- **Risques** : l'utilisateur croit l'application figée et la tue en cours
  d'écriture → archive partielle. *Atténué* : `BackupManager` supprime les
  fichiers partiels en cas d'échec.
- **Alternatives** : indicateur de progression, et envisager un
  `ForegroundService` si la durée dépasse ~10 s. **Ne pas** baisser le nombre
  d'itérations PBKDF2 — ce serait échanger de la sécurité contre du confort.

### ⚙️ Expert DevOps — ✅ pour
- **Recommandations** : chaque étape du plan doit être un commit séparé et
  révocable.
- **Objections** : les étapes 7–9 ne sont validables que manuellement (UI). La CI
  ne les couvrira pas.
- **Risques** : Faible.
- **Alternatives** : verrouiller par des tests unitaires au niveau
  repository/ViewModel, où la logique réside réellement ; l'UI ne fait qu'appeler.

### 👁️ Relecteur de code — ⚠️ réservé
- **Recommandations** : nommer explicitement les deux formats dans le code
  (`BackupFormat.Encrypted` / `BackupFormat.LegacyRaw`), pas des booléens.
- **Objections** : la coexistence de deux formats sans nommage clair produira des
  `if (isZip)` disséminés.
- **Risques** : Moyen — dette de lisibilité.
- **Alternatives** : `sealed interface BackupFormat` avec une fonction
  `detect(File)` unique, testée.

---

## 2. Tableau des positions

| Rôle | Position | Objection principale |
|---|---|---|
| Architecte | ⚠️ | alourdit `MainViewModel` (586 l.) |
| Dev Android senior | ✅ | rotation d'écran, double appui |
| Expert Kotlin | ✅ | ne pas mélanger `Result` et exceptions |
| Expert Compose | ⚠️ | 3 étapes = risque d'abandon |
| **Expert Room** | ❌ | **fenêtre de concurrence pendant la restauration** |
| Expert Sécurité | ⚠️ | deux exports coexistants, dont un non protégé |
| **Expert QA** | ❌ | **aucun état de référence avant modification** |
| Expert Performance | ⚠️ | export > 10 s sans retour visuel |
| Expert DevOps | ✅ | étapes UI non couvertes par la CI |
| Relecteur | ⚠️ | formats non nommés |

**Pour : 3 · Réservés : 5 · Contre : 2**

## 3. Points de désaccord

| # | Désaccord | Rôles opposés | Enjeu réel |
|---|---|---|---|
| D1 | Étendre `MainRepository`/`MainViewModel` ou créer `BackupRepository` | Architecte vs Dev senior | anticiper J5 ou rester dans le périmètre |
| D2 | Assistant en 3 étapes ou fusion mot de passe + confirmation | Compose vs Sécurité | abandon utilisateur vs clarté du consentement |
| D3 | Masquer l'ancien bouton dès l'étape 7 ou le garder jusqu'à 11 | Sécurité vs DevOps (réversibilité) | filet de repli vs faux sentiment de sécurité |
| D4 | Brancher sans tests de référence | QA vs délais | prouver l'absence de régression |

## 4. Synthèse

**Consensus** : la solution C (corriger les fondations d'abord) est validée dans
son principe — **aucun rôle ne défend A ni D**.

**Divergences irréductibles** : D1 (périmètre du refactor) et D2 (parcours UI).

**Ce que le débat a fait apparaître, absent de la conception** :

1. 🟠 **Fenêtre de concurrence pendant la restauration** (Expert Room).
   `restoreDatabase` ferme la base puis réécrit le fichier sans verrou : toute
   coroutine appelant `getDatabase()` dans l'intervalle rouvrirait un fichier en
   cours d'écriture. → **nouveau BUG-024**.
   ⚠️ *Mon objection initiale — « le singleton n'est pas invalidé » — s'est
   révélée **fausse** à la vérification : `getDatabase()` gère le cas
   (`AppDatabase.kt:138-142`). Le débat a produit une hypothèse erronée, et la
   vérification l'a corrigée. C'est exactement le rôle de §16 (honnêteté
   technique) : un débat génère des hypothèses, il ne produit pas des faits.*
2. 🟠 **Aucun état de référence** avant modification (QA) → un protocole de
   vérification manuelle doit être écrit **et exécuté avant** le branchement.
3. 🟠 **Fenêtre de coexistence** de deux exports dont un non protégé (Sécurité).
4. 🟡 Absence de retour visuel sur un export long (Performance).

## 5. Décision finale

**Décision : solution C retenue, amendée par le débat.**

### Avis retenus

| Avis | Rôle | Pourquoi |
|---|---|---|
| B-013 avant tout branchement | Room | opposition bloquante ; construire sur une sauvegarde incohérente est indéfendable |
| Protéger la restauration contre les accès concurrents | Room | défaut réel confirmé après vérification → BUG-024 |
| Protocole de vérification manuelle avant/après | QA | opposition bloquante ; sans référence, « aucune régression » est invérifiable |
| Masquer l'ancien bouton dès l'étape 7 | Sécurité | supprime la fenêtre de confusion sans perdre la réversibilité (le code reste) |
| `sealed interface BackupFormat` + `detect()` | Relecteur | évite les `if (isZip)` disséminés |
| `sealed interface BackupUiState` | Kotlin | état d'UI explicite |
| `rememberSaveable` + bouton désactivé pendant l'opération | Dev senior | défauts réels et peu coûteux à éviter |
| Indicateur de progression | Performance | atténue le risque d'interruption par l'utilisateur |
| Dialogue unique paramétré | Compose | évite la triplication |

### Avis écartés

| Avis | Rôle | Pourquoi écarté |
|---|---|---|
| Créer `BackupRepository` maintenant | Architecte | **Reporté, non rejeté.** Le découpage de `MainRepository` est le jalon J5 et concerne 6 domaines. En extraire un seul maintenant créerait une architecture hybride pendant plusieurs sessions. → versé au backlog (B-145), à traiter en J5 avec les autres. |
| Fusionner mot de passe et confirmation en un écran | Compose | Le risque d'abandon est réel, mais la restauration **écrase toutes les données** : la séparation des deux consentements (« je fournis la clé » / « j'accepte d'écraser ») est un garde-fou délibéré. `peekMetadata()` sera néanmoins affiché sur l'écran de confirmation, ce qui répond à la préoccupation de réassurance. |
| `CharArray` effacé après usage | Sécurité | Gain marginal sur Android : les `String` de l'UI Compose sont de toute façon en mémoire gérée, non effaçable de manière fiable. Retenu à la place : ne jamais journaliser, portée la plus courte possible. → noté en `KNOWN_LIMITATIONS.md`. |
| `ForegroundService` pour les exports longs | Performance | Prématuré sans mesure. On mesure d'abord (test sur base de 50 Mo) ; on décidera ensuite. → B-146. |

### Risques résiduels acceptés

| Risque | Niveau | Justification |
|---|---|---|
| Mot de passe oublié = sauvegarde perdue | Élevé | Conséquence directe de D2-C, assumée. Atténuation : avertissement UI non contournable (B-143). |
| Deux formats coexistants durablement | Moyen | Structurel : D et E n'ont pas d'interface. Documenté (B-144). |
| Étapes UI non couvertes par la CI | Moyen | La logique est testée aux niveaux repository/ViewModel ; l'UI n'est qu'un appel. |
| `MainViewModel` alourdi | Moyen | Accepté jusqu'à J5, tracé en B-145. |

**Règle d'arbitrage appliquée** : deux ❌ bloquants (Room, QA). Leurs exigences
sont **intégrées comme prérequis**, non écartées. Le développement reste suspendu
tant qu'elles ne sont pas satisfaites.

---

**Décision prise le** : 2026-07-28
**Conception à réviser suite au débat** : ☑ **oui** — ajout de BUG-024, du
protocole QA et du masquage anticipé
**Le développement peut commencer** : ☐ oui ☑ **non** — prérequis : tests
`BackupManager` verts · B-013 · protocole de référence QA
