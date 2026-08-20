# 🗺️ ROADMAP — Plan de complétion

\u003e **Statut : ✅ VALIDÉE le 2026-07-28** — décisions D1 à D4 reçues.
\u003e Point de départ retenu : **J0 (build propre + nettoyage technique)**, puis
\u003e enchaînement direct sur **J1.1 + J1.2** (intégrité des migrations).

## Décisions du responsable (2026-07-28)

| Réf. | Décision | Conséquence |
|---|---|---|
| **D1** | Bases \u003c v18 : perte assumée, **avec accord de l\u0027utilisateur** | B-011 \u003d détection + consentement + export de courtoisie + recréation. `fallbackToDestructiveMigration` reste proscrit |
| **D2** | **Les deux** : renommer l\u0027existant *et* préparer un vrai service distant | B-110 (renommage seul, sans toucher à la logique) + B-111 (analyse Drive/Dropbox) + B-112 (implémentation) |
| **D3** | Démarrer par **J0**, puis **J1.1 + J1.2** | Ordre confirmé ci-dessous |
| **D4** | Le responsable dispose d\u0027Android Studio et exécute builds/tests | Chaque livraison s\u0027accompagne des **commandes exactes** à exécuter |
| **Prod** | **Aucun utilisateur en production** | J1 perd son caractère de sauvetage : c\u0027est un chantier de qualité, pas d\u0027urgence. Latitude pour refondre la chaîne de migrations |

---

## Jalon D — Environnement Docker *(Phase 6, livré le 2026-07-28)* ✅

| Ordre | Tâche | Réf. | Statut |
|---|---|---|---|
| D.1 | Créer `docker/` (image, compose, scripts) | B-130 | ✅ |
| D.2 | Documenter `.ai/DEV_ENVIRONMENT.md` | B-131 | ✅ |
| D.3 | Intégrer aux checklists et règles | B-132 | ✅ |
| D.4 | **Première exécution `make image \u0026\u0026 make verify`** | B-133 | ✅ |

---

## Vue d\u0027ensemble des dépendances

```
JD Environnement Docker  ◄── Phase 6, préalable à tout
      │
      ▼
J0 Build vérifiable ✅
      │
      ▼
J1 Intégrité des données ✅
      │
      ▼
J2 Sécurité ✅
      │
      ▼
J3 Filet de tests ✅
      │
      ▼
J4 Hilt + assainissement ✅
      │
      ▼
J5 Découpage Repository / ViewModel ⏳ (En cours)
      │
      ▼
J6 Fonctionnalités manquantes
      │
      ▼
J7 Industrialisation (CI, release)
```

---

## Jalon 4 — Hilt et assainissement ✅

| Ordre | Tâche | Réf. | Statut |
|---|---|---|---|
| 4.1 | Mise en place de Hilt (plugin + application + activity) | B-030 | ✅ |
| 4.2 | `DatabaseModule` (base + 20 DAO) | B-031 | ✅ |
| 4.3 | `RepositoryModule` avec `@ApplicationContext` | B-032 | ✅ |
| 4.4 | `@HiltViewModel` ; suppression de la factory manuelle | B-033 | ✅ |
| 4.5 | `@HiltWorker` pour les deux workers | B-034 | ✅ |
| 4.6 | `EntryPointAccessors` for `SmsReceiver` | B-035, B-038 | ✅ |
| 4.7 | Fusionner les `NotificationHelper` | B-036 | ✅ |
| 4.8 | Supprimer les accès base depuis `ui/` | B-037 | ✅ |
| 4.9 | Sortir permissions et WorkManager de `MainActivity` | B-039 | ✅ |
| 4.10 | Supprimer le code mort identifié | B-040, B-041 | ✅ |

---

## Jalon 5 — Découpage architectural ⏳

**Objectif** : Découpage de `MainRepository` et `MainViewModel` (Incrémental).

| Ordre | Tâche | Réf. | Statut |
|---|---|---|---|
| 5.1 | Extraire `SalesRepository` | B-050b | ✅ (c8dfdb6) |
| 5.2 | Extraire `StockRepository` (InventoryRepository) | B-050c | ✅ (563eee3) |
| 5.3 | Extraire `CustomerRepository` / `SupplierRepository` | B-050 | 🟠 ABSORBÉ / RATTACHÉ — NON CERTIFIÉ COMME EXTRACTION AUTONOME |
| 5.4 | Extraire `CashRepository` (sessions, clôtures, audits) | B-050 | 🟠 RESPONSABILITÉS ABSORBÉES/RÉPARTIES — CASHREPOSITORY AUTONOME NON RÉALISÉ |
| 5.5 | Sortir la génération PDF/ticket du repository | B-051 | ✅ (a457eda) |
| 5.6 | Sortir les `Intent` Android vers `platform/` | B-052 | ✅ (056be5b) |
| 5.7 | `UiState` + ViewModel dédié pour `NewSaleScreen` | B-053, B-054 | ✅ (66c4285) |
| 5.8.1 | Extraction du domaine Inventaire (InventoryViewModel) | B-054 | ✅ (7c870b1) |
| 5.8.2 | Extraction du domaine Clients (CustomerViewModel) | B-054 | ✅ (61b616e) |
| 5.8.3 | Étendre le motif aux écrans restants (Sessions, Dépenses...) | B-054 | ⏭ PROCHAINE ÉTAPE |

*Note sur 5.3/5.4 : Customer est dans SalesRepo, Supplier/Audit dans InventoryRepo. Le plan de découpage vers des repositories autonomes a été redéfini par absorption fonctionnelle.*

---

## Jalon 6 — Fonctionnalités manquantes □

| Ordre | Tâche | Réf. | Statut |
|---|---|---|---|
| 6.1 | Écran de gestion du personnel (débloque réellement les rôles) | B-070 | □ |
| 6.2 | Pilotage complet des sessions de caisse | B-071 | □ |
| 6.3 | Refonte du parcours de permissions | B-078 | □ |
| 6.4 | Externalisation des textes + `values-en/` | B-073, B-074 | □ |
| 6.5 | Snackbars cohérents | B-076 | □ |
| 6.6 | Alertes d\u0027anomalie visibles dans l\u0027UI | B-072 | □ |
| 6.7a | Rapport comparatif Google Drive vs Dropbox | B-111 | □ |
| 6.7b | Implémenter la sauvegarde automatique distante retenue | B-112 | □ |
| 6.8 | Étude du passage à un type monétaire exact | B-077 | □ |

**✅ D2 tranchée — les deux volets en parallèle** :
- **Volet 1 (immédiat, J0/J1)** — B-110 : renommer « Synchronisation cloud » en
  **« Exporter et partager »** dans l\u0027UI, sans toucher à la logique existante.
- **Volet 2 (J6)** — B-111 puis B-112 : analyse comparative Google Drive vs
  Dropbox, puis implémentation d\u0027une vraie sauvegarde automatique distante.
  Dépend de **B-101** : on ne téléverse que des archives chiffrées `BackupManager`.

---

## Jalon 7 — Industrialisation □

| Ordre | Tâche | Réf. | Statut |
|---|---|---|---|
| 7.1 | ktlint ou detekt | B-097 | □ |
| 7.2 | CI GitHub Actions (build + test + lint sur PR) | B-098 | □ |
| 7.3 | Couverture JaCoCo publiée | B-099 | □ |
| 7.4 | Tests Compose des parcours critiques | B-095 | □ |
| 7.5 | Configuration de signature et de release |  | □ |

---

## Séquencement proposé

| Jalon | Contenu | Charge indicative |
|---|---|---|
| J0 | Build vérifiable | 1 session |
| J1 | Intégrité des données | 2–3 sessions |
| J2 | Sécurité | 2 sessions |
| J3 | Filet de tests | 2 sessions |
| J4 | Hilt + assainissement | 2–3 sessions |
| J5 | Découpage | 4–6 sessions (incrémental) |
| J6 | Fonctionnalités | 3–4 sessions |
| J7 | Industrialisation | 1–2 sessions |

*Une « session » \u003d une tâche `CURRENT_TASK.md` menée à terme, vérifiée et documentée.*

---

*Document mis à jour le 2026-08-19 (J5.8.2 CustomerViewModel TERMINÉ).*
