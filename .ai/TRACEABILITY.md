# 🔗 TRACEABILITY — Matrice de traçabilité des preuves

Ce document lie chaque **tâche** ou **bug** clôturé à la **preuve** qui
justifie sa validation. C'est le pendant obligatoire de `CODING_RULES.md`
§13 et §22.

## Convention d'écriture

Chaque entrée porte :

- **ID** : identifiant de tâche (`B-xxx`) ou de bug (`B-xxx`).
- **Titre** : rappel court.
- **Niveau** : T / L / S / C.
- **Statut** : `PLANIFIÉ` | `EN COURS` | `CORRIGÉ (INSPECTION)` | `CORRIGÉ (VALIDÉ)` | `RÉGRESSION`.
- **Preuves** : liste horodatée, chaque preuve porte un **tag** §16
  (🔍/🔨/🧪/▶️/🧠/❓).
- **Commit(s)** : SHA courts.
- **Rapports** : liens vers les fichiers `REPORTS/` associés.

Un item `CORRIGÉ (VALIDÉ)` **sans** au moins une preuve 🔨, 🧪 ou ▶️ est
considéré comme non valide (audit §22) et repasse en `INSPECTION`.

---

## Registre

| ID | Titre | Niveau | Statut | Preuves | Commit(s) | Rapports |
|---|---|---|---|---|---|---|
| B-000 | Mise en place du framework `.ai/` v1.0.0 | S | CORRIGÉ (INSPECTION) | 🔍 tous les fichiers `.ai/` obligatoires existent (voir `ls .ai/`) · 🔍 `framework.manifest.json` valide JSON (à confirmer via `jq`) | `4ad8884` + commit courant | `REPORTS/analyse_impact_2026-08-20_governance_setup.md` · `REPORTS/analyse_conception_2026-08-20_governance_setup.md` · `ADR/ADR-001_Framework_de_gouvernance.md` |

## Audits historiques

_Aucun audit encore réalisé._

Format à venir :

```
### 2026-XX-XX — Audit demandé par <responsable>
- Item audité : B-xxx
- Preuve rejouée : ▶️ <commande>
- Résultat : conforme | RÉGRESSION
- Action : —
```

---

## Rappel §22

L'audit peut être demandé à tout moment. La responsabilité de fournir une
preuve **rejouable** (commande shell, requête curl, test qui passe)
incombe à celui qui a marqué l'item `VALIDÉ`. Si l'environnement a évolué
et que la preuve n'est plus rejouable, il faut le **dire** et proposer une
preuve équivalente à jour, pas prétendre que rien n'a changé.
