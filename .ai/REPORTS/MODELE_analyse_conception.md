# 🏗️ MODÈLE — CONCEPTION TECHNIQUE

> Copier en `analyse_conception_<AAAA-MM-JJ>_<sujet>.md`.
>
> ⛔ Obligatoire pour les niveaux **S** et **C** (`CODING_RULES.md` §15.0).
> Produit **après** l'analyse d'impact, **avant** toute écriture de code.

---

# Conception technique — <sujet>

**Date** : AAAA-MM-JJ · **Réf.** : B-XXX / BUG-XXX
**Niveau** : S · C — *justification :*
**Analyse d'impact préalable** : `analyse_impact_<date>_<sujet>.md`

---

## 1. Objectif

Pourquoi cette modification est nécessaire. Ce qui se passe si l'on ne fait rien.

## 2. Problème actuel

### Fonctionnement présent
🔍 *Observé dans le code* — description factuelle, références `fichier:ligne`.

### Limites
| # | Limite | Conséquence |
|---|---|---|

### Contraintes
| Contrainte | Origine | Négociable ? |
|---|---|---|

Contraintes structurelles de MobileCaisse à vérifier : hors-ligne d'abord ·
minSdk 24 · données financières irremplaçables · appareils modestes ·
`MainViewModel` unique · Workers sans interface.

## 3. Solutions possibles *(minimum trois, réellement différentes)*

### Solution A — <intitulé>
**Principe** :

| Critère | Évaluation |
|---|---|
| Avantages | |
| Inconvénients | |
| Complexité | Faible / Moyenne / Élevée |
| Performances | |
| Sécurité | |
| Maintenabilité | |
| Impact architecture | |

### Solution B — <intitulé>
*(même grille)*

### Solution C — <intitulé>
*(même grille)*

> Inclure « ne rien faire » quand c'est défendable : c'est souvent la seule
> option dont le coût est connu avec certitude.

### Comparatif

| Critère | A | B | C |
|---|---|---|---|
| Complexité | | | |
| Performances | | | |
| Sécurité | | | |
| Maintenabilité | | | |
| Impact architecture | | | |
| Coût (sessions) | | | |

## 4. Solution retenue

**Retenue : <A/B/C>**

**Pourquoi elle est meilleure que les autres** — argumenter **contre** chaque
alternative, pas seulement en faveur de la retenue :

- *vs A* :
- *vs B* :

**Ce qu'elle sacrifie** *(toute solution a un coût — le nommer)* :

## 5. Risques

| # | Risque | Niveau | Probabilité | Atténuation | Détection |
|---|---|---|---|---|---|
| | Faible / Moyen / Élevé / Critique | | | |

## 6. Compatibilité

| Dimension | Impact | Détail |
|---|---|---|
| Rétrocompatibilité | | données/fichiers produits par les versions antérieures |
| Migrations nécessaires | | schéma Room, format de fichier, préférences |
| Impacts utilisateurs | | changement de comportement visible |
| Impacts données | | risque de perte, conversion requise |
| Impacts performances | | mémoire, CPU, batterie, durée |

## 7. Plan de développement

Étapes **petites et validables individuellement**.

| # | Étape | Livrable | Validation | Réversible ? |
|---|---|---|---|---|
| 1 | | | | ✅/❌ |

**Point de non-retour** : <à partir de quelle étape le retour arrière devient coûteux>

## 8. Plan de retour arrière

### Si l'implémentation échoue en cours de route
```bash
git revert <sha>        # ou
git reset --hard <sha_avant>
```

### Si l'échec est détecté après livraison
| Situation | Procédure | Données récupérables ? |
|---|---|---|

⚠️ **Rappel** : une migration Room **n'est pas réversible**. Si la modification
touche le schéma, le retour arrière exige une restauration de sauvegarde —
à décrire précisément ici.

### Conditions de déclenchement du retour arrière
- [ ] <critère objectif d'abandon>

---

**Conception validée le** : AAAA-MM-JJ
**Débat multi-rôles requis** : ☐ oui ☐ non — *motif :*
**Le développement peut commencer** : ☐ oui ☐ non — *motif :*
