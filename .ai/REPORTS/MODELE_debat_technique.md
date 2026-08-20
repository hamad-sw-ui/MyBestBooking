# ⚖️ MODÈLE — DÉBAT TECHNIQUE MULTI-RÔLES

> Copier en `debat_technique_<AAAA-MM-JJ>_<sujet>.md`.
>
> ⛔ Obligatoire au niveau **C** (`CODING_RULES.md` §15.0), et au niveau **S**
> en cas de désaccord entre rôles.

---

# Débat technique — <sujet>

**Date** : AAAA-MM-JJ · **Réf.** : B-XXX / BUG-XXX
**Conception débattue** : `analyse_conception_<date>_<sujet>.md`
**Question soumise au débat** : *<une seule question, tranchée par oui/non ou par
choix entre options nommées>*

---

## ⚠️ Règle du débat

Chaque rôle défend **son intérêt propre**, pas le consensus. Les rôles ont des
objectifs structurellement divergents :

| Rôle | Ce qu'il défend | Ce qu'il sacrifie volontiers |
|---|---|---|
| Architecte | pureté des couches, évolutivité | vitesse de livraison |
| Dev Android senior | robustesse sur le terrain | élégance théorique |
| Expert Kotlin | idiomatisme, sûreté des types | familiarité pour un débutant |
| Expert Compose | fluidité UI, recompositions | simplicité du code |
| Expert Room | intégrité des données | performances brutes |
| Expert Sécurité | confidentialité, intégrité | confort d'usage |
| Expert QA | testabilité, couverture | délais |
| Expert Performance | vitesse, mémoire, batterie | abstractions |
| Expert DevOps | reproductibilité, CI | flexibilité locale |
| Relecteur | lisibilité, cohérence | optimisations obscures |

**Un débat où tous approuvent est un débat raté.** Si aucun désaccord n'émerge,
c'est que la question était mal posée ou que les rôles n'ont pas été joués.

---

## 1. Avis des rôles

### 🏛️ Architecte logiciel
- **Position** : ✅ pour · ⚠️ réservé · ❌ contre
- **Recommandations** :
- **Objections** :
- **Risques** :
- **Alternatives** :

### 📱 Développeur Android senior
*(même structure)*

### 🅺 Expert Kotlin
### 🎨 Expert Jetpack Compose
### 🗄️ Expert Room
### 🔐 Expert Sécurité
### 🧪 Expert QA
### ⚡ Expert Performance
### ⚙️ Expert DevOps
### 👁️ Relecteur de code

---

## 2. Tableau des positions

| Rôle | Position | Objection principale |
|---|---|---|
| Architecte | | |
| Dev Android senior | | |
| Expert Kotlin | | |
| Expert Compose | | |
| Expert Room | | |
| Expert Sécurité | | |
| Expert QA | | |
| Expert Performance | | |
| Expert DevOps | | |
| Relecteur | | |

**Pour : N · Réservés : N · Contre : N**

## 3. Points de désaccord

| # | Désaccord | Rôles opposés | Enjeu réel |
|---|---|---|---|
| D1 | | X vs Y | |

> Les désaccords sont le **produit principal** de ce document. Un désaccord bien
> formulé révèle un arbitrage qui serait sinon resté implicite.

## 4. Synthèse

**Consensus** :

**Divergences irréductibles** :

**Ce que le débat a fait apparaître et qui n'était pas dans la conception** :

## 5. Décision finale

**Décision** :

### Avis retenus
| Avis | Rôle | Pourquoi retenu |
|---|---|---|

### Avis écartés
| Avis | Rôle | Pourquoi écarté |
|---|---|---|

> Un avis écarté doit l'être pour une **raison technique ou de priorité
> explicite**, jamais par omission. Un rôle dont l'avis est systématiquement
> écarté signale un problème de méthode.

### Risques résiduels acceptés
| Risque | Niveau | Justification de l'acceptation |
|---|---|---|

**Règle d'arbitrage MobileCaisse** : un ❌ de l'**Expert Sécurité** ou de
l'**Expert Room** est **bloquant** (données financières irremplaçables, aucune
restauration serveur possible). Les autres oppositions se négocient et se
documentent.

---

**Décision prise le** : AAAA-MM-JJ
**Conception à réviser suite au débat** : ☐ oui ☐ non
**Le développement peut commencer** : ☐ oui ☐ non
