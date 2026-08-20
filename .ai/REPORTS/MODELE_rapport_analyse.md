# 📑 MODÈLE — RAPPORT D'ANALYSE

> Copier en `rapport_analyse_<AAAA-MM-JJ>_<sujet>.md`.
> À produire **avant** toute décision structurante ou refactor important.

---

# Rapport d'analyse — <sujet>

**Date** : AAAA-MM-JJ
**Auteur** : équipe technique
**Périmètre** : <fichiers / modules concernés>
**Réf. backlog** : B-XXX
**Commit analysé** : `<sha>`

---

## 1. Question posée

<Une seule question, formulée précisément. Ex. : « Comment corriger les
migrations Room divergentes sans perte de données sur les bases existantes ? »>

## 2. Contexte

<Rappel de l'existant strictement nécessaire à la compréhension. Pas de
paraphrase de `ARCHITECTURE.md`.>

## 3. Constats

Faits vérifiables uniquement, avec référence au code.

| # | Constat | Preuve (fichier:ligne / commande) | Gravité |
|---|---|---|---|
| C1 | | | 🔴/🟠/🟡 |

### Méthode de vérification
```bash
<commandes exécutées>
```

### Ce qui n'a pas pu être vérifié
<Lister honnêtement. Ex. : « compilation non exécutée : pas de JDK ».>

## 4. Options envisagées

### Option A — <intitulé>
- **Principe** :
- **Avantages** :
- **Inconvénients** :
- **Coût** : <sessions>
- **Risque** : 🔴/🟠/🟡
- **Impact sur les données existantes** :

### Option B — <intitulé>
<idem>

### Option C — ne rien faire
- **Conséquence si l'on n'agit pas** :

## 5. Analyse par rôle

| Rôle | Verdict | Réserve principale |
|---|---|---|
| Architecte | ✅/⚠️/❌ | |
| Dev Android senior | | |
| Expert Kotlin | | |
| Expert Room | | |
| Expert Compose | | |
| Expert Hilt | | |
| Expert SQL | | |
| Ingénieur QA | | |
| Expert sécurité | | |
| Ingénieur DevOps | | |
| Relecteur | | |

## 6. Recommandation

**Option retenue** : <A/B/C>

**Justification** : <3 lignes maximum>

**Risque résiduel accepté** :

**Conditions de réussite** :
- [ ]
- [ ]

## 7. Plan d'exécution

| # | Étape | Vérification associée |
|---|---|---|
| 1 | | |

## 8. Décisions requises du responsable

- [ ] <question précise appelant une réponse binaire ou un choix>
